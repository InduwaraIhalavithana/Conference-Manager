/* eslint-disable */
import * as types from './graphql';
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n  query BrowseCities {\n    upcomingCities(first: 50) { city }\n  }\n": typeof types.BrowseCitiesDocument,
    "\n  query HomeData {\n    platformStats {\n      upcomingConferences\n      heldConferences\n      registeredAttendees\n      checkedIn\n      speakers\n      organizers\n      registrationsThisWeek\n    }\n    upcomingCategories { category count }\n    upcomingCities(first: 10) { city count }\n    conferences(first: 7) {\n      edges { node { ...ConferenceCardFields } }\n    }\n  }\n": typeof types.HomeDataDocument,
    "\n  query BrowseConferences($filter: ConferenceFilter, $first: Int!, $after: String) {\n    conferences(filter: $filter, first: $first, after: $after) {\n      edges { node { ...ConferenceCardFields venue { location { latitude longitude } } } }\n      pageInfo { hasNextPage endCursor }\n    }\n  }\n": typeof types.BrowseConferencesDocument,
    "\n  fragment ConferenceCardFields on Conference {\n    id\n    slug\n    status\n    title { en si ta }\n    summary { en si ta }\n    category\n    coverUrl\n    city\n    onlineUrl\n    timezone\n    startsAt\n    endsAt\n    capacity\n    seatsLeft\n    distanceKm\n    venue { name }\n  }\n": typeof types.ConferenceCardFieldsFragmentDoc,
};
const documents: Documents = {
    "\n  query BrowseCities {\n    upcomingCities(first: 50) { city }\n  }\n": types.BrowseCitiesDocument,
    "\n  query HomeData {\n    platformStats {\n      upcomingConferences\n      heldConferences\n      registeredAttendees\n      checkedIn\n      speakers\n      organizers\n      registrationsThisWeek\n    }\n    upcomingCategories { category count }\n    upcomingCities(first: 10) { city count }\n    conferences(first: 7) {\n      edges { node { ...ConferenceCardFields } }\n    }\n  }\n": types.HomeDataDocument,
    "\n  query BrowseConferences($filter: ConferenceFilter, $first: Int!, $after: String) {\n    conferences(filter: $filter, first: $first, after: $after) {\n      edges { node { ...ConferenceCardFields venue { location { latitude longitude } } } }\n      pageInfo { hasNextPage endCursor }\n    }\n  }\n": types.BrowseConferencesDocument,
    "\n  fragment ConferenceCardFields on Conference {\n    id\n    slug\n    status\n    title { en si ta }\n    summary { en si ta }\n    category\n    coverUrl\n    city\n    onlineUrl\n    timezone\n    startsAt\n    endsAt\n    capacity\n    seatsLeft\n    distanceKm\n    venue { name }\n  }\n": types.ConferenceCardFieldsFragmentDoc,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query BrowseCities {\n    upcomingCities(first: 50) { city }\n  }\n"): (typeof documents)["\n  query BrowseCities {\n    upcomingCities(first: 50) { city }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query HomeData {\n    platformStats {\n      upcomingConferences\n      heldConferences\n      registeredAttendees\n      checkedIn\n      speakers\n      organizers\n      registrationsThisWeek\n    }\n    upcomingCategories { category count }\n    upcomingCities(first: 10) { city count }\n    conferences(first: 7) {\n      edges { node { ...ConferenceCardFields } }\n    }\n  }\n"): (typeof documents)["\n  query HomeData {\n    platformStats {\n      upcomingConferences\n      heldConferences\n      registeredAttendees\n      checkedIn\n      speakers\n      organizers\n      registrationsThisWeek\n    }\n    upcomingCategories { category count }\n    upcomingCities(first: 10) { city count }\n    conferences(first: 7) {\n      edges { node { ...ConferenceCardFields } }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query BrowseConferences($filter: ConferenceFilter, $first: Int!, $after: String) {\n    conferences(filter: $filter, first: $first, after: $after) {\n      edges { node { ...ConferenceCardFields venue { location { latitude longitude } } } }\n      pageInfo { hasNextPage endCursor }\n    }\n  }\n"): (typeof documents)["\n  query BrowseConferences($filter: ConferenceFilter, $first: Int!, $after: String) {\n    conferences(filter: $filter, first: $first, after: $after) {\n      edges { node { ...ConferenceCardFields venue { location { latitude longitude } } } }\n      pageInfo { hasNextPage endCursor }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment ConferenceCardFields on Conference {\n    id\n    slug\n    status\n    title { en si ta }\n    summary { en si ta }\n    category\n    coverUrl\n    city\n    onlineUrl\n    timezone\n    startsAt\n    endsAt\n    capacity\n    seatsLeft\n    distanceKm\n    venue { name }\n  }\n"): (typeof documents)["\n  fragment ConferenceCardFields on Conference {\n    id\n    slug\n    status\n    title { en si ta }\n    summary { en si ta }\n    category\n    coverUrl\n    city\n    onlineUrl\n    timezone\n    startsAt\n    endsAt\n    capacity\n    seatsLeft\n    distanceKm\n    venue { name }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;