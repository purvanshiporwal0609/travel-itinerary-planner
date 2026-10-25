import json
import os
import time
from concurrent.futures import ThreadPoolExecutor

from openai import OpenAI

from .models import Day, Plan, TripRequest

_client = None


def client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(
            api_key=os.environ["LLM_API_KEY"],
            base_url=os.getenv("LLM_BASE_URL", "https://api.groq.com/openai/v1"),
        )
    return _client


def _model() -> str:
    v = (os.getenv("LLM_MODEL") or "openai/gpt-oss-120b").strip().strip("\"'")
    if "=" in v:  # tolerate a pasted "LLM_MODEL=" prefix
        v = v.split("=", 1)[1].strip()
    return v


SYSTEM = """You are an expert local travel planner. Reply with ONE valid JSON object and nothing else.
Rules:
- Use real, well-known places and honest approximate prices.
- Group nearby places on the same day to minimise travel; order items chronologically.
- 'cost' is the estimated cost for the WHOLE group (multiply per-person prices by group size), in the requested currency.
- 'time' is 24h like "09:30". 'type' is one of: attraction, food, stay, transport, activity.
- Respect the traveller's style, pace, interests and notes.
- 'image_query' is the exact English Wikipedia article title that best shows this place or dish (e.g. 'Red Fort', 'Jama Masjid, Delhi', 'Paratha', 'Butter chicken'). For food, prefer the famous dish or the restaurant if it has its own article. Use an empty string for transport."""


def _call(messages: list[dict], max_tokens: int = 4000, retries: int = 2) -> dict:
    model = _model()
    kwargs = dict(model=model, messages=messages, temperature=0.7,
                  response_format={"type": "json_object"}, max_tokens=max_tokens)
    if "gpt-oss" in model:
        kwargs["extra_body"] = {"reasoning_effort": "low"}  # faster, leaves room for the answer
    last = None
    for attempt in range(retries + 1):
        try:
            res = client().chat.completions.create(**kwargs)
            return json.loads(res.choices[0].message.content)
        except Exception as e:  # bad JSON, rate limit, truncation...
            last = e
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"LLM request failed: {last}")


def _brief(req: TripRequest) -> str:
    return (
        f"Destination: {req.destination}\nStart date: {req.start_date}\nDays: {req.num_days}\n"
        f"Total budget: {req.budget} {req.currency} for {req.group_size} traveller(s)\n"
        f"Style: {req.travel_style}\nPace: {req.pace}\n"
        f"Interests: {', '.join(req.interests) or 'general sightseeing'}\n"
        f"Notes: {req.notes or 'none'}"
    )


def _daily_budget(req: TripRequest) -> int:
    # ~80% of the budget goes to food/activities/transport, the rest to the stay
    return max(1, round(req.budget * 0.8 / req.num_days))


ITEM_SHAPE = '{"time":"09:00","type":"attraction","name":"...","description":"one short sentence","cost":0,"duration_min":90,"image_query":"Red Fort"}'


def _plan_day(req: TripRequest, n: int, title: str, titles: list[str], other_places: list[str] | None = None,
              instruction: str = "") -> Day:
    daily = _daily_budget(req)
    msgs = [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": (
            f"Trip brief:\n{_brief(req)}\n\nAll day themes: {json.dumps(titles)}\n"
            + (f"Places already used on other days (avoid repeating): {json.dumps(other_places)}\n" if other_places else "")
            + f"\nPlan ONLY day {n} (theme: {title}). "
            + (f"User instruction: {instruction}\n" if instruction else "")
            + f"Include 6 to 9 items in time order covering breakfast, lunch, dinner, the main sights and the transport "
              f"between them. Total cost of the day for the whole group of {req.group_size} should be about "
              f"{daily} {req.currency} (never above {round(daily * 1.15)}).\n"
              f'Return JSON: {{"day": {n}, "title": "...", "items": [{ITEM_SHAPE}]}}')},
    ]
    day = Day.model_validate(_call(msgs, max_tokens=3500))
    if len(day.items) < 3:
        raise RuntimeError(f"Day {n} came back too short, please try again")
    day.day = n
    if not day.title:
        day.title = title
    return day


def generate_plan(req: TripRequest) -> Plan:
    n = req.num_days
    outline = _call([
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": (
            f"Create the trip OUTLINE.\n{_brief(req)}\n\nReturn JSON:\n"
            '{"summary": "2-3 sentence overview", "accommodation": "recommended area + hotel type", '
            f'"accommodation_cost": <total cost of ALL nights for the whole group in {req.currency}, rooms for {req.group_size} people>, '
            '"tips": ["3-5 short practical tips"], '
            f'"days": [{{"day": 1, "title": "distinct theme for the day"}}]}}\nThe days list must contain exactly {n} entries.')},
    ], max_tokens=2000)

    titles = [str(d.get("title", "")).strip() for d in outline.get("days", []) if isinstance(d, dict)]
    titles = (titles + [f"Exploring {req.destination}"] * n)[:n]

    with ThreadPoolExecutor(max_workers=3) as ex:  # one request per day -> every day is always generated
        days = list(ex.map(lambda i: _plan_day(req, i + 1, titles[i], titles), range(n)))

    try:
        stay = min(max(float(outline.get("accommodation_cost") or 0), 0), req.budget)
    except (TypeError, ValueError):
        stay = 0
    return Plan(
        summary=str(outline.get("summary", "")),
        accommodation=str(outline.get("accommodation", "")),
        accommodation_cost=stay,
        tips=[str(t) for t in (outline.get("tips") or [])][:6],
        days=days,
    )


def regenerate_day(req: TripRequest, plan: Plan, day_no: int, instruction: str) -> Day:
    titles = [d.title for d in plan.days]
    other = [i.name for d in plan.days if d.day != day_no for i in d.items]
    return _plan_day(req, day_no, titles[day_no - 1], titles, other,
                     instruction or "give me a fresh alternative for this day")


def complete_plan(req: TripRequest, plan: Plan) -> Plan:
    """Fill in any days missing from a saved plan (e.g. older trips that only got Day 1)."""
    n = req.num_days
    by_day = {d.day: d for d in plan.days}
    titles = [by_day[i].title if i in by_day else f"New experiences in {req.destination}" for i in range(1, n + 1)]
    used = [it.name for d in plan.days for it in d.items]
    for i in range(1, n + 1):
        if i in by_day:
            continue
        d = _plan_day(req, i, titles[i - 1], titles, used,
                      "Choose a distinct theme and different places from the other days, and give the day a fitting title")
        by_day[i] = d
        used += [it.name for it in d.items]
        titles[i - 1] = d.title
    plan.days = [by_day[i] for i in range(1, n + 1)]
    return plan
