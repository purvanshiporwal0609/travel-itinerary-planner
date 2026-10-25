import os

import httpx
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .auth import current_user
from .db import sb
from .llm import complete_plan, generate_plan, regenerate_day
from .models import Plan, PlanUpdate, RegenerateDay, ShareToggle, TripRequest

app = FastAPI(title="Travel Itinerary Planner API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("FRONTEND_URL", "http://localhost:5173").split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)

T = "itineraries"


def _get(trip_id: str, uid: str) -> dict:
    res = sb().table(T).select("*").eq("id", trip_id).eq("user_id", uid).execute()
    if not res.data:
        raise HTTPException(404, "Trip not found")
    return res.data[0]


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/itineraries/generate")
def generate(req: TripRequest, uid: str = Depends(current_user)):
    try:
        plan = generate_plan(req)
    except Exception as e:
        raise HTTPException(502, str(e))
    row = {
        "user_id": uid,
        "title": f"{req.destination} · {req.num_days}d",
        "request": req.model_dump(mode="json"),
        "plan": plan.model_dump(),
    }
    return sb().table(T).insert(row).execute().data[0]


@app.get("/api/itineraries")
def list_trips(uid: str = Depends(current_user)):
    res = (sb().table(T).select("id,title,request,created_at")
           .eq("user_id", uid).order("created_at", desc=True).execute())
    return res.data


@app.get("/api/itineraries/{trip_id}")
def get_trip(trip_id: str, uid: str = Depends(current_user)):
    return _get(trip_id, uid)


@app.put("/api/itineraries/{trip_id}")
def update_trip(trip_id: str, body: PlanUpdate, uid: str = Depends(current_user)):
    _get(trip_id, uid)
    patch = {"plan": body.plan.model_dump(), "updated_at": datetime.now(timezone.utc).isoformat()}
    if body.title:
        patch["title"] = body.title
    return sb().table(T).update(patch).eq("id", trip_id).eq("user_id", uid).execute().data[0]


@app.post("/api/itineraries/{trip_id}/regenerate-day")
def regen_day(trip_id: str, body: RegenerateDay, uid: str = Depends(current_user)):
    trip = _get(trip_id, uid)
    req, plan = TripRequest(**trip["request"]), Plan(**trip["plan"])
    if not 1 <= body.day <= len(plan.days):
        raise HTTPException(400, "Invalid day")
    try:
        new_day = regenerate_day(req, plan, body.day, body.instruction)
    except Exception as e:
        raise HTTPException(502, str(e))
    plan.days[body.day - 1] = new_day
    patch = {"plan": plan.model_dump(), "updated_at": datetime.now(timezone.utc).isoformat()}
    return sb().table(T).update(patch).eq("id", trip_id).eq("user_id", uid).execute().data[0]


@app.delete("/api/itineraries/{trip_id}")
def delete_trip(trip_id: str, uid: str = Depends(current_user)):
    _get(trip_id, uid)
    sb().table(T).delete().eq("id", trip_id).eq("user_id", uid).execute()
    return {"deleted": True}


@app.post("/api/itineraries/{trip_id}/share")
def share_trip(trip_id: str, body: ShareToggle, uid: str = Depends(current_user)):
    _get(trip_id, uid)
    return sb().table(T).update({"is_shared": body.enabled}).eq("id", trip_id).eq("user_id", uid).execute().data[0]


@app.get("/api/shared/{trip_id}")
def get_shared(trip_id: str):
    """Public read-only view for trips the owner chose to share with friends/group."""
    res = sb().table(T).select("id,title,request,plan").eq("id", trip_id).eq("is_shared", True).execute()
    if not res.data:
        raise HTTPException(404, "Trip not found or not shared")
    return res.data[0]


@app.post("/api/itineraries/{trip_id}/complete")
def complete_trip(trip_id: str, uid: str = Depends(current_user)):
    """Generate any days that are missing from a saved trip."""
    trip = _get(trip_id, uid)
    req, plan = TripRequest(**trip["request"]), Plan(**trip["plan"])
    try:
        plan = complete_plan(req, plan)
    except Exception as e:
        raise HTTPException(502, str(e))
    patch = {"plan": plan.model_dump(), "updated_at": datetime.now(timezone.utc).isoformat()}
    return sb().table(T).update(patch).eq("id", trip_id).eq("user_id", uid).execute().data[0]


# ---------- photos: optional keyed providers (Pixabay / Pexels). Keyless Commons search runs in the browser. ----------
import time

_photo_cache: dict = {}
_TTL = 12 * 3600  # provider terms discourage keeping image URLs for long, so refresh twice a day


def _pixabay(q: str):
    key = os.getenv("PIXABAY_API_KEY")
    if not key:
        return None
    r = httpx.get("https://pixabay.com/api/", timeout=10, params={
        "key": key, "q": q, "image_type": "photo", "orientation": "horizontal", "per_page": 3, "safesearch": "true"})
    r.raise_for_status()
    hits = r.json().get("hits")
    if not hits:
        return None
    h = hits[0]
    return {"src": h["webformatURL"], "hero": h["largeImageURL"], "page": h["pageURL"], "credit": f"{h['user']} / Pixabay"}


def _pexels(q: str):
    key = os.getenv("PEXELS_API_KEY")
    if not key:
        return None
    r = httpx.get("https://api.pexels.com/v1/search", timeout=10, headers={"Authorization": key},
                  params={"query": q, "per_page": 1, "orientation": "landscape"})
    r.raise_for_status()
    photos = r.json().get("photos")
    if not photos:
        return None
    p = photos[0]
    return {"src": p["src"]["landscape"], "hero": p["src"]["large2x"], "page": p["url"], "credit": f"{p['photographer']} / Pexels"}


def _find(q: str, errors: list):
    now = time.time()
    c = _photo_cache.get(q)
    if c and now - c[0] < _TTL:
        return c[1]
    for fn in (_pixabay, _pexels):
        try:
            hit = fn(q)
        except Exception as e:
            status = getattr(getattr(e, "response", None), "status_code", "")
            msg = f"{fn.__name__[1:]}: {type(e).__name__} {status}".strip()
            print(f"[photo] {msg} for {q!r}: {e!r}")
            errors.append(msg)
            hit = None
        if hit:
            _photo_cache[q] = (now, hit)
            return hit
    return None


@app.get("/api/photo")
def photo(q: str, fb: str = ""):
    """Photo from a keyed provider (Pixabay/Pexels) if one is configured; otherwise photo=null."""
    errors: list = []
    for query in (q.strip()[:100], fb.strip()[:100]):
        if query:
            hit = _find(query, errors)
            if hit:
                return {"photo": hit}
    return {"photo": None, "errors": sorted(set(errors))[:3]}
