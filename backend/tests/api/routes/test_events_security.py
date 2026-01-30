import pytest
import uuid
from datetime import datetime, timezone
from sqlmodel import Session
from app.api.routes import events
from app.models import User, UserRole
from app.models_events import Attendee, Event
from fastapi import HTTPException


# Mock objects
class MockUser:
    def __init__(self, role, id=None, is_superuser=False):
        self.role = role
        self.id = id or uuid.uuid4()
        self.is_superuser = is_superuser


def test_check_digiter_success():
    """Test that check_digiter allows allowed roles."""
    events.check_digiter(MockUser(UserRole.DIGITER))
    events.check_digiter(MockUser(UserRole.ADMIN))
    events.check_digiter(MockUser(UserRole.SUPERVISOR))
    events.check_digiter(MockUser("ANY", is_superuser=True))


def test_check_digiter_failure():
    """Test that check_digiter raises 403 for unauthorized roles."""
    with pytest.raises(HTTPException) as excinfo:
        events.check_digiter(MockUser("USER"))  # Regular user
    assert excinfo.value.status_code == 403


from unittest.mock import MagicMock


def test_checkin_attendee_security_logic():
    """
    Test the critical security logic inside checkin_attendee validation.
    This doesn't test the DB, but the python logic flows using mocks.
    """
    # Setup
    mock_session = MagicMock(spec=Session)
    current_user = MockUser(UserRole.DIGITER)
    event_id = uuid.uuid4()
    other_event_id = uuid.uuid4()
    attendee_id = uuid.uuid4()

    # Mock Attendee
    attendee = Attendee(
        id=attendee_id,
        event_id=event_id,
        full_name="Test",
        church_id=uuid.uuid4(),
        registered_by_id=uuid.uuid4(),
    )

    # 1. Test Attendee Not Found
    # When session.get returns None
    mock_session.get.side_effect = [None]
    with pytest.raises(HTTPException) as exc:
        events.checkin_attendee(
            session=mock_session,
            current_user=current_user,
            event_id=event_id,
            attendee_id=attendee_id,
        )
    assert exc.value.status_code == 404

    # Reset side_effect for next tests
    mock_session.get.side_effect = None
    mock_session.get.return_value = attendee

    # 2. Test Wrong Event (Security Check)
    # We must ensure attendee.event_id is different from the passed event_id
    with pytest.raises(HTTPException) as exc:
        events.checkin_attendee(
            session=mock_session,
            current_user=current_user,
            event_id=other_event_id,  # Trying to checkin to WRONG event
            attendee_id=attendee_id,
        )
    assert exc.value.status_code == 400

    # 3. Test Already Checked In (Integrity Check)
    attendee.checked_in_at = datetime.now()
    with pytest.raises(HTTPException) as exc:
        events.checkin_attendee(
            session=mock_session,
            current_user=current_user,
            event_id=event_id,
            attendee_id=attendee_id,
        )
    assert exc.value.status_code == 409

    # 4. Test Success & Data Integrity (Recording User ID)
    attendee.checked_in_at = None  # Reset
    result = events.checkin_attendee(
        session=mock_session,
        current_user=current_user,
        event_id=event_id,
        attendee_id=attendee_id,
    )

    assert result.checked_in_by_id == current_user.id  # CRITICAL CHECK
    assert result.checked_in_at is not None
