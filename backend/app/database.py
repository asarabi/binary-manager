import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


class Base(DeclarativeBase):
    pass


def get_database_url() -> str:
    return os.environ.get(
        "DATABASE_URL",
        "mysql+pymysql://binary_manager:binary_manager@localhost:3306/binary_manager",
    )


def get_engine():
    database_url = get_database_url()
    return create_engine(database_url, echo=False, pool_pre_ping=True)


engine = get_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    Base.metadata.create_all(bind=engine)
    _migrate(engine)


def _migrate(eng):
    """Apply schema migrations for columns added after initial release."""
    from sqlalchemy import text
    with eng.begin() as conn:
        try:
            conn.execute(text(
                "ALTER TABLE cleanup_logs ADD COLUMN server_name VARCHAR(100) NOT NULL DEFAULT '' AFTER deleted_at"
            ))
        except Exception:
            pass  # column already exists


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
