# SLTP engine API — baked market data, no runtime downloads.
#
# The bar files are downloaded once here, at build time, into the engine's
# default cache path (~/.sltp/cache, with HOME=/app). At runtime the engine's
# first lookup finds local bars, the version marker matches R2, and the whole
# remote-sync path stays dormant. Ephemeral host filesystems are harmless:
# there is nothing to persist because the data rides with the image.
#
# Layer order is deliberate: requirements (rarely change) -> data (changes
# when R2 publishes) -> app code (changes constantly). A code-only edit
# reuses the data layer; only a data refresh re-downloads.
#
# Build context is backend/:  docker build -f backend/Dockerfile backend/

FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HOME=/app \
    SLTP_DATA_DIR=""

WORKDIR /app/backend

COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY scripts/bake_market_data.py ./scripts/bake_market_data.py
RUN python scripts/bake_market_data.py /app/.sltp/cache

COPY . .

EXPOSE 8080

# Cloud Run injects $PORT (default 8080); local docker runs can omit it.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
