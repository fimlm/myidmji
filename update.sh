#!/bin/bash
set -e

echo "⬇️  Bajando últimos cambios..."
git pull

echo "🚀 Reconstruyendo contenedores (PRODUCCIÓN)..."
# Asegurar que la red externa de Traefik existe
docker network create traefik-public 2>/dev/null || true

# No se incluye docker-compose.override.yml porque es solo para desarrollo local.
# Usamos solo el base y el de Traefik para producción.

docker compose -f docker-compose.yml -f docker-compose.traefik.yml up -d --build --remove-orphans

echo "✅ ¡Actualización completada! El sitio debería estar en línea en unos segundos."
