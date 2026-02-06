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


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
