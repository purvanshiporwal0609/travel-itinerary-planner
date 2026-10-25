from datetime import date
from typing import List, Literal
from pydantic import BaseModel, Field


class TripRequest(BaseModel):
    destination: str = Field(min_length=2, max_length=100)
    start_date: date
    num_days: int = Field(ge=1, le=14)
    budget: float = Field(gt=0)
    currency: str = "INR"
    travel_style: Literal["budget", "balanced", "luxury"] = "balanced"
    pace: Literal["relaxed", "moderate", "packed"] = "moderate"
    group_size: int = Field(1, ge=1, le=30)
    interests: List[str] = []
    notes: str = Field("", max_length=500)


class Item(BaseModel):
    time: str = ""
    type: str = "activity"  # attraction | food | stay | transport | activity
    name: str
    description: str = ""
    cost: float = 0  # estimated cost for the whole group
    duration_min: int = 0
    image_query: str = ""  # Wikipedia article title used to find a photo


class Day(BaseModel):
    day: int
    title: str
    items: List[Item]


class Plan(BaseModel):
    summary: str = ""
    accommodation: str = ""
    accommodation_cost: float = 0  # total for all nights, whole group
    tips: List[str] = []
    days: List[Day]


class RegenerateDay(BaseModel):
    day: int = Field(ge=1)
    instruction: str = Field("", max_length=300)


class PlanUpdate(BaseModel):
    plan: Plan
    title: str | None = None


class ShareToggle(BaseModel):
    enabled: bool
