# =========================================================
# Multi-Stage Dockerfile for IMPA Scraper & Next.js Dashboard
# Includes Node.js 22 + Python 3 + Scraper Libraries
# =========================================================

FROM node:22-bookworm-slim AS base

# Install Python 3, pip, curl, and native build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Step 1: Install Python dependencies
COPY scraper/requirements.txt ./scraper/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r ./scraper/requirements.txt

# Step 2: Install Node dependencies
COPY web/package*.json ./web/
WORKDIR /app/web
RUN npm ci

# Step 3: Copy source code
WORKDIR /app
COPY scraper ./scraper
COPY web ./web

# Step 4: Build Next.js
WORKDIR /app/web
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# Step 5: Runtime configuration
WORKDIR /app
RUN mkdir -p /app/data/images /app/data/exports

# Environment variables
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=production
ENV IMPA_DB_PATH="/app/data/impa_catalog.db"

EXPOSE 3000

# Start Next.js from web directory
WORKDIR /app/web
CMD ["npm", "run", "start", "--", "-p", "3000", "-H", "0.0.0.0"]
