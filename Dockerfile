# node:20-bookworm (glibc, apt-based) — not Alpine/musl: sharp's prebuilt
# binaries are far more reliable on Debian-based images.
FROM node:20-bookworm AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build


FROM node:20-bookworm

WORKDIR /app

# python3/pip for yt-dlp. fonts-noto-cjk backs the Noto Sans KR font used
# throughout the deck (Korean glyph coverage in a Linux container).
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 \
      python3-pip \
      fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --break-system-packages --no-cache-dir yt-dlp

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

RUN mkdir -p /app/workspace/jobs && \
    useradd --uid 1001 --create-home runner && \
    chown -R runner:runner /app

USER runner

EXPOSE 8080
CMD ["node", "dist/server.js"]
