FROM node:24-alpine AS base

RUN apk add --no-cache git
WORKDIR /app

FROM base AS development

CMD ["sh", "-c", "npm install --legacy-peer-deps && npm run dev"]
