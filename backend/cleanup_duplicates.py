import uuid
from typing import Any
from sqlmodel import Session, select, func, col, delete
from app.core.db import engine
from app.models_events import Attendee, Event, EventChurchLink

def cleanup_and_sync():
    """
    1. Borra registros duplicados (mismo document_id en el mismo evento).
    2. Sincroniza los contadores de las iglesias con la realidad de la tabla de asistentes.
    """
    with Session(engine) as session:
        events = session.exec(select(Event)).all()
        
        total_deleted = 0
        
        # --- PASO 1: Limpiar Duplicados ---
        for event in events:
            statement = (
                select(Attendee.document_id)
                .where(Attendee.event_id == event.id)
                .where(Attendee.document_id != None)
                .where(Attendee.document_id != "")
                .group_by(Attendee.document_id)
                .having(func.count(Attendee.id) > 1)
            )
            duplicate_ids = session.exec(statement).all()
            
            for doc_id in duplicate_ids:
                attendees = session.exec(
                    select(Attendee)
                    .where(Attendee.event_id == event.id, Attendee.document_id == doc_id)
                    .order_by(Attendee.created_at.asc())
                ).all()
                
                if len(attendees) > 1:
                    to_delete = attendees[:-1] # Mantener el último
                    for a in to_delete:
                        session.delete(a)
                        total_deleted += 1
        
        session.commit() # Guardar borrados antes de sincronizar
        
        # --- PASO 2: Sincronización Total de Contadores ---
        print("🔄 Sincronizando contadores de iglesias...")
        links = session.exec(select(EventChurchLink)).all()
        synced_count = 0
        
        for link in links:
            # Contar cuántos asistentes reales hay para esta iglesia en este evento
            actual_count = session.exec(
                select(func.count(Attendee.id))
                .where(Attendee.event_id == link.event_id, Attendee.church_id == link.church_id)
            ).one()
            
            if link.registered_count != actual_count:
                print(f"  - Corrigiendo {link.event_id}/{link.church_id}: {link.registered_count} -> {actual_count}")
                link.registered_count = actual_count
                session.add(link)
                synced_count += 1
        
        session.commit()
        
        print(f"✅ Limpieza completada.")
        print(f"   - Registros duplicados eliminados: {total_deleted}")
        print(f"   - Contadores sincronizados: {synced_count}")

if __name__ == "__main__":
    cleanup_and_sync()
