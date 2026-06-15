# LeakHunter API
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY server/package.json ./server/
RUN npm install --workspace server --include-dev
COPY server ./server
RUN npm --workspace server run db:generate && npm --workspace server run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY server/package.json ./server/
RUN npm install --workspace server --omit=dev
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/prisma ./server/prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
EXPOSE 4000
CMD ["node", "server/dist/index.js"]
