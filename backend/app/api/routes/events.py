import uuid
from typing import Any, cast

from fastapi import APIRouter, HTTPException
from sqlmodel import SQLModel, col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import User, UserPublic, UserRole
from app.models_events import (
    Attendee,
    AttendeeCreate,
    AttendeePublic,
    Church,
    ChurchCreate,
    ChurchesPublic,
    ChurchPublic,
    Event,
    EventChurchLink,
    EventCreate,
    EventPublic,
    EventUpdate,
)

router = APIRouter()


# --- Dependencies ---
def check_admin(user: User) -> None:
    if user.role != UserRole.ADMIN and not user.is_superuser:
        raise HTTPException(status_code=403, detail="Not enough permissions")

def check_digiter(user: User) -> None:
    if (
        user.role not in [UserRole.DIGITER, UserRole.ADMIN, UserRole.SUPERVISOR]
        and not user.is_superuser
    ):
        raise HTTPException(status_code=403, detail="Not enough permissions")

def check_supervisor(user: User) -> None:
    if (
        user.role not in [UserRole.ADMIN, UserRole.SUPERVISOR] and not user.is_superuser
    ):
        raise HTTPException(status_code=403, detail="Not enough permissions")


# --- Churches (Admin) ---
@router.post("/churches", response_model=ChurchPublic)
def create_church(
    *, session: SessionDep, current_user: CurrentUser, church_in: ChurchCreate
) -> Any:
    """Create new church."""
    check_admin(current_user)
    church = Church.model_validate(church_in)
    session.add(church)
    session.commit()
    session.refresh(church)
    return church


@router.get("/churches", response_model=ChurchesPublic)
def read_churches(
    session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 100
) -> Any:
    """Retrieve churches."""
    count_statement = select(func.count()).select_from(Church)
    count = session.exec(count_statement).one()
    statement = select(Church).offset(skip).limit(limit)
    churches = session.exec(statement).all()
    return ChurchesPublic(data=churches, count=count)


# --- Events (Admin) ---
@router.post("/events", response_model=EventPublic)
def create_event(
    *, session: SessionDep, current_user: CurrentUser, event_in: EventCreate
) -> Any:
    """Create new event."""
    check_admin(current_user)
    event = Event.model_validate(event_in)
    session.add(event)
    session.commit()
    session.refresh(event)
    return event


@router.get("/events", response_model=list[EventPublic])
def read_events(
    session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 100
) -> Any:
    """Retrieve events."""
    check_digiter(current_user)
    statement = select(Event).offset(skip).limit(limit)
    events = session.exec(statement).all()
    return events


@router.patch("/{event_id}", response_model=EventPublic)
def update_event(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    event_id: uuid.UUID,
    event_in: EventUpdate
) -> Any:
    """Update an event."""
    check_admin(current_user)
    db_event = session.get(Event, event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")

    update_data = event_in.model_dump(exclude_unset=True)
    db_event.sqlmodel_update(update_data)
    session.add(db_event)
    session.commit()
    session.refresh(db_event)
    return db_event


@router.put("/events/{event_id}/invite", response_model=EventPublic)
def invite_church_to_event(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    event_id: uuid.UUID,
    church_id: uuid.UUID,
    quota: int
) -> Any:
    """
    Invite a church to an event and assign quota.
    """
    check_admin(current_user)
    event = session.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    church = session.get(Church, church_id)
    if not church:
        raise HTTPException(status_code=404, detail="Church not found")

    # Check if link exists
    link = session.get(EventChurchLink, (event_id, church_id))
    if link:
        link.quota_limit = quota
        session.add(link)
    else:
        link = EventChurchLink(event_id=event_id, church_id=church_id, quota_limit=quota)
        session.add(link)

    session.commit()
    session.refresh(event)
    return event


@router.get("/events/{event_id}/churches", response_model=ChurchesPublic)
def get_event_churches(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    event_id: uuid.UUID
) -> Any:
    """
    Get all churches invited to this event.
    Accessible to all digiters (needed for onboarding).
    """
    check_digiter(current_user)

    # Get all links
    links_statement = select(EventChurchLink).where(EventChurchLink.event_id == event_id)
    links = session.exec(links_statement).all()
    church_ids = [link.church_id for link in links]

    if not church_ids:
        return ChurchesPublic(data=[], count=0)

    # Get church details
    churches_statement = select(Church).where(col(Church.id).in_(church_ids))
    churches = session.exec(churches_statement).all()

    return ChurchesPublic(data=churches, count=len(churches))


class EventStats(SQLModel):
    total_quota: int
    total_registered: int
    church_stats: list[dict[str, Any]]

@router.get("/events/{event_id}/stats", response_model=EventStats)
def get_event_stats(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    event_id: uuid.UUID
) -> Any:
    """
    Get detailed statistics for an event.
    """
    check_supervisor(current_user)
    event = session.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Get all links (churches invited)
    links = session.exec(select(EventChurchLink).where(EventChurchLink.event_id == event_id)).all()

    total_registered = sum(link.registered_count for link in links)

    church_stats = []
    for link in links:
        church = session.get(Church, link.church_id)
        church_name = church.name if church else "Unknown"
        # Optional: Count digiters for this church
        digiters_count = session.exec(
            select(func.count()).select_from(User).where(User.church_id == link.church_id, User.role == UserRole.DIGITER)
        ).one()

        church_stats.append({
            "church_id": link.church_id,
            "church_name": church_name,
            "quota_limit": link.quota_limit,
            "registered_count": link.registered_count,
            "digiters_count": digiters_count
        })

    return EventStats(
        total_quota=event.total_quota,
        total_registered=total_registered,
        church_stats=church_stats
    )


@router.get("/events/{event_id}/attendees", response_model=list[AttendeePublic])
def get_event_attendees(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    event_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100
) -> Any:
    """
    Get all attendees registered for an event.
    """
    check_digiter(current_user)

    # Base query
    statement = (
        select(Attendee, User.email)
        .join(User, cast(Any, Attendee.registered_by_id == User.id))
        .where(Attendee.event_id == event_id)
    )

    # Privacy Isolation: If not Admin/Supervisor, only show attendees from their own church
    is_admin_or_supervisor = current_user.is_superuser or current_user.role in [UserRole.ADMIN, UserRole.SUPERVISOR]

    if not is_admin_or_supervisor:
        if current_user.church_id:
            statement = statement.where(Attendee.church_id == current_user.church_id)
        else:
            # If for some reason a digiter has no church_id, they see nothing
            return []

    attendees_data = session.exec(
        statement.offset(skip).limit(limit)
    ).all()

    results = []
    for attendee, email in attendees_data:
        attendee_public = AttendeePublic.model_validate(attendee)
        attendee_public.registered_by_email = email
        results.append(attendee_public)

    return results


@router.get("/events/{event_id}/digiters", response_model=list[UserPublic])
def get_event_digiters(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    event_id: uuid.UUID
) -> Any:
    """
    Get all digiters associated with churches invited to this event.
    """
    check_admin(current_user)

    # 1. Get churches linked to this event
    links = session.exec(select(EventChurchLink).where(EventChurchLink.event_id == event_id)).all()
    church_ids = [link.church_id for link in links]

    if not church_ids:
        return []

    # 2. Get users with role DIGITER in these churches
    digiters = session.exec(
        select(User)
        .where(col(User.church_id).in_(church_ids))
        .where(User.role == UserRole.DIGITER)
    ).all()

    return digiters


@router.get("/my-events", response_model=list[EventPublic])
def get_my_events(
    *,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Get all active events that the current user's church is invited to.
    """
    if not current_user.church_id:
        return []

    # Get all active events where this church has a link
    statement = (
        select(Event)
        .join(EventChurchLink)
        .where(
            EventChurchLink.church_id == current_user.church_id,
            Event.is_active == True
        )
    )

    events = session.exec(statement).all()
    return events


# --- Extras ---
class ChurchInvite(SQLModel):
    church_id: uuid.UUID
    quota: int

class BulkInviteRequest(SQLModel):
    invites: list[ChurchInvite]


@router.put("/events/{event_id}/invite-bulk")
def invite_churches_bulk(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    event_id: uuid.UUID,
    data: BulkInviteRequest
) -> Any:
    """
    Invite multiple churches to an event with quotas.
    """
    check_admin(current_user)
    event = session.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Process invites
    for invite in data.invites:
        link = session.get(EventChurchLink, (event_id, invite.church_id))
        if link:
            link.quota_limit = invite.quota
            session.add(link)
        else:
            link = EventChurchLink(event_id=event_id, church_id=invite.church_id, quota_limit=invite.quota)
            session.add(link)

    session.commit()
    return {"message": "Invites processed successfully"}


class ChurchInviteCreate(SQLModel):
    name: str
    quota: int

class BulkInviteCreateRequest(SQLModel):
    invites: list[ChurchInviteCreate]

@router.put("/events/{event_id}/invite-create-bulk")
def invite_churches_create_bulk(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    event_id: uuid.UUID,
    data: BulkInviteCreateRequest
) -> Any:
    """
    Invite multiple churches by NAME.
    If church exists, use it. If not, create it.
    Then set quota.
    """
    check_admin(current_user)
    event = session.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    for invite in data.invites:
        # Find or Create Church
        # Note: Church names are unique
        church = session.exec(select(Church).where(Church.name == invite.name)).first()
        if not church:
            church = Church(name=invite.name)
            session.add(church)
            session.commit()
            session.refresh(church)

        # Link to Event
        link = session.get(EventChurchLink, (event_id, church.id))
        if link:
            link.quota_limit = invite.quota
            session.add(link)
        else:
            link = EventChurchLink(event_id=event_id, church_id=church.id, quota_limit=invite.quota)
            session.add(link)

    session.commit()
    return {"message": "Bulk invites processed successfully"}

# --- Attendees (Digiter) ---
@router.post("/events/{event_id}/register", response_model=AttendeePublic)
def register_attendee(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    event_id: uuid.UUID,
    attendee_in: AttendeeCreate
) -> Any:
    """
    Register an attendee for an event.
    Transactional check: Ensures Church Quota is not exceeded and Date is valid.
    """
    check_digiter(current_user)

    # Get Event and lock it to prevent race conditions on global quota validation
    event_statement = select(Event).where(Event.id == event_id).with_for_update()
    event = session.exec(event_statement).first()

    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if not event.is_active:
        raise HTTPException(status_code=400, detail="Event is not active")

    # Date Validation
    from datetime import datetime
    if event.max_registration_date and datetime.now() > event.max_registration_date:
        raise HTTPException(status_code=400, detail="Event registration is closed")

    if not current_user.church_id:
        raise HTTPException(status_code=400, detail="User does not belong to any church")

    # Lock the Link row for update to prevent race conditions
    statement = select(EventChurchLink).where(
        EventChurchLink.event_id == event_id,
        EventChurchLink.church_id == current_user.church_id
    ).with_for_update()

    link = session.exec(statement).first()

    if not link:
        raise HTTPException(status_code=400, detail="Your church is not invited to this event")

    # --- Global Quota Validation ---
     # Calculate current total registrations for this event across all churches
    total_reg_statement: Any = select(func.sum(EventChurchLink.registered_count)).where(
        EventChurchLink.event_id == event_id
    )
    total_registered = session.exec(total_reg_statement).one() or 0

    if total_registered >= event.total_quota:
        raise HTTPException(
            status_code=400,
            detail=f"Event total quota exceeded ({event.total_quota}). No more registrations allowed."
        )

    # Note: We still use the link quota for reference, but we don't block registration
    # if the church exceeded its specific quota, as requested by the user.
    # We only block if the EVENT total quota is reached.

    # Create Attendee
    attendee = Attendee(
        **attendee_in.model_dump(),
        event_id=event_id,
        church_id=current_user.church_id,
        registered_by_id=current_user.id
    )
    session.add(attendee)

    # Update count
    link.registered_count += 1
    session.add(link)

    session.commit()
    session.refresh(attendee)

    # Convert to AttendeePublic and populate metadata for the frontend
    # Since AttendeePublic is the response_model, FastAPI will handle the conversion
    # if we return the object, but we want to ensure these extra fields are set.
    res = AttendeePublic.model_validate(attendee)
    res.registered_by_email = current_user.email
    res.event_name = event.name
    
    church = session.get(Church, attendee.church_id)
    if church:
        res.church_name = church.name

    return res
