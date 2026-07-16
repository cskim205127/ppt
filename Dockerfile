# node:20-bookworm (glibc, apt-based) — not Alpine/musl: sharp's prebuilt
# binaries and LibreOffice packaging are far more reliable on Debian-based
# images (see plan §1.5).
FROM node:20-bookworm AS builder

WORKDIR /app

# ---- Server deps ----
COPY package.json ./
RUN npm install --omit=dev=false

# ---- Deck-rendering deps, pre-baked so no job ever needs network/npm ----
# (pptxgenjs/react/react-dom/react-icons/sharp — sharp is a native binary,
# it MUST be installed inside this Linux build stage, never copied in from
# a Windows-built node_modules.)
RUN mkdir -p /deck-deps && cd /deck-deps && npm init -y >/dev/null && \
    npm install pptxgenjs react react-dom react-icons sharp

COPY tsconfig.json ./
COPY src ./src
RUN npm run build


FROM node:20-bookworm

WORKDIR /app

# LibreOffice + Poppler restore the pptx skill's REQUIRED visual QA step
# (soffice.py render -> pdftoppm -> image inspection) that wasn't possible
# on the Windows dev machine this pipeline was originally hand-built on.
# fonts-noto-cjk backs the Noto Sans KR font override (see sources-to-deck
# skill override — Malgun Gothic isn't redistributable here).
# git is required by `claude plugin marketplace add` (clones the repo).
RUN apt-get update && apt-get install -y --no-install-recommends \
      libreoffice \
      poppler-utils \
      python3 \
      python3-pip \
      fonts-noto-cjk \
      git \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --break-system-packages --no-cache-dir \
      yt-dlp \
      "markitdown[pptx]" \
      Pillow

# The claude CLI itself — needed only at build time, to fetch the
# document-skills plugin (pptx/pdf) below. Runtime queries go through the
# @anthropic-ai/claude-agent-sdk npm dependency instead, not this CLI.
RUN npm install -g @anthropic-ai/claude-code

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /deck-deps/node_modules ./deck-deps/node_modules
COPY .claude ./.claude
COPY package.json ./

RUN mkdir -p /app/workspace/jobs && \
    useradd --uid 1001 --create-home runner && \
    chown -R runner:runner /app /usr/lib/node_modules

USER runner

# Install the official document-skills plugin (pptx + pdf) via Anthropic's
# own marketplace mechanism — NOT vendored/copied files. Those skills are
# proprietary (see their LICENSE.txt: no extraction, copying, or
# redistribution outside the Services is permitted). This RUN step fetches
# them fresh into the image's own ~/.claude/plugins cache, which is the
# license-compliant equivalent of a user running `/plugin install` in an
# interactive session. No ANTHROPIC_API_KEY needed — this step is
# unauthenticated (fetches from GitHub).
RUN claude plugin marketplace add anthropics/skills && \
    claude plugin install document-skills@anthropic-agent-skills --scope user && \
    claude plugin list

EXPOSE 8080
CMD ["node", "dist/server.js"]
