from fastapi.testclient import TestClient
from sqlmodel import Session
from datetime import datetime

from app import crud
from app.core.config import settings
from app.models import UserCreate, UserRole
from app.models_events import Attendee, Church, Event, EventChurchLink
from tests.utils.utils import random_email, random_lower_string


# Helpers (duplicated from test_events.py for isolation)
def create_random_church(db: Session) -> Church:
    import uuid

    name = f"{random_lower_string()}_{uuid.uuid4()}"
    church = Church(name=name)
    db.add(church)
    db.commit()
    db.refresh(church)
    return church


def create_random_event(db: Session, total_quota: int = 10) -> Event:
    name = random_lower_string()
    event = Event(name=name, total_quota=total_quota, is_active=True)
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def test_search_attendee(client: TestClient, db: Session) -> None:
    # 1. Setup
    church = create_random_church(db)
    user_in = UserCreate(
        email=random_email(),
        password=random_lower_string(),
        full_name="Digiter User",
        church_id=church.id,
        role=UserRole.DIGITER,
    )
    user = crud.create_user(session=db, user_create=user_in)
    event = create_random_event(db, total_quota=10)

    # 2. Link Church to Event
    link = EventChurchLink(event_id=event.id, church_id=church.id, quota_limit=10)
    db.add(link)
    db.commit()

    # 3. Create Attendee directly in DB
    attendee = Attendee(
        full_name="John Doe",
        document_id="123456789",
        email="john@example.com",
        event_id=event.id,
        church_id=church.id,
        registered_by_id=user.id,
    )
    db.add(attendee)
    db.commit()
    db.refresh(attendee)

    # 4. Login
    login_data = {"username": user.email, "password": user_in.password}
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 5. Search - Success
    r = client.get(
        f"{settings.API_V1_STR}/events/{event.id}/attendees/search",
        headers=headers,
        params={"document_id": "123456789"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == str(attendee.id)
    assert data["full_name"] == "John Doe"

    # 6. Search - Not Found
    r = client.get(
        f"{settings.API_V1_STR}/events/{event.id}/attendees/search",
        headers=headers,
        params={"document_id": "999999999"},
    )
    assert r.status_code == 404


def test_checkin_attendee(client: TestClient, db: Session) -> None:
    # 1. Setup
    church = create_random_church(db)
    user_in = UserCreate(
        email=random_email(),
        password=random_lower_string(),
        full_name="Digiter User",
        church_id=church.id,
        role=UserRole.DIGITER,
    )
    user = crud.create_user(session=db, user_create=user_in)
    event = create_random_event(db, total_quota=10)

    # 2. Link Church to Event
    link = EventChurchLink(event_id=event.id, church_id=church.id, quota_limit=10)
    db.add(link)
    db.commit()

    # 3. Create Attendee
    attendee = Attendee(
        full_name="Jane Doe",
        document_id="987654321",
        email="jane@example.com",
        event_id=event.id,
        church_id=church.id,
        registered_by_id=user.id,
    )
    db.add(attendee)
    db.commit()
    db.refresh(attendee)

    # 4. Login
    login_data = {"username": user.email, "password": user_in.password}
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 5. Checkin - Success
    assert attendee.checked_in_at is None
    r = client.post(
        f"{settings.API_V1_STR}/events/{event.id}/attendees/{attendee.id}/checkin",
        headers=headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["checked_in_at"] is not None

    # Verify DB update
    db.refresh(attendee)
    assert attendee.checked_in_at is not None

    # 6. Checkin - Already Checked In (Conflict)
    r = client.post(
        f"{settings.API_V1_STR}/events/{event.id}/attendees/{attendee.id}/checkin",
        headers=headers,
    )
    assert r.status_code == 409

    # 7. Check Stats Update (Use superuser because Digiter can't see stats)
    from tests.utils.utils import get_superuser_token_headers

    superuser_headers = get_superuser_token_headers(client)
    r = client.get(
        f"{settings.API_V1_STR}/events/{event.id}/stats", headers=superuser_headers
    )
    assert r.status_code == 200
    stats = r.json()
    assert stats["checked_in_count"] == 1
