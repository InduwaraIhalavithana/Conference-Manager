// Shared by the server page and the client "Show more" button. It must not live in a "use client" file:
// a server component importing from one gets a client reference, not the query document.
import { graphql } from "@/graphql/generated";
import type { ConferenceCardFieldsFragment } from "@/graphql/generated/graphql";

export const BrowseConferences = graphql(`
  query BrowseConferences($filter: ConferenceFilter, $first: Int!, $after: String) {
    conferences(filter: $filter, first: $first, after: $after) {
      edges { node { ...ConferenceCardFields venue { location { latitude longitude } } } }
      pageInfo { hasNextPage endCursor }
    }
  }
`);

export type BrowseItem = ConferenceCardFieldsFragment & {
  venue: { name: string | null; location: { latitude: number; longitude: number } | null };
};
