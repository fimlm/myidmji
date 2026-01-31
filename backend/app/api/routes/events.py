import uuid
from datetime import datetime, timezone
from typing import Any, Annotated, cast

import csv
import io
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import SQLModel, col, func, or_, select

from app.api.deps import CurrentUser, SessionDep, get_current_active_superuser
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
    if user.role not in [UserRole.ADMIN, UserRole.SUPERVISOR] and not user.is_superuser:
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
@router.post("/", response_model=EventPublic)
def create_event(
    *, session: SessionDep, current_user: CurrentUser, event_in: EventCreate
) -> Any:
    """Create new event."""
    check_supervisor(current_user)
    event = Event.model_validate(event_in)
    session.add(event)
    session.commit()
    session.refresh(event)
    return event


@router.get("/", response_model=list[EventPublic])
def read_events(
    session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 100
) -> Any:
    """Retrieve events."""
    if current_user.is_superuser or current_user.role in [
        UserRole.ADMIN,
        UserRole.SUPERVISOR,
    ]:
        statement = select(Event).offset(skip).limit(limit)
    else:
        if not current_user.church_id:
            # Bug fix: allow users without a church (newly registered) to see all active events for onboarding/setup
            statement = (
                select(Event).where(Event.is_active == True).offset(skip).limit(limit)
            )
        else:
            statement = (
                select(Event)
                .join(EventChurchLink)
                .where(
                    EventChurchLink.church_id == current_user.church_id,
                    Event.is_active,
                )
                .offset(skip)
                .limit(limit)
            )

    events = session.exec(statement).all()
    return events


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
            EventChurchLink.church_id == current_user.church_id, Event.is_active == True
        )
    )

    events = session.exec(statement).all()
    return events


@router.get("/{event_id}", response_model=EventPublic)
def read_event(
    *, session: SessionDep, current_user: CurrentUser, event_id: uuid.UUID
) -> Any:
    """Get event by ID."""
    event = session.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.patch("/{event_id}", response_model=EventPublic)
def update_event(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    event_id: uuid.UUID,
    event_in: EventUpdate,
) -> Any:
    """Update an event."""
    check_supervisor(current_user)
    db_event = session.get(Event, event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")

    update_data = event_in.model_dump(exclude_unset=True)
    db_event.sqlmodel_update(update_data)
    session.add(db_event)
    session.commit()
    session.refresh(db_event)
    return db_event


@router.put("/{event_id}/invite", response_model=EventPublic)
def invite_church_to_event(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    event_id: uuid.UUID,
    church_id: uuid.UUID,
    quota: int,
) -> Any:
    """
    Invite a church to an event and assign quota.
    """
    check_supervisor(current_user)
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
        link = EventChurchLink(
            event_id=event_id, church_id=church_id, quota_limit=quota
        )
        session.add(link)

    session.commit()
    session.refresh(event)
    return event


@router.get("/{event_id}/churches", response_model=ChurchesPublic)
def get_event_churches(
    *, session: SessionDep, current_user: CurrentUser, event_id: uuid.UUID
) -> Any:
    """
    Get all churches invited to this event.
    Accessible to all logged in users (needed for onboarding).
    """

    # Get all links
    links_statement = select(EventChurchLink).where(
        EventChurchLink.event_id == event_id
    )
    links = session.exec(links_statement).all()
    church_ids = [link.church_id for link in links]

    if not church_ids:
        return ChurchesPublic(data=[], count=0)

    # Get church details
    churches_statement = select(Church).where(col(Church.id).in_(church_ids))
    churches = session.exec(churches_statement).all()

    return ChurchesPublic(data=churches, count=len(churches))


class EventStats(SQLModel):
    event_name: str
    total_quota: int
    total_registered: int
    checked_in_count: int
    church_stats: list[dict[str, Any]]


@router.get("/{event_id}/my-registration-count", response_model=int)
def get_my_registration_count(
    *, session: SessionDep, current_user: CurrentUser, event_id: uuid.UUID
) -> Any:
    """
    Get the total number of approved/registered attendees by the current user for this event.
    """
    check_digiter(current_user)
    count = session.exec(
        select(func.count(Attendee.id)).where(
            Attendee.event_id == event_id, Attendee.registered_by_id == current_user.id
        )
    ).one()
    return count or 0


@router.get("/{event_id}/stats", response_model=EventStats)
def get_event_stats(
    *, session: SessionDep, current_user: CurrentUser, event_id: uuid.UUID
) -> Any:
    """
    Get detailed statistics for an event.
    """
    check_supervisor(current_user)
    event = session.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Get all links (churches invited)
    links = session.exec(
        select(EventChurchLink).where(EventChurchLink.event_id == event_id)
    ).all()

    total_registered = sum(link.registered_count for link in links)

    church_stats = []
    for link in links:
        church = session.get(Church, link.church_id)
        church_name = church.name if church else "Unknown"
        # Optional: Count digiters for this church
        digiters_count = session.exec(
            select(func.count())
            .select_from(User)
            .where(User.church_id == link.church_id, User.role == UserRole.DIGITER)
        ).one()

        church_stats.append(
            {
                "church_id": link.church_id,
                "church_name": church_name,
                "quota_limit": link.quota_limit,
                "registered_count": link.registered_count,
                "checked_in_count": session.exec(
                    select(func.count())
                    .select_from(Attendee)
                    .where(
                        Attendee.event_id == event_id,
                        Attendee.church_id == link.church_id,
                        Attendee.checked_in_at is not None,
                    )
                ).one(),
                "digiters_count": digiters_count,
            }
        )

    checked_in_count = session.exec(
        select(func.count())
        .select_from(Attendee)
        .where(Attendee.event_id == event_id, Attendee.checked_in_at != None)
    ).one()

    return EventStats(
        event_name=event.name,
        total_quota=event.total_quota,
        total_registered=total_registered,
        checked_in_count=checked_in_count,
        church_stats=church_stats,
    )


@router.get("/{event_id}/attendees", response_model=list[AttendeePublic])
def get_event_attendees(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    event_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
    q: str | None = None,
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

    if q:
        statement = statement.where(
            or_(
                col(Attendee.full_name).ilike(f"%{q}%"),
                col(Attendee.document_id).ilike(f"%{q}%"),
            )
        )

    # Privacy Isolation: If not Admin/Supervisor, only show attendees from their own church
    is_admin_or_supervisor = current_user.is_superuser or current_user.role in [
        UserRole.ADMIN,
        UserRole.SUPERVISOR,
    ]

    if not is_admin_or_supervisor:
        if current_user.church_id:
            statement = statement.where(Attendee.church_id == current_user.church_id)
        else:
            # If for some reason a digiter has no church_id, they see nothing
            return []

    attendees_data = session.exec(statement.offset(skip).limit(limit)).all()

    results = []
    for attendee, email in attendees_data:
        attendee_public = AttendeePublic.model_validate(attendee)
        attendee_public.registered_by_email = email
        results.append(attendee_public)

    return results


@router.get("/{event_id}/attendees/export-csv")
def get_event_attendees_csv(
    *,
    session: SessionDep,
    current_user: Annotated[User, Depends(get_current_active_superuser)],
    event_id: uuid.UUID,
) -> Any:
    """
    Export all attendees for an event to CSV.
    Superadmin only.
    """
    statement = (
        select(Attendee, Church.name, User.email)
        .join(Church, cast(Any, Attendee.church_id == Church.id))
        .join(User, cast(Any, Attendee.registered_by_id == User.id))
        .where(Attendee.event_id == event_id)
    )
    results = session.exec(statement).all()

    output = io.StringIO()
    output.write("\ufeff")  # UTF-8 BOM for Microsoft Excel
    writer = csv.writer(output)

    # Header
    writer.writerow(
        [
            "Full Name",
            "Document ID",
            "Church (Iglesia)",
            "Registered By (Email)",
            "Registration Date",
            "Checked-in At",
        ]
    )

    for attendee, church_name, email in results:
        writer.writerow(
            [
                attendee.full_name,
                attendee.document_id or "N/A",
                church_name,
                email,
                attendee.created_at.strftime("%Y-%m-%d %H:%M:%S")
                if attendee.created_at
                else "N/A",
                attendee.checked_in_at.strftime("%Y-%m-%d %H:%M:%S")
                if attendee.checked_in_at
                else "N/A",
            ]
        )

    output.seek(0)
    filename = f"attendees_event_{event_id}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/{event_id}/digiters", response_model=list[UserPublic])
def get_event_digiters(
    *, session: SessionDep, current_user: CurrentUser, event_id: uuid.UUID
) -> Any:
    """
    Get all digiters associated with churches invited to this event.
    """
    check_supervisor(current_user)

    # 1. Get churches linked to this event
    links = session.exec(
        select(EventChurchLink).where(EventChurchLink.event_id == event_id)
    ).all()
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


# --- Extras ---
class ChurchInvite(SQLModel):
    church_id: uuid.UUID
    quota: int


class BulkInviteRequest(SQLModel):
    invites: list[ChurchInvite]


@router.put("/{event_id}/invite-bulk")
def invite_churches_bulk(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    event_id: uuid.UUID,
    data: BulkInviteRequest,
) -> Any:
    """
    Invite multiple churches to an event with quotas.
    """
    check_supervisor(current_user)
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
            link = EventChurchLink(
                event_id=event_id, church_id=invite.church_id, quota_limit=invite.quota
            )
            session.add(link)

    session.commit()
    return {"message": "Invites processed successfully"}


class ChurchInviteCreate(SQLModel):
    name: str
    quota: int


class BulkInviteCreateRequest(SQLModel):
    invites: list[ChurchInviteCreate]


@router.put("/{event_id}/invite-create-bulk")
def invite_churches_create_bulk(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    event_id: uuid.UUID,
    data: BulkInviteCreateRequest,
) -> Any:
    """
    Invite multiple churches by NAME.
    If church exists, use it. If not, create it.
    Then set quota.
    """
    check_supervisor(current_user)
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
            link = EventChurchLink(
                event_id=event_id, church_id=church.id, quota_limit=invite.quota
            )
            session.add(link)

    session.commit()
    return {"message": "Bulk invites processed successfully"}


# --- Attendees (Digiter) ---
@router.post("/{event_id}/register", response_model=AttendeePublic)
def register_attendee(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    event_id: uuid.UUID,
    attendee_in: AttendeeCreate,
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
        raise HTTPException(status_code=400, detail="EVENT_NOT_ACTIVE")

    # Date Validation
    from datetime import datetime

    if event.max_registration_date and datetime.now() > event.max_registration_date:
        raise HTTPException(status_code=400, detail="EVENT_REGISTRATION_CLOSED")

    if not current_user.church_id:
        raise HTTPException(status_code=400, detail="USER_NO_CHURCH")

    # Lock the Link row for update to prevent race conditions
    statement = (
        select(EventChurchLink)
        .where(
            EventChurchLink.event_id == event_id,
            EventChurchLink.church_id == current_user.church_id,
        )
        .with_for_update()
    )

    link = session.exec(statement).first()

    if not link:
        raise HTTPException(status_code=400, detail="CHURCH_NOT_INVITED")

    # --- Global Quota Validation ---
    # Calculate current total registrations for this event across all churches
    total_reg_statement: Any = select(func.sum(EventChurchLink.registered_count)).where(
        EventChurchLink.event_id == event_id
    )
    total_registered = session.exec(total_reg_statement).one() or 0

    if total_registered >= event.total_quota:
        raise HTTPException(status_code=400, detail="EVENT_QUOTA_EXCEEDED")

    # Note: We still use the link quota for reference, but we don't block registration
    # if the church exceeded its specific quota, as requested by the user.
    # We only block if the EVENT total quota is reached.

    # Create Attendee
    attendee = Attendee(
        **attendee_in.model_dump(),
        event_id=event_id,
        church_id=current_user.church_id,
        registered_by_id=current_user.id,
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


@router.get("/{event_id}/attendees/search", response_model=AttendeePublic)
def search_attendee_by_document(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    event_id: uuid.UUID,
    document_id: str,
) -> Any:
    """
    Search for an attendee by document ID within a specific event.
    Digiter can only search within their own church.
    Admin/Supervisor can search globally (optional - for now sticking to strict logic).
    """
    check_digiter(current_user)

    statement = select(Attendee).where(
        Attendee.event_id == event_id, Attendee.document_id == document_id
    )

    is_admin_or_supervisor = current_user.is_superuser or current_user.role in [
        UserRole.ADMIN,
        UserRole.SUPERVISOR,
    ]

    if not is_admin_or_supervisor:
        if not current_user.church_id:
            raise HTTPException(status_code=403, detail="User not linked to a church")
        statement = statement.where(Attendee.church_id == current_user.church_id)

    attendee = session.exec(statement).first()

    if not attendee:
        raise HTTPException(status_code=404, detail="Attendee not found")

    # Hydrate additional fields
    res = AttendeePublic.model_validate(attendee)

    # Get registered_by email
    register_user = session.get(User, attendee.registered_by_id)
    if register_user:
        res.registered_by_email = register_user.email

    # Get Event Name
    event = session.get(Event, event_id)
    if event:
        res.event_name = event.name

    # Get Church Name
    church = session.get(Church, attendee.church_id)
    if church:
        res.church_name = church.name

    return res


@router.get("/{event_id}/attendees/search-by-name", response_model=list[AttendeePublic])
def search_attendee_by_name(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    event_id: uuid.UUID,
    q: str,
    limit: int = 10,
) -> Any:
    """
    Search for attendees by name (fuzzy match) within a specific event.
    Digiter can only search within their own church.
    """
    check_digiter(current_user)

    if len(q) < 3:
        raise HTTPException(
            status_code=400, detail="Query string too short (min 3 chars)"
        )

    statement = select(Attendee).where(
        Attendee.event_id == event_id, col(Attendee.full_name).ilike(f"%{q}%")
    )

    is_admin_or_supervisor = current_user.is_superuser or current_user.role in [
        UserRole.ADMIN,
        UserRole.SUPERVISOR,
    ]

    if not is_admin_or_supervisor:
        if not current_user.church_id:
            raise HTTPException(status_code=403, detail="User not linked to a church")
        statement = statement.where(Attendee.church_id == current_user.church_id)

    # Limit results to prevent overload
    attendees = session.exec(statement.limit(limit)).all()

    results = []
    for attendee in attendees:
        res = AttendeePublic.model_validate(attendee)
        # Populate Church Name (useful for confirmation)
        church = session.get(Church, attendee.church_id)
        if church:
            res.church_name = church.name
        results.append(res)

    return results


@router.delete("/{event_id}/attendees/{attendee_id}", response_model=dict[str, str])
def delete_attendee(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    event_id: uuid.UUID,
    attendee_id: uuid.UUID,
) -> Any:
    """
    Delete an attendee and restore quota.
    """
    check_digiter(current_user)

    attendee = session.get(Attendee, attendee_id)
    if not attendee:
        raise HTTPException(status_code=404, detail="Attendee not found")

    if attendee.event_id != event_id:
        raise HTTPException(
            status_code=400, detail="Attendee does not belong to this event"
        )

    # Permission check: For now, we allow global delete for Digiters as per user feedback
    # (Previously restricted to own church)
    pass

    # Lock EventChurchLink to update quota safely
    link = session.exec(
        select(EventChurchLink)
        .where(
            EventChurchLink.event_id == event_id,
            EventChurchLink.church_id == attendee.church_id,
        )
        .with_for_update()
    ).first()

    if link:
        if link.registered_count > 0:
            link.registered_count -= 1
            session.add(link)

    session.delete(attendee)
    session.commit()

    return {"message": "Attendee deleted successfully and quota restored"}


@router.get("/{event_id}/duplicates", response_model=list[dict[str, Any]])
def get_event_duplicates(
    *, session: SessionDep, current_user: CurrentUser, event_id: uuid.UUID
) -> Any:
    """
    Get groups of attendees that share the same document_id for a specific event.
    """
    check_admin(current_user)

    # Encontrar document_ids duplicados
    statement = (
        select(Attendee.document_id)
        .where(Attendee.event_id == event_id)
        .where(Attendee.document_id is not None)
        .where(Attendee.document_id != "")
        .group_by(Attendee.document_id)
        .having(func.count(Attendee.id) > 1)
    )
    duplicate_ids = session.exec(statement).all()

    results = []
    for doc_id in duplicate_ids:
        attendees = session.exec(
            select(Attendee)
            .where(Attendee.event_id == event_id, Attendee.document_id == doc_id)
            .order_by(col(Attendee.created_at).desc())
        ).all()

        results.append(
            {
                "document_id": doc_id,
                "count": len(attendees),
                "attendees": [AttendeePublic.model_validate(a) for a in attendees],
            }
        )

    return results


@router.post("/{event_id}/duplicates/cleanup", response_model=dict[str, Any])
def cleanup_event_duplicates(
    *, session: SessionDep, current_user: CurrentUser, event_id: uuid.UUID
) -> Any:
    """
    Delete duplicate attendee registrations, keeping only the most recent one.
    Also synchronizes church counts.
    """
    check_admin(current_user)

    # 1. Identificar duplicados
    statement = (
        select(Attendee.document_id)
        .where(Attendee.event_id == event_id)
        .where(Attendee.document_id != None)
        .where(Attendee.document_id != "")
        .group_by(Attendee.document_id)
        .having(func.count(Attendee.id) > 1)
    )
    duplicate_ids = session.exec(statement).all()

    total_deleted = 0
    impacted_church_ids = set()
    for doc_id in duplicate_ids:
        attendees = session.exec(
            select(Attendee)
            .where(Attendee.event_id == event_id, Attendee.document_id == doc_id)
            .order_by(col(Attendee.created_at).desc())  # El más reciente primero
        ).all()

        # Mantener el primero (más reciente), borrar el resto
        to_delete = attendees[1:]
        for a in to_delete:
            impacted_church_ids.add(a.church_id)
            session.delete(a)
            total_deleted += 1

    session.commit()

    # 2. Resincronizar contadores para las iglesias afectadas (o todas por seguridad)
    # Por ahora solo las afectadas para eficiencia
    synced_churches = 0
    for church_id in impacted_church_ids:
        link = session.exec(
            select(EventChurchLink).where(
                EventChurchLink.event_id == event_id,
                EventChurchLink.church_id == church_id,
            )
        ).first()

        if link:
            actual_count = session.exec(
                select(func.count(Attendee.id)).where(
                    Attendee.event_id == event_id, Attendee.church_id == church_id
                )
            ).one()
            link.registered_count = actual_count
            session.add(link)
            synced_churches += 1

    session.commit()

    return {
        "message": f"Successfully cleaned up {total_deleted} duplicates across {synced_churches} churches.",
        "deleted_count": total_deleted,
        "synced_churches": synced_churches,
    }


@router.post(
    "/{event_id}/attendees/{attendee_id}/checkin", response_model=AttendeePublic
)
def checkin_attendee(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    event_id: uuid.UUID,
    attendee_id: uuid.UUID,
) -> Any:
    """
    Mark an attendee as checked in.
    """
    check_digiter(current_user)
    attendee = session.get(Attendee, attendee_id)

    if not attendee:
        raise HTTPException(status_code=404, detail="Attendee not found")

    if attendee.event_id != event_id:
        raise HTTPException(
            status_code=400, detail="Attendee does not belong to this event"
        )

    if attendee.checked_in_at:
        raise HTTPException(status_code=409, detail="Attendee already checked in")

    attendee.checked_in_at = datetime.now(timezone.utc)
    attendee.checked_in_by_id = current_user.id
    session.add(attendee)
    session.commit()
    session.refresh(attendee)
    return attendee
