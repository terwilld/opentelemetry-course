# Frontend dev image for the UKG network. Build context: app-versions/code/frontend
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
