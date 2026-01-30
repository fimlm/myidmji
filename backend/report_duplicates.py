import uuid
from typing import Any
from sqlmodel import Session, select, func, col
from app.core.db import engine
from app.models_events import Attendee, Event

def report_duplicates():
    with Session(engine) as session:
        # Final result structure: {event_name: {document_id: count}}
        results = {}
        
        # Get all events to iterate or just focus on active ones? 
        # Better to check all for a full report.
        events = session.exec(select(Event)).all()
        
        total_duplicates_found = 0
        
        for event in events:
            # Query for document_ids that appear more than once for this event
            # Note: We filter out null/empty document_id if necessary, 
            # but usually duplicates are relevant for IDs.
            statement = (
                select(Attendee.document_id, func.count(Attendee.id).label("count"))
                .where(Attendee.event_id == event.id)
                .where(Attendee.document_id != None)
                .where(Attendee.document_id != "")
                .group_by(Attendee.document_id)
                .having(func.count(Attendee.id) > 1)
            )
            
            duplicates = session.exec(statement).all()
            
            if duplicates:
                event_dupes = {}
                for doc_id, count in duplicates:
                    event_dupes[doc_id] = count
                    total_duplicates_found += (count - 1)
                results[event.name] = event_dupes

        if not results:
            print("✅ No se encontraron registros duplicados por Document ID en ningún evento.")
            return

        print(f"🔍 Reporte de Duplicados (Se encontraron {total_duplicates_found} registros sobrantes):")
        print("-" * 50)
        for event_name, dupes in results.items():
            print(f"Evento: {event_name}")
            for doc_id, count in dupes.items():
                print(f"  - Documento {doc_id}: {count} veces")
        print("-" * 50)

if __name__ == "__main__":
    report_duplicates()
