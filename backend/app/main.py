from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import load_config
from .database import init_db
from .routers import (
    auth_router,
    binaries_router,
    cleanup_router,
    config_router,
    dashboard_router,
    logs_router,
)
from .services.scheduler_service import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_config()
    init_db()
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title="Binary Retention Manager", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(dashboard_router.router)
app.include_router(binaries_router.router)
app.include_router(config_router.router)
app.include_router(cleanup_router.router)
app.include_router(logs_router.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
