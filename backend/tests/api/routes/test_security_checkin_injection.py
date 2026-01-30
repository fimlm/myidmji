import pytest
import uuid
from fastapi.testclient import TestClient
from sqlmodel import Session
from app.api.routes import events
from app.models import User, UserRole
from app.models_events import Attendee, Event, Church
from fastapi import HTTPException
from app.main import app
from app.core.config import settings

# We will use the TestClient to simulate HTTP requests (Penetration Test)


def test_idor_checkin_other_event(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
):
    """
    IDOR Test: A user should not be able to check-in an attendee to an event they are not assigned to (or simply mismatch).
    In this system, any Digiter can check-in to any event they have access to, but the ATTENDEE must belong to that event.
    """
    # 1. Create Event A
    event = Event(name="Event A", total_quota=100)
    db.add(event)
    db.commit()

    # 2. Create Event B
    event_b = Event(name="Event B", total_quota=100)
    db.add(event_b)
    db.commit()

    # 3. Create real church and user for attendee
    church = Church(name=f"Double Church {uuid.uuid4()}")
    db.add(church)
    db.commit()

    user = User(
        email=f"victim_{uuid.uuid4()}@example.com",
        hashed_password="hashed",
        full_name="Victim",
        role=UserRole.USER,
        church_id=church.id,
    )
    db.add(user)
    db.commit()

    attendee = Attendee(
        event_id=event_b.id,
        full_name="Victim User",
        church_id=church.id,
        registered_by_id=user.id,
    )
    db.add(attendee)
    db.commit()

    # 4. Attack: Try to check-in Attendee B into Event A
    # POST /events/{event_id}/attendees/{attendee_id}/checkin
    response = client.post(
        f"{settings.API_V1_STR}/events/{event.id}/attendees/{attendee.id}/checkin",
        headers=superuser_token_headers,
    )

    # Expectation: 400 Bad Request (Attendee does not belong to this event)
    # This proves the backend validates the relationship between Event and Attendee
    assert response.status_code == 400
    assert response.json()["detail"] == "Attendee does not belong to this event"


def test_checkin_double_submission(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
):
    """
    Race Condition / Logic Test: Double check-in should fail.
    """
    event = Event(name="Event Race", total_quota=100)
    db.add(event)
    db.commit()

    church = Church(name=f"Double Church {uuid.uuid4()}")
    db.add(church)
    db.commit()

    user = User(
        email=f"runner_{uuid.uuid4()}@example.com",
        hashed_password="hashed",
        full_name="Runner",
        role=UserRole.USER,
        church_id=church.id,
    )
    db.add(user)
    db.commit()

    attendee = Attendee(
        event_id=event.id,
        full_name="Runner",
        church_id=church.id,
        registered_by_id=user.id,
    )
    db.add(attendee)
    db.commit()

    # 1. First Check-in (Legit)
    response1 = client.post(
        f"{settings.API_V1_STR}/events/{event.id}/attendees/{attendee.id}/checkin",
        headers=superuser_token_headers,
    )
    assert response1.status_code == 200

    # 2. Second Check-in (Replay Attack)
    response2 = client.post(
        f"{settings.API_V1_STR}/events/{event.id}/attendees/{attendee.id}/checkin",
        headers=superuser_token_headers,
    )
    assert response2.status_code == 409  # Conflict
    assert response2.json()["detail"] == "Attendee already checked in"


def test_sql_injection_attempt(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
):
    """
    Injection Test: Try to pass SQL payload in UUID fields.
    FastAPI validation should block this before it hits the DB.
    """
    event_id = "550e8400-e29b-41d4-a716-446655440000"  # Valid UUID
    # Malformed UUID with SQL injection attempt
    malformed_id = "550e8400-e29b-41d4-a716-446655440000' OR '1'='1"

    response = client.post(
        f"{settings.API_V1_STR}/events/{event_id}/attendees/{malformed_id}/checkin",
        headers=superuser_token_headers,
    )

    # Expectation: 422 Unprocessable Entity (Validation Error)
    # Pydantic should reject the non-UUID format immediately.
    assert response.status_code == 422
