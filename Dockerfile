# 多阶段构建 - 生产用 Dockerfile
# 基于 Node.js 20 slim 镜像

FROM node:20-slim AS base
WORKDIR /app

# 构建阶段 - 已预构建
FROM base AS builder

# 直接复制已经编译好的代码（假设在服务器上先编译）
COPY package.json pnpm-lock.yaml* ./
COPY .next ./.next
COPY public ./public

RUN corepack enable pnpm && pnpm install --prod --frozen-lockfile

# 生产运行阶段
FROM base AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

WORKDIR /app

# 从构建阶段复制文件
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder /app/package.json ./package.json

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", ".next/standalone/server.js"]
