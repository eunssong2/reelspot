FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg imagemagick libimage-exiftool-perl librsvg2-bin fontconfig fonts-noto-color-emoji ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY server/package.json server/package.json
COPY contracts/package.json contracts/package.json
COPY ops-web/package.json ops-web/package.json
RUN npm ci
COPY . .
RUN printf '<fontconfig><dir>/app/server/assets/vlog-fonts</dir></fontconfig>' > /etc/fonts/conf.d/99-vlog-fonts.conf && fc-cache -f
USER node
CMD ["npm", "run", "dev"]
