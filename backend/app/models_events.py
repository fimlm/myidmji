import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from .models import User

# --- Many-to-Many Link Table with Extra Data (Quota) ---
class EventChurchLink(SQLModel, table=True):
    event_id: uuid.UUID = Field(foreign_key="event.id", primary_key=True)
    church_id: uuid.UUID = Field(foreign_key="church.id", primary_key=True)
    quota_limit: int = Field(default=0, description="Max attendees allowed for this church in this event")
    registered_count: int = Field(default=0, description="Current number of registered attendees")

# --- Church Model ---
class ChurchBase(SQLModel):
    name: str = Field(min_length=1, max_length=255, unique=True, index=True)

class Church(ChurchBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)

    # Relationships
    users: list["User"] = Relationship(back_populates="church")
    events: list["Event"] = Relationship(back_populates="churches", link_model=EventChurchLink)
    attendees: list["Attendee"] = Relationship(back_populates="church")

class ChurchCreate(ChurchBase):
    pass

class ChurchPublic(ChurchBase):
    id: uuid.UUID

class ChurchesPublic(SQLModel):
    data: list[ChurchPublic]
    count: int


# --- Event Model ---
class EventBase(SQLModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    total_quota: int = Field(default=0, description="Overall capacity of the event")
    start_date: datetime | None = Field(default=None)
    end_date: datetime | None = Field(default=None)
    max_registration_date: datetime | None = Field(default=None, description="Deadline for registrations")
    is_active: bool = Field(default=True)

class Event(EventBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)

    # Relationships
    churches: list["Church"] = Relationship(back_populates="events", link_model=EventChurchLink)
    attendees: list["Attendee"] = Relationship(back_populates="event", cascade_delete=True)

class EventCreate(EventBase):
    pass

class EventUpdate(EventBase):
    name: str | None = None  # type: ignore
    description: str | None = None
    total_quota: int | None = None  # type: ignore
    is_active: bool | None = None  # type: ignore

class EventPublic(EventBase):
    id: uuid.UUID


# --- Attendee Model ---
class AttendeeBase(SQLModel):
    full_name: str = Field(min_length=1, max_length=255)
    document_id: str | None = Field(default=None, max_length=50, description="Optional ID document number")

class Attendee(AttendeeBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)

    event_id: uuid.UUID = Field(foreign_key="event.id")
    church_id: uuid.UUID = Field(foreign_key="church.id")
    registered_by_id: uuid.UUID = Field(foreign_key="user.id")

    # Relationships
    event: Event = Relationship(back_populates="attendees")
    church: Church = Relationship(back_populates="attendees")
    registered_by: "User" = Relationship()

class AttendeeCreate(AttendeeBase):
    pass

class AttendeePublic(AttendeeBase):
    id: uuid.UUID
    event_id: uuid.UUID
    church_id: uuid.UUID
    registered_by_email: str | None = None
    church_name: str | None = None
    event_name: str | None = None
