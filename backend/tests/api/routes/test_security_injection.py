from fastapi.testclient import TestClient
from sqlmodel import Session

from app import crud
from app.core.config import settings
from app.models import UserCreate, UserRole
from app.models_events import Church, Event, EventChurchLink
from tests.utils.utils import random_email, random_lower_string

# List of common SQL injection payloads
SQL_INJECTION_PAYLOADS = [
    "' OR '1'='1",
    "'; DROP TABLE user; --",
    "' UNION SELECT NULL, NULL, NULL --",
    "\" OR 1=1 --",
    "admin' --",
    "' AND 1=select count(*) from user --",
]

def test_login_sql_injection(client: TestClient) -> None:
    """Try SQL injection on login."""
    for payload in SQL_INJECTION_PAYLOADS:
        # Testing username
        login_data = {"username": payload, "password": "password"}
        r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
        # Should be unauthorized, NOT a 500 server error or a success
        assert r.status_code == 400 or r.status_code == 401

        # Testing password
        login_data = {"username": "admin@example.com", "password": payload}
        r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
        assert r.status_code == 400 or r.status_code == 401

def test_registration_sql_injection(client: TestClient) -> None:
    """Try SQL injection on registration."""
    for payload in SQL_INJECTION_PAYLOADS:
        data = {
            "email": f"test_{random_lower_string()}@example.com",
            "password": "password123",
            "full_name": payload # Inject in name
        }
        r = client.post(f"{settings.API_V1_STR}/users/signup", json=data)
        # If successfully created, the name should be exactly the payload (proving it was treated as data, not code)
        if r.status_code == 200:
            assert r.json()["full_name"] == payload
        else:
            # Or Pydantic might block some weird characters
            assert r.status_code in [400, 422]

def test_event_update_sql_injection(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    """Try SQL injection on event updates."""
    # Create an event
    event = Event(name="Safe Event", total_quota=10)
    db.add(event)
    db.commit()
    db.refresh(event)

    for payload in SQL_INJECTION_PAYLOADS:
        data = {"name": payload}
        r = client.patch(
            f"{settings.API_V1_STR}/events/{event.id}",
            headers=superuser_token_headers,
            json=data,
        )
        assert r.status_code == 200
        assert r.json()["name"] == payload # Treated as literal string

def test_idor_unauthorized_stats_access(
    client: TestClient, db: Session
) -> None:
    """Verify that a normal user cannot access another event's stats or register for an uninvited event."""
    # 1. Setup Church A and User A (Digiter)
    church_a = Church(name="Church A")
    db.add(church_a)
    db.commit()
    user_a_in = UserCreate(email=random_email(), password="password", full_name="User A", church_id=church_a.id, role=UserRole.DIGITER)
    user_a = crud.create_user(session=db, user_create=user_a_in)

    # 2. Setup Event X (Invited) and Event Y (NOT Invited)
    event_x = Event(name="Event X", total_quota=10)
    event_y = Event(name="Event Y", total_quota=10)
    db.add(event_x)
    db.add(event_y)
    db.commit()

    db.add(EventChurchLink(event_id=event_x.id, church_id=church_a.id, quota_limit=5))
    db.commit()

    # 3. Login as User A
    login_data = {"username": user_a.email, "password": "password"}
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 4. Try to register for Event Y (Not invited) -> SHOULD FAIL
    r = client.post(
        f"{settings.API_V1_STR}/events/events/{event_y.id}/register",
        headers=headers,
        json={"full_name": "Spy", "document_id": "999"}
    )
    assert r.status_code == 400
    assert "CHURCH_NOT_INVITED" in r.json()["detail"]

    # 5. Try to access Stats (Supervisor role needed) -> SHOULD FAIL
    r = client.get(
        f"{settings.API_V1_STR}/events/events/{event_x.id}/stats",
        headers=headers,
    )
    assert r.status_code == 403 # Forbidden
