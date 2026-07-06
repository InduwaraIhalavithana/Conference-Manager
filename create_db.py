import sys
from pathlib import Path
from urllib.parse import urlparse, unquote

env_file = Path(__file__).parent / "backend" / ".env"
db_url = ""
if env_file.exists():
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("DATABASE_URL="):
            db_url = line.split("=", 1)[1].strip()
            break

if not db_url:
    print("ERROR: DATABASE_URL not found in backend/.env")
    sys.exit(1)

parsed = urlparse(db_url)
host     = parsed.hostname or "localhost"
port     = parsed.port or 5432
user     = unquote(parsed.username or "postgres")
password = unquote(parsed.password or "")
dbname   = parsed.path.lstrip("/") or "conference_db"

try:
    import psycopg2
    conn = psycopg2.connect(host=host, port=port, user=user, password=password, database="postgres")
    conn.autocommit = True
    cur = conn.cursor()

    cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (dbname,))
    if cur.fetchone():
        print(f"{dbname} already exists — nothing to do.")
    else:
        cur.execute(f'CREATE DATABASE "{dbname}"')
        print(f"{dbname} created successfully!")

    cur.close()
    conn.close()

except Exception as e:
    print(f"ERROR: {e}")
    print("\nCheck that PostgreSQL is running and credentials in backend/.env are correct.")
    sys.exit(1)
