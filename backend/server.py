from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------- Models ----------
class SpeedVolumeStop(BaseModel):
    speed: float  # km/h threshold
    volume: float  # 0-100


class Settings(BaseModel):
    user_id: str
    mode: str = "Cycling"  # Cycling | Bike | Driving
    auto_volume: bool = True
    sensitivity: str = "medium"  # low | medium | high
    smoothing: str = "medium"  # slow | medium | fast
    max_volume: float = 100.0
    window_level: float = 50.0  # 0-100, only for Driving
    ai_noise_detection: bool = False  # Pro
    custom_mode: bool = False  # Pro
    speed_volume_map: List[SpeedVolumeStop] = Field(
        default_factory=lambda: [
            SpeedVolumeStop(speed=10, volume=20),
            SpeedVolumeStop(speed=30, volume=40),
            SpeedVolumeStop(speed=60, volume=70),
            SpeedVolumeStop(speed=120, volume=100),
        ]
    )
    updated_at: str = Field(default_factory=now_iso)


class SettingsUpdate(BaseModel):
    mode: Optional[str] = None
    auto_volume: Optional[bool] = None
    sensitivity: Optional[str] = None
    smoothing: Optional[str] = None
    max_volume: Optional[float] = None
    window_level: Optional[float] = None
    ai_noise_detection: Optional[bool] = None
    custom_mode: Optional[bool] = None
    speed_volume_map: Optional[List[SpeedVolumeStop]] = None


class Subscription(BaseModel):
    user_id: str
    tier: str = "free"  # free | pro
    plan: Optional[str] = None  # monthly | quarterly | trial
    started_at: Optional[str] = None
    expires_at: Optional[str] = None


class CancelSub(BaseModel):
    user_id: str


class ActivatePro(BaseModel):
    user_id: str
    plan: str  # monthly | quarterly | trial


class Session(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    mode: str
    duration_seconds: float
    avg_speed: float
    max_speed: float
    avg_volume: float
    started_at: str
    ended_at: str = Field(default_factory=now_iso)


class SessionCreate(BaseModel):
    user_id: str
    mode: str
    duration_seconds: float
    avg_speed: float
    max_speed: float
    avg_volume: float
    started_at: str


# ---------- Helpers ----------
async def get_or_create_settings(user_id: str) -> Dict[str, Any]:
    existing = await db.settings.find_one({"user_id": user_id}, {"_id": 0})
    if existing:
        return existing
    s = Settings(user_id=user_id).dict()
    await db.settings.insert_one(s.copy())
    return s


async def get_or_create_subscription(user_id: str) -> Dict[str, Any]:
    existing = await db.subscriptions.find_one({"user_id": user_id}, {"_id": 0})
    if existing:
        return existing
    sub = Subscription(user_id=user_id).dict()
    await db.subscriptions.insert_one(sub.copy())
    return sub


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "FlowVolume API", "version": "1.0"}


@api_router.get("/settings/{user_id}")
async def get_settings(user_id: str):
    return await get_or_create_settings(user_id)


@api_router.put("/settings/{user_id}")
async def update_settings(user_id: str, payload: SettingsUpdate):
    current = await get_or_create_settings(user_id)
    update_data = {k: v for k, v in payload.dict().items() if v is not None}
    if "speed_volume_map" in update_data and update_data["speed_volume_map"] is not None:
        update_data["speed_volume_map"] = [
            s if isinstance(s, dict) else s.dict() for s in update_data["speed_volume_map"]
        ]
    update_data["updated_at"] = now_iso()
    current.update(update_data)
    await db.settings.update_one({"user_id": user_id}, {"$set": update_data}, upsert=True)
    return current


@api_router.get("/subscription/{user_id}")
async def get_subscription(user_id: str):
    return await get_or_create_subscription(user_id)


@api_router.post("/subscription/activate")
async def activate_pro(payload: ActivatePro):
    plan = payload.plan
    if plan not in ("monthly", "quarterly", "trial"):
        raise HTTPException(400, "Invalid plan")
    days = {"monthly": 30, "quarterly": 90, "trial": 3}[plan]
    started = datetime.now(timezone.utc)
    expires = started + timedelta(days=days)
    sub = {
        "user_id": payload.user_id,
        "tier": "pro",
        "plan": plan,
        "started_at": started.isoformat(),
        "expires_at": expires.isoformat(),
    }
    await db.subscriptions.update_one(
        {"user_id": payload.user_id}, {"$set": sub}, upsert=True
    )
    return sub


@api_router.post("/subscription/cancel")
async def cancel_pro(payload: CancelSub):
    sub = {
        "user_id": payload.user_id,
        "tier": "free",
        "plan": None,
        "started_at": None,
        "expires_at": None,
    }
    await db.subscriptions.update_one(
        {"user_id": payload.user_id}, {"$set": sub}, upsert=True
    )
    return sub


@api_router.post("/sessions", response_model=Session)
async def create_session(payload: SessionCreate):
    session = Session(**payload.dict())
    await db.sessions.insert_one(session.dict())
    return session


@api_router.get("/sessions/{user_id}", response_model=List[Session])
async def list_sessions(user_id: str):
    docs = await db.sessions.find({"user_id": user_id}, {"_id": 0}).sort("ended_at", -1).to_list(100)
    return [Session(**d) for d in docs]


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
