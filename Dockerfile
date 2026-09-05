FROM node:24.20.0-bookworm-slim

# Nest CLI の watch 再起動で子プロセスを終了するために ps が必要。
RUN apt-get update \
    && apt-get install -y --no-install-recommends procps \
    && rm -rf /var/lib/apt/lists/*

RUN npm install --global pnpm@11.25.0

WORKDIR /app
RUN chown node:node /app
USER node

COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=node:node apps/api/package.json ./apps/api/package.json
COPY --chown=node:node apps/web/package.json ./apps/web/package.json
RUN pnpm install --frozen-lockfile

COPY --chown=node:node . .
