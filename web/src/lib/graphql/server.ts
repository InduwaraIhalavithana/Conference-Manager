// GraphQL from server components. Runs only on the server: the browser never sees the API's address.
import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { print } from "graphql";

const API_URL = process.env.API_URL ?? "http://127.0.0.1:8003";

export class GraphQLRequestError extends Error {}

export async function query<TResult, TVariables extends Record<string, unknown>>(
  document: TypedDocumentNode<TResult, TVariables>,
  ...[variables]: TVariables extends Record<string, never> ? [] : [TVariables]
): Promise<TResult> {
  const res = await fetch(`${API_URL}/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: print(document), variables: variables ?? {} }),
  });
  if (!res.ok) throw new GraphQLRequestError(`GraphQL HTTP ${res.status}`);
  const body = (await res.json()) as { data?: TResult; errors?: { message: string }[] };
  if (body.errors?.length) throw new GraphQLRequestError(body.errors.map((e) => e.message).join("; "));
  if (!body.data) throw new GraphQLRequestError("GraphQL response had no data");
  return body.data;
}
