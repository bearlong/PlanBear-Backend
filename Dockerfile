# === Builder 階段（可選）===
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production

COPY . .

# === Final Stage ===
FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/yarn.lock ./yarn.lock
COPY --from=builder /app/bin ./bin
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/utils ./utils
COPY --from=builder /app/configs ./configs
COPY --from=builder /app/app.js ./app.js
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services ./services
COPY --from=builder /app/repositories ./repositories
COPY --from=builder /app/jobs ./jobs

# 同樣徹底清除潛在快取與 lockfile 殘留
RUN rm -rf /root/.cache /tmp /app/.npm /app/.yarn-cache /app/yarn.lock.old

EXPOSE 3005
CMD ["node", "./bin/www"]