FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci && mkdir -p apps/api/node_modules

FROM dependencies AS builder
WORKDIR /app
COPY . .
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm run prisma:generate -w @inmobiliaria/api && npm run build -w @inmobiliaria/api

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --chown=node:node package*.json ./
COPY --chown=node:node apps/api/package.json apps/api/package.json
COPY --chown=node:node apps/web/package.json apps/web/package.json
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/apps/api/node_modules apps/api/node_modules
COPY --from=builder --chown=node:node /app/apps/api/dist apps/api/dist
COPY --from=builder --chown=node:node /app/apps/api/prisma apps/api/prisma
COPY --from=builder --chown=node:node /app/apps/api/prisma.config.ts apps/api/prisma.config.ts
COPY --from=builder --chown=node:node /app/apps/api/uploads apps/api/uploads
COPY --from=builder --chown=node:node /app/apps/api/uploads/seed seed-assets
COPY --from=builder --chown=node:node /app/apps/api/src/generated apps/api/src/generated
COPY --from=builder --chown=node:node /app/apps/api/scripts apps/api/scripts
COPY --from=builder --chown=node:node /app/integrations integrations
USER node
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
