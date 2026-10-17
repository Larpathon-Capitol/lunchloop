"""Anonymous in-memory event feed."""

from collections import deque
from datetime import datetime, timezone
import hashlib
import hmac
import threading

from .auth import secret


class EventStore:
    def __init__(self, capacity=300):
        # Live and simulated events get separate buffers, so a burst of simulated
        # activity never pushes real students' events out of the feed.
        self.buffers = {"live": deque(maxlen=capacity), "simulated": deque(maxlen=capacity)}
        self.lock = threading.Lock()
        self.next_id = 1

    def player(self, device):
        if not device:
            return None
        return hmac.new(secret(), device.encode(), hashlib.sha256).hexdigest()[:6]

    def add(self, kind, school_id=None, device=None, summary="", detail=None, ms=None):
        with self.lock:
            event = {
                "id": self.next_id,
                "at": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
                "kind": kind,
                "school_id": school_id,
                "player": self.player(device),
                "summary": summary,
                "detail": detail or {},
                "ms": round(ms, 1) if ms is not None else None,
            }
            self.next_id += 1
            self.buffers["live" if school_id == "live" else "simulated"].append(event)
        return event

    def after(self, after, limit, scope=None):
        with self.lock:
            pool = self.buffers[scope] if scope else sorted([*self.buffers["live"], *self.buffers["simulated"]], key=lambda event: event["id"])
            selected = [event for event in pool if event["id"] > after][:limit]
            latest = self.next_id - 1
        return selected, latest
