FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY index.js ./
COPY src ./src

ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000

CMD ["node", "src/httpServer.js"]
