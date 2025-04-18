FROM node:22.12-alpine as builder

COPY src/azure-data-explorer /app
COPY tsconfig.json /tsconfig.json

WORKDIR /app

RUN --mount=type=cache,target=/root/.npm npm install
RUN --mount=type=cache,target=/root/.npm-production npm ci --ignore-scripts --omit-dev

# Install Azure CLI in the builder stage
RUN apk add --no-cache curl bash \
    && curl -sL https://aka.ms/InstallAzureCLIDeb | bash


FROM node:22-alpine AS release

WORKDIR /app

COPY --from=builder /app/build /app/build
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/package-lock.json /app/package-lock.json

# Copy Azure CLI from the builder stage
COPY --from=builder /usr/bin/az /usr/bin/az
COPY --from=builder /usr/lib/python3.*/ /usr/lib/python3.*/

ENV NODE_ENV=production

RUN npm ci --ignore-scripts --omit-dev

ENTRYPOINT ["node", "build/index.js"]