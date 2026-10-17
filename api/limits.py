"""Request size and rolling rate limits."""

import json
import time
from collections import defaultdict, deque
from urllib.parse import parse_qs

from .auth import verify_device
from .game import DEVICE_PATTERN

ACTION_PATHS = {"/api/vote", "/api/guess", "/api/tray", "/api/demo/crowd", "/api/served", "/api/admin/free"}
SLOW = "slow down a little"
TOO_MANY_PLAYERS = "too many new players from this network, try again soon"
MINUTE = 60
TEN_MINUTES = 600


def device_key(value):
    """The unsigned base id a request is counted under, or None when it names no usable device."""
    if not isinstance(value, str):
        return None
    if "." in value:
        return verify_device(value)
    return value if DEVICE_PATTERN.fullmatch(value) else None


def is_mint(body):
    """POST /api/device makes or signs an id unless it is handed an already signed one."""
    legacy = body.get("legacy") if isinstance(body, dict) else None
    return not (isinstance(legacy, str) and verify_device(legacy) is not None)


class LimitsMiddleware:
    def __init__(self, app, max_requests=1200, max_actions=300, body_limit=16 * 1024,
                 device_requests=60, device_actions=12, max_mints=120, event_store=None):
        self.app = app
        self.max_requests = max_requests
        self.max_actions = max_actions
        self.body_limit = body_limit
        self.device_requests = device_requests
        self.device_actions = device_actions
        self.max_mints = max_mints
        self.event_store = event_store
        self.requests = defaultdict(deque)
        self.actions = defaultdict(deque)
        self.mints = defaultdict(deque)
        self.device_request_times = defaultdict(deque)
        self.device_action_times = defaultdict(deque)
        self.windows = (
            (self.requests, MINUTE),
            (self.actions, TEN_MINUTES),
            (self.mints, TEN_MINUTES),
            (self.device_request_times, MINUTE),
            (self.device_action_times, TEN_MINUTES),
        )
        self.last_event = {}
        self.last_purge = None

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = {key.lower(): value for key, value in scope.get("headers", [])}
        method = scope.get("method")
        path = scope.get("path")
        if method == "POST":
            length = headers.get(b"content-length")
            if length:
                try:
                    if int(length) > self.body_limit:
                        return await self._error(send, 413, {"error": "request too large"})
                except ValueError:
                    return await self._error(send, 413, {"error": "request too large"})

        ip = (scope.get("client") or ("unknown", 0))[0]
        now = time.monotonic()
        if self.last_purge is None or now - self.last_purge >= MINUTE:
            self._purge(now)
        request_times = self._window(self.requests, ip, now, MINUTE)
        if len(request_times) >= self.max_requests:
            return await self._limited(send, scope, "requests")
        request_times.append(now)
        action = method == "POST" and path in ACTION_PATHS
        if action:
            action_times = self._window(self.actions, ip, now, TEN_MINUTES)
            if len(action_times) >= self.max_actions:
                return await self._limited(send, scope, "votes and guesses")
            action_times.append(now)

        body = b""
        if method == "POST":
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

        parsed = self._json(body)
        query_device = parse_qs(scope.get("query_string", b"").decode("latin-1")).get("device")
        device = device_key(query_device[0] if query_device else parsed.get("device") if isinstance(parsed, dict) else None)
        if device:
            device_times = self._window(self.device_request_times, device, now, MINUTE)
            if len(device_times) >= self.device_requests:
                return await self._limited(send, scope, "device requests")
            device_times.append(now)
            if action:
                device_action_times = self._window(self.device_action_times, device, now, TEN_MINUTES)
                if len(device_action_times) >= self.device_actions:
                    return await self._limited(send, scope, "device actions")
                device_action_times.append(now)

        if method == "POST" and path == "/api/device" and is_mint(parsed):
            mint_times = self._window(self.mints, ip, now, TEN_MINUTES)
            if len(mint_times) >= self.max_mints:
                return await self._limited(send, scope, "new players", TOO_MANY_PLAYERS)
            mint_times.append(now)

        await self.app(scope, app_receive, send)

    @staticmethod
    def _json(body):
        if not body:
            return None
        try:
            return json.loads(body)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _window(mapping, key, now, window):
        times = mapping[key]
        while times and now - times[0] >= window:
            times.popleft()
        return times

    def _purge(self, now):
        self.last_purge = now
        for mapping, window in self.windows:
            for key in list(mapping):
                if not self._window(mapping, key, now, window):
                    mapping.pop(key, None)
        for key in [key for key, stamp in self.last_event.items() if now - stamp >= MINUTE]:
            del self.last_event[key]

    async def _limited(self, send, scope, which, message=SLOW):
        # One event per address and limit kind per minute. The event names the
        # limit only: never the address or the device.
        ip = (scope.get("client") or ("unknown", 0))[0]
        now = time.monotonic()
        key = (ip, which)
        if key not in self.last_event or now - self.last_event[key] >= MINUTE:
            self.last_event[key] = now
            store = self.event_store() if self.event_store else None
            if store:
                store.add("rate_limited", detail={"limit": which}, summary="A client was rate limited")
        return await self._error(send, 429, {"error": message})

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
