# syntax=docker/dockerfile:1
# Imagen de la app MercaNova: Next.js standalone + scripts de migración/seed autocontenidos.

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# La app se compila sin variables de entorno: todo lo que depende de la DB o de Gemini es dinámico.
RUN npm run build && npx tsup

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/drizzle ./drizzle
COPY --from=build --chown=app:app /app/data ./data
COPY --from=build --chown=app:app /app/dist-scripts ./dist-scripts
COPY --chown=app:app scripts/docker-entrypoint.sh ./docker-entrypoint.sh
USER app
EXPOSE 3000
ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
