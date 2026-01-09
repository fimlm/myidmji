from sqlmodel import Session, create_engine, select

from app import crud
from app.core.config import settings
from app.models import User, UserCreate

engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))


# make sure all SQLModel models are imported (app.models) before initializing DB
# otherwise, SQLModel might fail to initialize relationships properly
# for more details: https://github.com/fastapi/full-stack-fastapi-template/issues/28


def init_db(session: Session) -> None:
    # Tables should be created with Alembic migrations
    # But if you don't want to use migrations, create
    # the tables un-commenting the next lines
    # from sqlmodel import SQLModel

    # This works because the models are already imported and registered from app.models
    # SQLModel.metadata.create_all(engine)

    user = session.exec(
        select(User).where(User.email == settings.FIRST_SUPERUSER)
    ).first()
    if not user:
        user_in = UserCreate(
            email=settings.FIRST_SUPERUSER,
            password=settings.FIRST_SUPERUSER_PASSWORD,
            is_superuser=True,
        )
        user = crud.create_user(session=session, user_create=user_in)

    # --- Seed Events & Churches ---
    import datetime

    from app.models_events import Church, Event, EventChurchLink

    # Data Structure
    seed_data = {
        "MIRA Madrid": [
            "Vallecas", "Leganés", "San Sebastian de los Reyes", "Torrejón de Ardoz",
            "Toledo", "Majadahonda", "Segovia"
        ],
        "MIRA Barcelona": [
            "Barcelona", "Sabadell", "Girona", "Tarragona", "Lleida", "Rubi"
        ],
        "MIRA Valencia": [
            "Valencia", "Alicante", "Castellón", "Torrevieja", "Elche", "Denia", "Benidorm", "Petrer"
        ]
    }


    
    # Specific Event Config (from user request)
    event_configs = {
        "MIRA Madrid": {"date": datetime.datetime(2026, 2, 1), "quota": 1300},
        "MIRA Barcelona": {"date": datetime.datetime(2026, 2, 2), "quota": 900},
        "MIRA Valencia": {"date": datetime.datetime(2026, 2, 3), "quota": 800},
    }

    current_year = 2026 # Force 2026 as per requirements

    for event_name, churches in seed_data.items():
        # 1. Create Event if not exists
        existing_event = session.exec(select(Event).where(Event.name == event_name)).first()
        if not existing_event:
            config = event_configs.get(event_name, {"date": datetime.datetime.now(), "quota": 1000})
            
            existing_event = Event(
                name=event_name,
                description=f"Evento en {event_name.replace('MIRA ', '')} {current_year}",
                start_date=config["date"],
                end_date=config["date"] + datetime.timedelta(hours=4), # Assume 4 hour duration
                max_registration_date=config["date"] - datetime.timedelta(days=1),
                total_quota=config["quota"],
                is_active=True
            )
            session.add(existing_event)
            session.commit()
            session.refresh(existing_event)

        # 2. Create Churches and Link
        for church_name in churches:
            existing_church = session.exec(select(Church).where(Church.name == church_name)).first()
            if not existing_church:
                existing_church = Church(name=church_name)
                session.add(existing_church)
                session.commit()
                session.refresh(existing_church)

            # 3. Link (if not linked)
            existing_link = session.get(EventChurchLink, (existing_event.id, existing_church.id))
            if not existing_link:
                link = EventChurchLink(
                    event_id=existing_event.id,
                    church_id=existing_church.id,
                    quota_limit=100 # Default per church
                )
                session.add(link)
                session.commit()
