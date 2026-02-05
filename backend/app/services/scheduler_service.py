import logging

from apscheduler.schedulers.background import BackgroundScheduler

from ..config import get_config
from ..database import SessionLocal
from . import retention_engine

logger = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None


def _scheduled_check():
    """Periodic disk check and cleanup if threshold exceeded."""
    logger.info("Running scheduled disk check")
    if retention_engine.is_running():
        logger.info("Cleanup already running, skipping")
        return
    db = SessionLocal()
    try:
        retention_engine.run_cleanup(db, trigger="scheduled", dry_run=False)
    except Exception:
        logger.exception("Scheduled cleanup failed")
    finally:
        db.close()


def start_scheduler():
    global _scheduler
    config = get_config()
    interval = config.disk.check_interval_minutes

    _scheduler = BackgroundScheduler()
    _scheduler.add_job(
        _scheduled_check,
        "interval",
        minutes=interval,
        id="disk_check",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info("Scheduler started with %d minute interval", interval)


def stop_scheduler():
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("Scheduler stopped")


def reschedule(interval_minutes: int):
    global _scheduler
    if _scheduler:
        _scheduler.reschedule_job("disk_check", trigger="interval", minutes=interval_minutes)
        logger.info("Rescheduled disk check to %d minute interval", interval_minutes)
