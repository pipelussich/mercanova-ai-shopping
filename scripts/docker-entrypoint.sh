#!/bin/sh
# Arranque del contenedor: migraciones → seed (sólo si la base está vacía) → servidor.
set -e

echo "[mercanova] Aplicando migraciones…"
node dist-scripts/migrate.js

echo "[mercanova] Verificando datos iniciales…"
node dist-scripts/seed.js

if [ -z "$GEMINI_API_KEY" ]; then
  echo "[mercanova] AVISO: GEMINI_API_KEY no está configurada. La tienda funciona, pero el asistente y la voz quedan deshabilitados."
fi

echo "[mercanova] Listo: http://localhost:${PUBLISHED_PORT:-3000}"
exec node server.js
