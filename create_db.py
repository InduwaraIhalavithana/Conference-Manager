import psycopg2
import sys

try:
    conn = psycopg2.connect(
        host="localhost",
        port=5432,
        user="postgres",
        password="Rxn%4023382",
        database="postgres"
    )
    conn.autocommit = True
    cur = conn.cursor()

    cur.execute("SELECT 1 FROM pg_database WHERE datname = 'conference_db'")
    exists = cur.fetchone()

    if exists:
        print("conference_db already exists — nothing to do.")
    else:
        cur.execute("CREATE DATABASE conference_db")
        print("conference_db created successfully!")

    cur.close()
    conn.close()

except Exception as e:
    print(f"ERROR: {e}")
    print("\nCheck that PostgreSQL is running and the password is correct.")
    sys.exit(1)

input("\nPress Enter to close...")
