"""Request size and rolling rate limits."""

import json
import time
from collections import defaultdict, deque

from starlette.responses import JSONResponse


class LimitsMiddleware:
    def __init__(self, app, max_requests=3000, max_actions=300, body_limit=16 * 1024, event_store=None):
        self.app = app
        self.max_requests = max_requests
        self.max_actions = max_actions
        self.body_limit = body_limit
        self.event_store = event_store
        self.requests = defaultdict(deque)
        self.actions = defaultdict(deque)
        self.last_event = {}

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = {key.lower(): value for key, value in scope.get("headers", [])}
        if scope.get("method") == "POST":
            length = headers.get(b"content-length")
            if length:
                try:
                    if int(length) > self.body_limit:
                        return await self._error(send, 413, {"error": "request too large"})
                except ValueError:
                    return await self._error(send, 413, {"error": "request too large"})
        ip = (scope.get("client") or ("unknown", 0))[0]
        now = time.monotonic()
        request_times = self.requests[ip]
        while request_times and now - request_times[0] >= 60:
            request_times.popleft()
        action_times = self.actions[ip]
        while action_times and now - action_times[0] >= 600:
            action_times.popleft()
        if len(request_times) >= self.max_requests:
            return await self._limited(send, scope, "requests")
        request_times.append(now)
        action = scope.get("method") == "POST" and scope.get("path") in {"/api/vote", "/api/guess", "/api/tray", "/api/demo/crowd"}
        if action and len(action_times) >= self.max_actions:
            return await self._limited(send, scope, "votes and guesses")
        if action:
            action_times.append(now)
        if len(request_times) == 1:
            self._purge(now)

        if scope.get("method") == "POST":
            # Read the whole body here (it is small) so an oversized chunked
            # upload is refused before the app starts parsing it.
            chunks, size, more = [], 0, True
            while more:
                message = await receive()
                if message.get("type") != "http.request":
                    return
                chunk = message.get("body", b"")
                size += len(chunk)
                if size > self.body_limit:
                    return await self._error(send, 413, {"error": "request too large"})
                chunks.append(chunk)
                more = message.get("more_body", False)
            body = b"".join(chunks)
            sent = False

            async def replay_receive():
                nonlocal sent
                if not sent:
                    sent = True
                    return {"type": "http.request", "body": body, "more_body": False}
                return await receive()

            app_receive = replay_receive
        else:
            app_receive = receive

        await self.app(scope, app_receive, send)

    def _purge(self, now):
        for mapping, window in ((self.requests, 60), (self.actions, 600)):
            for ip in list(mapping):
                while mapping[ip] and now - mapping[ip][0] >= window:
                    mapping[ip].popleft()
                if not mapping[ip]:
                    mapping.pop(ip, None)
        for ip in [ip for ip, stamp in self.last_event.items() if now - stamp >= 60]:
            del self.last_event[ip]

    async def _limited(self, send, scope, which):
        ip = (scope.get("client") or ("unknown", 0))[0]
        now = time.monotonic()
        if ip not in self.last_event or now - self.last_event[ip] >= 60:
            self.last_event[ip] = now
            store = self.event_store() if self.event_store else None
            if store:
                store.add("rate_limited", detail={"limit": which}, summary="A client was rate limited")
        return await self._error(send, 429, {"error": "slow down a little"})

    @staticmethod
    async def _error(send, status, body):
        encoded = json.dumps(body).encode()
        await send({"type": "http.response.start", "status": status, "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(encoded)).encode())]})
        await send({"type": "http.response.body", "body": encoded})


class SecurityHeadersMiddleware:
    """Adds safe default headers to every response, including CORS preflights and limit errors."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        async def secure_send(message):
            if message.get("type") == "http.response.start":
                extra = [
                    (b"x-content-type-options", b"nosniff"),
                    (b"referrer-policy", b"no-referrer"),
                    (b"x-frame-options", b"DENY"),
                ]
                if scope.get("path", "").startswith("/api/admin/"):
                    extra.append((b"cache-control", b"no-store"))
                message["headers"] = list(message.get("headers", [])) + extra
            await send(message)

        await self.app(scope, receive, secure_send)
