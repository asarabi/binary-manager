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
    from sqlalchemy import inspect, text
    inspector = inspect(eng)
    # Add server_name to cleanup_logs if missing
    if "cleanup_logs" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("cleanup_logs")]
        if "server_name" not in columns:
            with eng.begin() as conn:
                conn.execute(text(
                    "ALTER TABLE cleanup_logs ADD COLUMN server_name VARCHAR(100) NOT NULL DEFAULT '' AFTER deleted_at"
                ))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
