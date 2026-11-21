# ConferenceHub v3 API

Async FastAPI + Strawberry GraphQL + MongoDB (Beanie). Work in progress on the `v3` branch; v2 lives in `../backend`.

```bash
docker compose -f ../docker-compose.dev.yml up -d   # MongoDB + Redis
uv sync
uv run python -m scripts.seed_spike                 # sample data
uv run uvicorn app.main:app --port 8003 --reload    # GraphiQL at http://localhost:8003/graphql
uv run pytest
```
