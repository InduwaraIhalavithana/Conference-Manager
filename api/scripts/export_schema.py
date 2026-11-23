"""Write the GraphQL schema to web/src/graphql/schema.graphql (the source for the web app's generated types) and a
readable reference to docs/graphql-schema.md, both from the code.

uv run python -m scripts.export_schema          # write both
uv run python -m scripts.export_schema --check  # fail if a committed file is out of date (CI)
"""

import argparse
import os
import sys
from enum import Enum
from pathlib import Path

os.environ.setdefault("SECRET_KEY", "schema-export-only-not-a-real-secret-0123456789")

from graphql import (  # noqa: E402
    GraphQLEnumType,
    GraphQLField,
    GraphQLInputObjectType,
    GraphQLNamedType,
    GraphQLObjectType,
    GraphQLScalarType,
    GraphQLType,
    GraphQLUnionType,
    get_named_type,
)

from app.api.graphql.schema import build_schema  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SDL_FILE = ROOT / "web" / "src" / "graphql" / "schema.graphql"
DOCS_FILE = ROOT / "docs" / "graphql-schema.md"
BUILT_IN = {"String", "Int", "Float", "Boolean", "ID"}

INTRO = """# GraphQL API reference

Generated from the code by `uv run python -m scripts.export_schema`; do not edit by hand. The schema itself is in
[`web/src/graphql/schema.graphql`](../web/src/graphql/schema.graphql).

- **Endpoint:** `POST /graphql` on the API (the web app reaches it as `/api/graphql`, same site).
- **Sign-in:** httpOnly cookies set by `login` / `adminLogin` (see [ADR 0005](adr/0005-cookie-sessions.md)).
  Every mutation needs the `X-CSRF-Token` header with the value of the `cm_csrf` cookie.
- **Errors:** expected failures are data, not exceptions: most fields return a union with a `UserError` member
  (`code`, `message`, `field`). Ask for `__typename` and handle `UserError`.
- **Live updates** are server-sent events outside GraphQL: `GET /conferences/{id}/live` (check-ins, owner only) and
  `GET /conferences/{id}/qa-live` (live Q&A signals).
"""


def anchor(name: str) -> str:
    return name.lower()


def type_ref(t: GraphQLType) -> str:
    """A field or argument type, linked to its section unless it is a built-in scalar: [`[Session!]!`](#session)."""
    named = get_named_type(t)
    return f"`{t}`" if named.name in BUILT_IN else f"[`{t}`](#{anchor(named.name)})"


def describe(text: str | None) -> str:
    return " ".join((text or "").split())


def operations(title: str, root: GraphQLObjectType | None) -> list[str]:
    if root is None:
        return []
    out = [f"## {title}", ""]
    for name, field in sorted(root.fields.items()):
        out += field_doc(name, field, level="###")
    return out


def field_doc(name: str, field: GraphQLField, level: str) -> list[str]:
    out = [
        f"{level} `{name}`",
        "",
        f"Returns {type_ref(field.type)}." + (f" {describe(field.description)}" if field.description else ""),
        "",
    ]
    if field.args:
        out += ["| Argument | Type | Default |", "|---|---|---|"]
        for arg_name, arg in field.args.items():
            value = arg.default_value
            shown = value.name if isinstance(value, Enum) else value
            default = "" if value is None or str(value).startswith("<") else f"`{shown}`"
            out.append(f"| `{arg_name}` | {type_ref(arg.type)} | {default} |")
        out.append("")
    return out


def named_type_doc(t: GraphQLNamedType) -> list[str]:
    out = [f"### {t.name}", ""]
    if t.description:
        out += [describe(t.description), ""]
    if isinstance(t, (GraphQLObjectType, GraphQLInputObjectType)):
        out += ["| Field | Type | Description |", "|---|---|---|"]
        for name, f in t.fields.items():
            out.append(f"| `{name}` | {type_ref(f.type)} | {describe(f.description)} |")
    elif isinstance(t, GraphQLUnionType):
        out.append("One of: " + ", ".join(f"[{m.name}](#{anchor(m.name)})" for m in t.types) + ".")
    elif isinstance(t, GraphQLEnumType):
        out.append("Values: " + ", ".join(f"`{v}`" for v in t.values) + ".")
    elif isinstance(t, GraphQLScalarType):
        out.append("A custom scalar.")
    return [*out, ""]


def render_docs() -> str:
    schema = build_schema(production=False)._schema
    out = [INTRO]
    out += operations("Queries", schema.query_type)
    out += operations("Mutations", schema.mutation_type)
    groups: list[tuple[str, type]] = [
        ("Object types", GraphQLObjectType),
        ("Unions", GraphQLUnionType),
        ("Input types", GraphQLInputObjectType),
        ("Enums", GraphQLEnumType),
        ("Scalars", GraphQLScalarType),
    ]
    roots = {
        schema.query_type.name if schema.query_type else "",
        schema.mutation_type.name if schema.mutation_type else "",
    }
    for title, kind in groups:
        types = [
            t for name, t in sorted(schema.type_map.items())
            if isinstance(t, kind) and not name.startswith("__") and name not in BUILT_IN and name not in roots
        ]  # fmt: skip
        if types:
            out += [f"## {title}", ""]
            for t in types:
                out += named_type_doc(t)
    return "\n".join(out).rstrip() + "\n"


def main(check: bool) -> int:
    files = {SDL_FILE: build_schema(production=False).as_str() + "\n", DOCS_FILE: render_docs()}
    stale = [
        path
        for path, text in files.items()
        if (path.read_text(encoding="utf-8") if path.exists() else "").replace("\r\n", "\n") != text
    ]
    if check:
        for path in stale:
            print(f"{path} is out of date: run `uv run python -m scripts.export_schema` and commit it.")
        if not stale:
            print("GraphQL schema and reference are up to date.")
        return 1 if stale else 0
    for path, text in files.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8", newline="\n")
        print(f"Wrote {path}")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    sys.exit(main(parser.parse_args().check))
