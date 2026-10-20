FROM python:3.14-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Uploaded photos and covers live here; docker-compose mounts a volume so they survive rebuilds.
RUN mkdir -p /app/uploads
VOLUME ["/app/uploads"]

EXPOSE 8002

# Only the nginx container reaches this port, so trusting its X-Forwarded-For (real client IP for the rate limits) is safe.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002", "--proxy-headers", "--forwarded-allow-ips", "*"]
