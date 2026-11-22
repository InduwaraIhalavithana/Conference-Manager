"""Write the GraphQL schema to web/src/graphql/schema.graphql, the source for the web app's generated types.

uv run python -m scripts.export_schema          # write it
uv run python -m scripts.export_schema --check  # fail if the committed file is out of date (CI)
"""

import argparse
import os
import sys
from pathlib import Path

os.environ.setdefault("SECRET_KEY", "schema-export-only-not-a-real-secret-0123456789")

from app.api.graphql.schema import build_schema  # noqa: E402

TARGET = Path(__file__).resolve().parents[2] / "web" / "src" / "graphql" / "schema.graphql"


def main(check: bool) -> int:
    sdl = build_schema(production=False).as_str() + "\n"
    if check:
        current = TARGET.read_text(encoding="utf-8") if TARGET.exists() else ""
        if current.replace("\r\n", "\n") != sdl:
            print(f"{TARGET} is out of date: run `uv run python -m scripts.export_schema` and commit it.")
            return 1
        print("GraphQL schema is up to date.")
        return 0
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(sdl, encoding="utf-8", newline="\n")
    print(f"Wrote {TARGET}")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    sys.exit(main(parser.parse_args().check))
