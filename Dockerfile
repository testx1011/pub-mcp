FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/

ENV NODE_ENV=production

ENTRYPOINT ["node", "dist/cli.js"]
CMD ["start"]