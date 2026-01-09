#!/bin/bash
set -e

echo "⬇️  Bajando últimos cambios..."
git pull

echo "🚀 Reconstruyendo contenedores..."
# Se incluye docker-compose.traefik.yml explícitamente porque contiene el servicio 'proxy' (Traefik)
# docker-compose.override.yml se carga automáticamente con docker-compose.yml si existe, 
# pero al usar -f explícito es mejor ser específico o confiar en la carga en cadena si usamos el nombre predeterminado.
# Para evitar errores: listamos todos.

docker compose -f docker-compose.yml -f docker-compose.override.yml -f docker-compose.traefik.yml up -d --build --remove-orphans

echo "✅ ¡Actualización completada! El sitio debería estar en línea en unos segundos."
