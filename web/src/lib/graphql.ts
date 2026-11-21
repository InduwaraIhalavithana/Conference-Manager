// Server-side GraphQL client for server components. Runs only on the server, so the API address never reaches the browser.

const GRAPHQL_URL = process.env.GRAPHQL_URL ?? "http://localhost:8003/graphql";

export class GraphQLRequestError extends Error {}

export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new GraphQLRequestError(`GraphQL HTTP ${res.status}`);
  const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (body.errors?.length) throw new GraphQLRequestError(body.errors.map((e) => e.message).join("; "));
  if (!body.data) throw new GraphQLRequestError("GraphQL response had no data");
  return body.data;
}
