from fastapi.testclient import TestClient
from sqlmodel import Session

from app import crud
from app.core.config import settings
from app.models import UserCreate, UserRole
from app.models_events import Attendee, Church, Event, EventChurchLink
from tests.utils.utils import random_email, random_lower_string


def create_random_church(db: Session) -> Church:
    name = random_lower_string()
    church = Church(name=name)
    db.add(church)
    db.commit()
    db.refresh(church)
    return church

def create_random_event(db: Session, total_quota: int = 10) -> Event:
    name = random_lower_string()
    event = Event(name=name, total_quota=total_quota)
    db.add(event)
    db.commit()
    db.refresh(event)
    return event

def test_create_event(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    data = {"name": "Test Event", "total_quota": 100, "description": "Bla bla"}
    r = client.post(
        f"{settings.API_V1_STR}/events/events",
        headers=superuser_token_headers,
        json=data,
    )
    assert r.status_code == 200
    created_event = r.json()
    assert created_event["name"] == "Test Event"
    assert created_event["total_quota"] == 100

def test_update_event(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    event = create_random_event(db)
    new_quota = 500
    data = {"total_quota": new_quota}
    r = client.patch(
        f"{settings.API_V1_STR}/events/{event.id}",
        headers=superuser_token_headers,
        json=data,
    )
    assert r.status_code == 200
    updated_event = r.json()
    assert updated_event["total_quota"] == 500

    db.refresh(event)
    assert event.total_quota == 500

def test_register_attendee_global_quota(
    client: TestClient, db: Session
) -> None:
    # 1. Setup Church and User
    church = create_random_church(db)
    user_in = UserCreate(email=random_email(), password=random_lower_string(), full_name="Test User", church_id=church.id, role=UserRole.DIGITER)
    user = crud.create_user(session=db, user_create=user_in)

    # 2. Setup Event with small quota
    event = create_random_event(db, total_quota=2)

    # 3. Invite Church with a LARGER quota than event (test global override)
    link = EventChurchLink(event_id=event.id, church_id=church.id, quota_limit=10)
    db.add(link)
    db.commit()

    # 4. Login
    login_data = {"username": user.email, "password": user_in.password}
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 5. Register 1st attendee - SUCCESS
    r = client.post(
        f"{settings.API_V1_STR}/events/events/{event.id}/register",
        headers=headers,
        json={"full_name": "Attendee 1", "document_id": "123"}
    )
    assert r.status_code == 200

    # 6. Register 2nd attendee - SUCCESS
    r = client.post(
        f"{settings.API_V1_STR}/events/events/{event.id}/register",
        headers=headers,
        json={"full_name": "Attendee 2", "document_id": "456"}
    )
    assert r.status_code == 200

    # 7. Register 3rd attendee - FAIL (Global Quota Exceeded)
    r = client.post(
        f"{settings.API_V1_STR}/events/events/{event.id}/register",
        headers=headers,
        json={"full_name": "Attendee 3", "document_id": "789"}
    )
    assert r.status_code == 400
    assert "EVENT_QUOTA_EXCEEDED" in r.json()["detail"]

def test_register_attendee_ignore_church_quota(
    client: TestClient, db: Session
) -> None:
    # 1. Setup Church and User
    church = create_random_church(db)
    user_in = UserCreate(email=random_email(), password=random_lower_string(), full_name="Test User", church_id=church.id, role=UserRole.DIGITER)
    user = crud.create_user(session=db, user_create=user_in)

    # 2. Setup Event with larger quota
    event = create_random_event(db, total_quota=10)

    # 3. Invite Church with a SMALLER quota
    link = EventChurchLink(event_id=event.id, church_id=church.id, quota_limit=1)
    db.add(link)
    db.commit()

    # 4. Login
    login_data = {"username": user.email, "password": user_in.password}
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 5. Register 1st attendee - SUCCESS
    r = client.post(
        f"{settings.API_V1_STR}/events/events/{event.id}/register",
        headers=headers,
        json={"full_name": "Attendee 1", "document_id": "123"}
    )
    assert r.status_code == 200

    # 6. Register 2nd attendee - SUCCESS (Should ignore church quota of 1)
    r = client.post(
        f"{settings.API_V1_STR}/events/events/{event.id}/register",
        headers=headers,
        json={"full_name": "Attendee 2", "document_id": "456"}
    )
    assert r.status_code == 200
    assert r.json()["full_name"] == "Attendee 2"

def test_register_attendee_inactive_event(
    client: TestClient, db: Session
) -> None:
    # 1. Setup Church and User
    church = create_random_church(db)
    user_in = UserCreate(email=random_email(), password=random_lower_string(), full_name="Test User", church_id=church.id, role=UserRole.DIGITER)
    user = crud.create_user(session=db, user_create=user_in)

    # 2. Setup Inactive Event
    event = create_random_event(db, total_quota=10)
    event.is_active = False
    db.add(event)
    db.commit()

    # 3. Invite Church
    link = EventChurchLink(event_id=event.id, church_id=church.id, quota_limit=10)
    db.add(link)
    db.commit()

    # 4. Login
    login_data = {"username": user.email, "password": user_in.password}
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 5. Register - FAIL (Event is not active)
    r = client.post(
        f"{settings.API_V1_STR}/events/events/{event.id}/register",
        headers=headers,
        json={"full_name": "Attendee 1", "document_id": "123"}
    )
    assert r.status_code == 400
    assert "EVENT_NOT_ACTIVE" in r.json()["detail"]

def test_get_event_attendees_isolation(
    client: TestClient, db: Session
) -> None:
    # 1. Setup Church A and User A (Digiter)
    church_a = create_random_church(db)
    user_a_in = UserCreate(email=random_email(), password="password", full_name="User A", church_id=church_a.id, role=UserRole.DIGITER)
    user_a = crud.create_user(session=db, user_create=user_a_in)

    # 2. Setup Church B
    church_b = create_random_church(db)

    # 3. Setup Event
    event = create_random_event(db)

    # 4. Invite both churches
    db.add(EventChurchLink(event_id=event.id, church_id=church_a.id, quota_limit=10))
    db.add(EventChurchLink(event_id=event.id, church_id=church_b.id, quota_limit=10))
    db.commit()

    # 5. Register Attendee from Church A
    db.add(Attendee(full_name="Att A", event_id=event.id, church_id=church_a.id, registered_by_id=user_a.id))
    # 6. Register Attendee from Church B
    db.add(Attendee(full_name="Att B", event_id=event.id, church_id=church_b.id, registered_by_id=user_a.id)) # (Using same user_a id for simplicity, though normally B would register their own)
    db.commit()

    # 7. Login as User A
    login_data = {"username": user_a.email, "password": user_a_in.password}
    r = client.post(f"{settings.API_V1_STR}/login/access-token", data=login_data)
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 8. Get attendees - SHOULD ONLY SEE Church A's attendee
    r = client.get(
        f"{settings.API_V1_STR}/events/events/{event.id}/attendees",
        headers=headers,
    )
    assert r.status_code == 200
    attendees = r.json()
    assert len(attendees) == 1
    assert attendees[0]["full_name"] == "Att A"

    # 9. Get attendees as SUPERUSER - SHOULD SEE ALL
    superuser_token_headers = {"Authorization": f"Bearer {client.post(f'{settings.API_V1_STR}/login/access-token', data={'username': settings.FIRST_SUPERUSER, 'password': settings.FIRST_SUPERUSER_PASSWORD}).json()['access_token']}"}
    r = client.get(
        f"{settings.API_V1_STR}/events/events/{event.id}/attendees",
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    assert len(r.json()) == 2
