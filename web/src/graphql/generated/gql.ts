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
    "\n  query AboutStats {\n    platformStats { upcomingConferences registeredAttendees organizers speakers }\n  }\n": typeof types.AboutStatsDocument,
    "\n  query OgConference($slug: String!) {\n    conference(slug: $slug) {\n      title { en }\n      category\n      timezone\n      startsAt\n      endsAt\n      venue { city }\n    }\n  }\n": typeof types.OgConferenceDocument,
    "\n  query ConferencePage($slug: String!) {\n    conference(slug: $slug) {\n      id\n      slug\n      status\n      title { en si ta }\n      summary { en si ta }\n      description { en si ta }\n      category\n      tags\n      coverUrl\n      venue { name address city location { latitude longitude } }\n      onlineUrl\n      timezone\n      startsAt\n      endsAt\n      ended\n      capacity\n      seatsLeft\n      waitlistEnabled\n      counters { waitlisted }\n      organizer { name organization }\n      days { date label { en si ta } }\n      speakers { id name jobTitle organization photoUrl bio { en si ta } links }\n      sessions {\n        id\n        day\n        kind\n        title { en si ta }\n        description { en si ta }\n        startsAt\n        endsAt\n        room\n        track { name { en si ta } color }\n        speakers { id name photoUrl }\n      }\n    }\n  }\n": typeof types.ConferencePageDocument,
    "\n  query BrowseCities {\n    upcomingCities(first: 50) { city }\n  }\n": typeof types.BrowseCitiesDocument,
    "\n  query HomeData {\n    platformStats {\n      upcomingConferences\n      heldConferences\n      registeredAttendees\n      checkedIn\n      speakers\n      organizers\n      registrationsThisWeek\n    }\n    upcomingCategories { category count }\n    upcomingCities(first: 10) { city count }\n    conferences(first: 7) {\n      edges { node { ...ConferenceCardFields } }\n    }\n  }\n": typeof types.HomeDataDocument,
    "\n  query TicketPage($code: String!) {\n    ticket(code: $code) {\n      code\n      name\n      email\n      status\n      confirmed\n      holdExpiresAt\n      waitlistPosition\n      checkedInAt\n      createdAt\n      conference {\n        slug\n        status\n        title { en si ta }\n        summary { en si ta }\n        category\n        coverUrl\n        timezone\n        startsAt\n        endsAt\n        ended\n        venue { name address city }\n      }\n    }\n  }\n": typeof types.TicketPageDocument,
    "\n  query SitemapConferences($after: String) {\n    conferences(filter: { timeframe: ALL }, first: 100, after: $after) {\n      edges { node { slug } }\n      pageInfo { hasNextPage endCursor }\n    }\n  }\n": typeof types.SitemapConferencesDocument,
    "\n  query BrowseConferences($filter: ConferenceFilter, $first: Int!, $after: String) {\n    conferences(filter: $filter, first: $first, after: $after) {\n      edges { node { ...ConferenceCardFields venue { location { latitude longitude } } } }\n      pageInfo { hasNextPage endCursor }\n    }\n  }\n": typeof types.BrowseConferencesDocument,
    "\n  fragment ConferenceCardFields on Conference {\n    id\n    slug\n    status\n    title { en si ta }\n    summary { en si ta }\n    category\n    coverUrl\n    city\n    onlineUrl\n    timezone\n    startsAt\n    endsAt\n    capacity\n    seatsLeft\n    distanceKm\n    venue { name }\n  }\n": typeof types.ConferenceCardFieldsFragmentDoc,
    "\n  mutation RegisterForConference($slug: String!, $input: AttendeeInput!) {\n    registerForConference(slug: $slug, input: $input) {\n      __typename\n      ... on Registered { ticketCode holdExpiresAt }\n      ... on Waitlisted { ticketCode position }\n      ... on AlreadyRegistered { email }\n      ... on ConferenceFull { capacity }\n      ... on UserError { code field remainingAttempts retryAfterSeconds }\n    }\n  }\n": typeof types.RegisterForConferenceDocument,
    "\n  mutation ConfirmRegistration($ticketCode: String!, $code: String!) {\n    confirmRegistration(ticketCode: $ticketCode, code: $code) {\n      __typename\n      ... on Ticket { status waitlistPosition }\n      ... on UserError { code remainingAttempts retryAfterSeconds }\n    }\n  }\n": typeof types.ConfirmRegistrationDocument,
    "\n  mutation ResendConfirmation($ticketCode: String!) {\n    resendConfirmation(ticketCode: $ticketCode) {\n      __typename\n      ... on ConfirmationSent { resendAfterSeconds }\n      ... on UserError { code retryAfterSeconds }\n    }\n  }\n": typeof types.ResendConfirmationDocument,
    "\n  mutation TicketConfirm($ticketCode: String!, $code: String!) {\n    confirmRegistration(ticketCode: $ticketCode, code: $code) {\n      __typename\n      ... on Ticket { status }\n      ... on UserError { code remainingAttempts retryAfterSeconds }\n    }\n  }\n": typeof types.TicketConfirmDocument,
    "\n  mutation TicketResend($ticketCode: String!) {\n    resendConfirmation(ticketCode: $ticketCode) {\n      __typename\n      ... on ConfirmationSent { resendAfterSeconds }\n      ... on UserError { code retryAfterSeconds }\n    }\n  }\n": typeof types.TicketResendDocument,
    "\n  mutation TicketCancel($ticketCode: String!) {\n    cancelRegistration(ticketCode: $ticketCode) {\n      __typename\n      ... on Ticket { status }\n      ... on UserError { code retryAfterSeconds }\n    }\n  }\n": typeof types.TicketCancelDocument,
    "\n  mutation SendContactMessage($input: ContactInput!) {\n    sendContactMessage(input: $input) {\n      __typename\n      ... on UserError { code field retryAfterSeconds }\n    }\n  }\n": typeof types.SendContactMessageDocument,
};
const documents: Documents = {
    "\n  query AboutStats {\n    platformStats { upcomingConferences registeredAttendees organizers speakers }\n  }\n": types.AboutStatsDocument,
    "\n  query OgConference($slug: String!) {\n    conference(slug: $slug) {\n      title { en }\n      category\n      timezone\n      startsAt\n      endsAt\n      venue { city }\n    }\n  }\n": types.OgConferenceDocument,
    "\n  query ConferencePage($slug: String!) {\n    conference(slug: $slug) {\n      id\n      slug\n      status\n      title { en si ta }\n      summary { en si ta }\n      description { en si ta }\n      category\n      tags\n      coverUrl\n      venue { name address city location { latitude longitude } }\n      onlineUrl\n      timezone\n      startsAt\n      endsAt\n      ended\n      capacity\n      seatsLeft\n      waitlistEnabled\n      counters { waitlisted }\n      organizer { name organization }\n      days { date label { en si ta } }\n      speakers { id name jobTitle organization photoUrl bio { en si ta } links }\n      sessions {\n        id\n        day\n        kind\n        title { en si ta }\n        description { en si ta }\n        startsAt\n        endsAt\n        room\n        track { name { en si ta } color }\n        speakers { id name photoUrl }\n      }\n    }\n  }\n": types.ConferencePageDocument,
    "\n  query BrowseCities {\n    upcomingCities(first: 50) { city }\n  }\n": types.BrowseCitiesDocument,
    "\n  query HomeData {\n    platformStats {\n      upcomingConferences\n      heldConferences\n      registeredAttendees\n      checkedIn\n      speakers\n      organizers\n      registrationsThisWeek\n    }\n    upcomingCategories { category count }\n    upcomingCities(first: 10) { city count }\n    conferences(first: 7) {\n      edges { node { ...ConferenceCardFields } }\n    }\n  }\n": types.HomeDataDocument,
    "\n  query TicketPage($code: String!) {\n    ticket(code: $code) {\n      code\n      name\n      email\n      status\n      confirmed\n      holdExpiresAt\n      waitlistPosition\n      checkedInAt\n      createdAt\n      conference {\n        slug\n        status\n        title { en si ta }\n        summary { en si ta }\n        category\n        coverUrl\n        timezone\n        startsAt\n        endsAt\n        ended\n        venue { name address city }\n      }\n    }\n  }\n": types.TicketPageDocument,
    "\n  query SitemapConferences($after: String) {\n    conferences(filter: { timeframe: ALL }, first: 100, after: $after) {\n      edges { node { slug } }\n      pageInfo { hasNextPage endCursor }\n    }\n  }\n": types.SitemapConferencesDocument,
    "\n  query BrowseConferences($filter: ConferenceFilter, $first: Int!, $after: String) {\n    conferences(filter: $filter, first: $first, after: $after) {\n      edges { node { ...ConferenceCardFields venue { location { latitude longitude } } } }\n      pageInfo { hasNextPage endCursor }\n    }\n  }\n": types.BrowseConferencesDocument,
    "\n  fragment ConferenceCardFields on Conference {\n    id\n    slug\n    status\n    title { en si ta }\n    summary { en si ta }\n    category\n    coverUrl\n    city\n    onlineUrl\n    timezone\n    startsAt\n    endsAt\n    capacity\n    seatsLeft\n    distanceKm\n    venue { name }\n  }\n": types.ConferenceCardFieldsFragmentDoc,
    "\n  mutation RegisterForConference($slug: String!, $input: AttendeeInput!) {\n    registerForConference(slug: $slug, input: $input) {\n      __typename\n      ... on Registered { ticketCode holdExpiresAt }\n      ... on Waitlisted { ticketCode position }\n      ... on AlreadyRegistered { email }\n      ... on ConferenceFull { capacity }\n      ... on UserError { code field remainingAttempts retryAfterSeconds }\n    }\n  }\n": types.RegisterForConferenceDocument,
    "\n  mutation ConfirmRegistration($ticketCode: String!, $code: String!) {\n    confirmRegistration(ticketCode: $ticketCode, code: $code) {\n      __typename\n      ... on Ticket { status waitlistPosition }\n      ... on UserError { code remainingAttempts retryAfterSeconds }\n    }\n  }\n": types.ConfirmRegistrationDocument,
    "\n  mutation ResendConfirmation($ticketCode: String!) {\n    resendConfirmation(ticketCode: $ticketCode) {\n      __typename\n      ... on ConfirmationSent { resendAfterSeconds }\n      ... on UserError { code retryAfterSeconds }\n    }\n  }\n": types.ResendConfirmationDocument,
    "\n  mutation TicketConfirm($ticketCode: String!, $code: String!) {\n    confirmRegistration(ticketCode: $ticketCode, code: $code) {\n      __typename\n      ... on Ticket { status }\n      ... on UserError { code remainingAttempts retryAfterSeconds }\n    }\n  }\n": types.TicketConfirmDocument,
    "\n  mutation TicketResend($ticketCode: String!) {\n    resendConfirmation(ticketCode: $ticketCode) {\n      __typename\n      ... on ConfirmationSent { resendAfterSeconds }\n      ... on UserError { code retryAfterSeconds }\n    }\n  }\n": types.TicketResendDocument,
    "\n  mutation TicketCancel($ticketCode: String!) {\n    cancelRegistration(ticketCode: $ticketCode) {\n      __typename\n      ... on Ticket { status }\n      ... on UserError { code retryAfterSeconds }\n    }\n  }\n": types.TicketCancelDocument,
    "\n  mutation SendContactMessage($input: ContactInput!) {\n    sendContactMessage(input: $input) {\n      __typename\n      ... on UserError { code field retryAfterSeconds }\n    }\n  }\n": types.SendContactMessageDocument,
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
export function graphql(source: "\n  query AboutStats {\n    platformStats { upcomingConferences registeredAttendees organizers speakers }\n  }\n"): (typeof documents)["\n  query AboutStats {\n    platformStats { upcomingConferences registeredAttendees organizers speakers }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query OgConference($slug: String!) {\n    conference(slug: $slug) {\n      title { en }\n      category\n      timezone\n      startsAt\n      endsAt\n      venue { city }\n    }\n  }\n"): (typeof documents)["\n  query OgConference($slug: String!) {\n    conference(slug: $slug) {\n      title { en }\n      category\n      timezone\n      startsAt\n      endsAt\n      venue { city }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query ConferencePage($slug: String!) {\n    conference(slug: $slug) {\n      id\n      slug\n      status\n      title { en si ta }\n      summary { en si ta }\n      description { en si ta }\n      category\n      tags\n      coverUrl\n      venue { name address city location { latitude longitude } }\n      onlineUrl\n      timezone\n      startsAt\n      endsAt\n      ended\n      capacity\n      seatsLeft\n      waitlistEnabled\n      counters { waitlisted }\n      organizer { name organization }\n      days { date label { en si ta } }\n      speakers { id name jobTitle organization photoUrl bio { en si ta } links }\n      sessions {\n        id\n        day\n        kind\n        title { en si ta }\n        description { en si ta }\n        startsAt\n        endsAt\n        room\n        track { name { en si ta } color }\n        speakers { id name photoUrl }\n      }\n    }\n  }\n"): (typeof documents)["\n  query ConferencePage($slug: String!) {\n    conference(slug: $slug) {\n      id\n      slug\n      status\n      title { en si ta }\n      summary { en si ta }\n      description { en si ta }\n      category\n      tags\n      coverUrl\n      venue { name address city location { latitude longitude } }\n      onlineUrl\n      timezone\n      startsAt\n      endsAt\n      ended\n      capacity\n      seatsLeft\n      waitlistEnabled\n      counters { waitlisted }\n      organizer { name organization }\n      days { date label { en si ta } }\n      speakers { id name jobTitle organization photoUrl bio { en si ta } links }\n      sessions {\n        id\n        day\n        kind\n        title { en si ta }\n        description { en si ta }\n        startsAt\n        endsAt\n        room\n        track { name { en si ta } color }\n        speakers { id name photoUrl }\n      }\n    }\n  }\n"];
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
export function graphql(source: "\n  query TicketPage($code: String!) {\n    ticket(code: $code) {\n      code\n      name\n      email\n      status\n      confirmed\n      holdExpiresAt\n      waitlistPosition\n      checkedInAt\n      createdAt\n      conference {\n        slug\n        status\n        title { en si ta }\n        summary { en si ta }\n        category\n        coverUrl\n        timezone\n        startsAt\n        endsAt\n        ended\n        venue { name address city }\n      }\n    }\n  }\n"): (typeof documents)["\n  query TicketPage($code: String!) {\n    ticket(code: $code) {\n      code\n      name\n      email\n      status\n      confirmed\n      holdExpiresAt\n      waitlistPosition\n      checkedInAt\n      createdAt\n      conference {\n        slug\n        status\n        title { en si ta }\n        summary { en si ta }\n        category\n        coverUrl\n        timezone\n        startsAt\n        endsAt\n        ended\n        venue { name address city }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query SitemapConferences($after: String) {\n    conferences(filter: { timeframe: ALL }, first: 100, after: $after) {\n      edges { node { slug } }\n      pageInfo { hasNextPage endCursor }\n    }\n  }\n"): (typeof documents)["\n  query SitemapConferences($after: String) {\n    conferences(filter: { timeframe: ALL }, first: 100, after: $after) {\n      edges { node { slug } }\n      pageInfo { hasNextPage endCursor }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query BrowseConferences($filter: ConferenceFilter, $first: Int!, $after: String) {\n    conferences(filter: $filter, first: $first, after: $after) {\n      edges { node { ...ConferenceCardFields venue { location { latitude longitude } } } }\n      pageInfo { hasNextPage endCursor }\n    }\n  }\n"): (typeof documents)["\n  query BrowseConferences($filter: ConferenceFilter, $first: Int!, $after: String) {\n    conferences(filter: $filter, first: $first, after: $after) {\n      edges { node { ...ConferenceCardFields venue { location { latitude longitude } } } }\n      pageInfo { hasNextPage endCursor }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  fragment ConferenceCardFields on Conference {\n    id\n    slug\n    status\n    title { en si ta }\n    summary { en si ta }\n    category\n    coverUrl\n    city\n    onlineUrl\n    timezone\n    startsAt\n    endsAt\n    capacity\n    seatsLeft\n    distanceKm\n    venue { name }\n  }\n"): (typeof documents)["\n  fragment ConferenceCardFields on Conference {\n    id\n    slug\n    status\n    title { en si ta }\n    summary { en si ta }\n    category\n    coverUrl\n    city\n    onlineUrl\n    timezone\n    startsAt\n    endsAt\n    capacity\n    seatsLeft\n    distanceKm\n    venue { name }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RegisterForConference($slug: String!, $input: AttendeeInput!) {\n    registerForConference(slug: $slug, input: $input) {\n      __typename\n      ... on Registered { ticketCode holdExpiresAt }\n      ... on Waitlisted { ticketCode position }\n      ... on AlreadyRegistered { email }\n      ... on ConferenceFull { capacity }\n      ... on UserError { code field remainingAttempts retryAfterSeconds }\n    }\n  }\n"): (typeof documents)["\n  mutation RegisterForConference($slug: String!, $input: AttendeeInput!) {\n    registerForConference(slug: $slug, input: $input) {\n      __typename\n      ... on Registered { ticketCode holdExpiresAt }\n      ... on Waitlisted { ticketCode position }\n      ... on AlreadyRegistered { email }\n      ... on ConferenceFull { capacity }\n      ... on UserError { code field remainingAttempts retryAfterSeconds }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ConfirmRegistration($ticketCode: String!, $code: String!) {\n    confirmRegistration(ticketCode: $ticketCode, code: $code) {\n      __typename\n      ... on Ticket { status waitlistPosition }\n      ... on UserError { code remainingAttempts retryAfterSeconds }\n    }\n  }\n"): (typeof documents)["\n  mutation ConfirmRegistration($ticketCode: String!, $code: String!) {\n    confirmRegistration(ticketCode: $ticketCode, code: $code) {\n      __typename\n      ... on Ticket { status waitlistPosition }\n      ... on UserError { code remainingAttempts retryAfterSeconds }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ResendConfirmation($ticketCode: String!) {\n    resendConfirmation(ticketCode: $ticketCode) {\n      __typename\n      ... on ConfirmationSent { resendAfterSeconds }\n      ... on UserError { code retryAfterSeconds }\n    }\n  }\n"): (typeof documents)["\n  mutation ResendConfirmation($ticketCode: String!) {\n    resendConfirmation(ticketCode: $ticketCode) {\n      __typename\n      ... on ConfirmationSent { resendAfterSeconds }\n      ... on UserError { code retryAfterSeconds }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation TicketConfirm($ticketCode: String!, $code: String!) {\n    confirmRegistration(ticketCode: $ticketCode, code: $code) {\n      __typename\n      ... on Ticket { status }\n      ... on UserError { code remainingAttempts retryAfterSeconds }\n    }\n  }\n"): (typeof documents)["\n  mutation TicketConfirm($ticketCode: String!, $code: String!) {\n    confirmRegistration(ticketCode: $ticketCode, code: $code) {\n      __typename\n      ... on Ticket { status }\n      ... on UserError { code remainingAttempts retryAfterSeconds }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation TicketResend($ticketCode: String!) {\n    resendConfirmation(ticketCode: $ticketCode) {\n      __typename\n      ... on ConfirmationSent { resendAfterSeconds }\n      ... on UserError { code retryAfterSeconds }\n    }\n  }\n"): (typeof documents)["\n  mutation TicketResend($ticketCode: String!) {\n    resendConfirmation(ticketCode: $ticketCode) {\n      __typename\n      ... on ConfirmationSent { resendAfterSeconds }\n      ... on UserError { code retryAfterSeconds }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation TicketCancel($ticketCode: String!) {\n    cancelRegistration(ticketCode: $ticketCode) {\n      __typename\n      ... on Ticket { status }\n      ... on UserError { code retryAfterSeconds }\n    }\n  }\n"): (typeof documents)["\n  mutation TicketCancel($ticketCode: String!) {\n    cancelRegistration(ticketCode: $ticketCode) {\n      __typename\n      ... on Ticket { status }\n      ... on UserError { code retryAfterSeconds }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SendContactMessage($input: ContactInput!) {\n    sendContactMessage(input: $input) {\n      __typename\n      ... on UserError { code field retryAfterSeconds }\n    }\n  }\n"): (typeof documents)["\n  mutation SendContactMessage($input: ContactInput!) {\n    sendContactMessage(input: $input) {\n      __typename\n      ... on UserError { code field retryAfterSeconds }\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;