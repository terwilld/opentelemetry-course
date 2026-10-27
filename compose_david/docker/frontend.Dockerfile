# Frontend images for the UKG network (stages: development, builder, production). Build context: app-versions/code/frontend
# Build secret: art = Artifactory token (passed on the command line only, never written to .npmrc).
FROM node:24.13.1-alpine AS development

WORKDIR /app

COPY package*.json ./

RUN --mount=type=secret,id=art \
    npm ci \
      --registry=https://ukgartifactory.pe.jfrog.io/artifactory/api/npm/npm/ \
      "--//ukgartifactory.pe.jfrog.io/artifactory/api/npm/npm/:_authToken=$(cat /run/secrets/art)"

COPY tsconfig.json ./

# Source code is mounted as a volume; public assets are copied for serving
COPY src/public ./src/public

EXPOSE 3000

CMD ["npm", "run", "dev"]

# Compile TypeScript (compose.build.yaml); the dev stage above has the full dependency set
FROM development AS builder

COPY src ./src
RUN npm run build

# Self-contained runtime image: no source mount, production dependencies only
FROM node:24.13.1-alpine AS production

WORKDIR /app

COPY package*.json ./

RUN --mount=type=secret,id=art \
    npm ci --omit=dev \
      --registry=https://ukgartifactory.pe.jfrog.io/artifactory/api/npm/npm/ \
      "--//ukgartifactory.pe.jfrog.io/artifactory/api/npm/npm/:_authToken=$(cat /run/secrets/art)" && \
    npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/public ./dist/public

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "dist/index.js"]
