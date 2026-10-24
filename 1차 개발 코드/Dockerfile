FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg imagemagick libimage-exiftool-perl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY server/package.json server/package.json
COPY contracts/package.json contracts/package.json
COPY ops-web/package.json ops-web/package.json
RUN npm ci
COPY . .
USER node
CMD ["npm", "run", "dev"]
