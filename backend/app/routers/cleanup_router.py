import threading

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import SessionLocal, get_db
from ..schemas import CleanupStatusResponse, CleanupTriggerRequest
from ..services import retention_engine

router = APIRouter(prefix="/api/cleanup", tags=["cleanup"])


@router.post("/trigger")
def trigger_cleanup(
    request: CleanupTriggerRequest,
    user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if retention_engine.is_running():
        raise HTTPException(status_code=409, detail="Cleanup already in progress")

    if request.dry_run:
        # Run dry_run synchronously
        run = retention_engine.run_cleanup(db, trigger="manual", dry_run=True)
        return {"message": "Dry run completed", "run_id": run.id}

    # Run actual cleanup in background thread
    def _run():
        session = SessionLocal()
        try:
            retention_engine.run_cleanup(session, trigger="manual", dry_run=False)
        except Exception:
            pass
        finally:
            session.close()

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()
    return {"message": "Cleanup started"}


@router.get("/status", response_model=CleanupStatusResponse)
def get_status(user: str = Depends(get_current_user)):
    status = retention_engine.get_status()
    return CleanupStatusResponse(**status)
