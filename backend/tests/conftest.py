import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.database import Base, get_db
from app.main import app
from app.core.security import create_access_token, hash_password
from app.models.organizer import Organizer
from app.models.admin import Admin

SQLALCHEMY_TEST_URL = "sqlite:///./test.db"

engine = create_engine(SQLALCHEMY_TEST_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def reset_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def organizer_token(db):
    org = Organizer(
        first_name="Test",
        last_name="Organizer",
        email="test@example.com",
        password_hash=hash_password("password123"),
    )
    db.add(org)
    db.commit()
    db.refresh(org)
    token = create_access_token({"sub": org.id, "type": "organizer"})
    return token, org


@pytest.fixture
def admin_token(db):
    admin = Admin(username="testadmin", password_hash=hash_password("admin123"))
    db.add(admin)
    db.commit()
    db.refresh(admin)
    token = create_access_token({"sub": admin.id, "type": "admin"})
    return token, admin
