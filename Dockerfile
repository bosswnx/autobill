FROM node:22-bookworm-slim

WORKDIR /app

# Workspace manifests first, so dependency installs cache independently of source.
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production \
    PORT=8787 \
    HOST=0.0.0.0 \
    TAGBILL_DATA=/data

VOLUME ["/data"]
EXPOSE 8787

CMD ["npm", "run", "server:start"]
