/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type AttendeeInput = {
  email: string;
  lang?: Lang;
  name: string;
};

export type Category =
  | 'ARTS'
  | 'BUSINESS'
  | 'EDUCATION'
  | 'HEALTH'
  | 'OTHER'
  | 'SCIENCE'
  | 'TECH';

export type ConferenceFilter = {
  category?: Category | null | undefined;
  city?: string | null | undefined;
  near?: NearInput | null | undefined;
  q?: string | null | undefined;
  startsFrom?: string | null | undefined;
  startsTo?: string | null | undefined;
  timeframe?: Timeframe;
};

export type ConferenceStatus =
  | 'ARCHIVED'
  | 'CANCELLED'
  | 'DRAFT'
  | 'PUBLISHED';

/** Stable error codes; the web app translates each one. */
export type ErrorCode =
  | 'ACCOUNT_SUSPENDED'
  | 'CAPACITY_BELOW_TAKEN'
  | 'CHECKIN_UNCONFIRMED'
  | 'CHECKIN_WAITLISTED'
  | 'CODE_EXPIRED'
  | 'CODE_INVALID'
  | 'CODE_LOCKED'
  | 'CONFLICT'
  | 'CSRF_FAILED'
  | 'EMAIL_NOT_VERIFIED'
  | 'EMAIL_TAKEN'
  | 'FILE_NOT_IMAGE'
  | 'FILE_TOO_LARGE'
  | 'FILE_TYPE'
  | 'FORBIDDEN'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_STATE'
  | 'NOT_AUTHENTICATED'
  | 'NOT_FOUND'
  | 'NOT_PUBLISHABLE'
  | 'PASSWORD_UNCHANGED'
  | 'RATE_LIMITED'
  | 'REGISTRATION_CLOSED'
  | 'REGISTRATION_INACTIVE'
  | 'RESET_EXPIRED'
  | 'RESET_INVALID'
  | 'SESSION_CLASH'
  | 'SESSION_EXPIRED'
  | 'SESSION_REUSED'
  | 'VALIDATION';

export type Lang =
  | 'EN'
  | 'SI'
  | 'TA';

export type NearInput = {
  latitude: number;
  longitude: number;
  radiusKm?: number;
};

export type RegistrationStatus =
  | 'CANCELLED'
  | 'HELD'
  | 'REGISTERED'
  | 'RELEASED'
  | 'WAITLISTED';

export type SessionKind =
  | 'BREAK'
  | 'KEYNOTE'
  | 'PANEL'
  | 'TALK'
  | 'WORKSHOP';

/** Which conferences to list when no date range is given. */
export type Timeframe =
  | 'ALL'
  | 'PAST'
  | 'UPCOMING';

export type ConferencePageQueryVariables = Exact<{
  slug: string;
}>;


export type ConferencePageQuery = { conference: { id: string, slug: string, status: ConferenceStatus, category: Category, tags: Array<string>, coverUrl: string | null, onlineUrl: string | null, timezone: string, startsAt: string, endsAt: string, ended: boolean, capacity: number | null, seatsLeft: number | null, waitlistEnabled: boolean, title: { en: string, si: string | null, ta: string | null }, summary: { en: string, si: string | null, ta: string | null } | null, description: { en: string, si: string | null, ta: string | null } | null, venue: { name: string | null, address: string | null, city: string | null, location: { latitude: number, longitude: number } | null }, counters: { waitlisted: number }, organizer: { name: string, organization: string | null } | null, days: Array<{ date: string, label: { en: string, si: string | null, ta: string | null } | null }>, speakers: Array<{ id: string, name: string, jobTitle: string | null, organization: string | null, photoUrl: string | null, links: Array<string>, bio: { en: string, si: string | null, ta: string | null } | null }>, sessions: Array<{ id: string, day: string, kind: SessionKind, startsAt: string, endsAt: string, room: string | null, title: { en: string, si: string | null, ta: string | null }, description: { en: string, si: string | null, ta: string | null } | null, track: { color: string, name: { en: string, si: string | null, ta: string | null } } | null, speakers: Array<{ id: string, name: string, photoUrl: string | null }> }> } | null };

export type BrowseCitiesQueryVariables = Exact<{ [key: string]: never; }>;


export type BrowseCitiesQuery = { upcomingCities: Array<{ city: string }> };

export type HomeDataQueryVariables = Exact<{ [key: string]: never; }>;


export type HomeDataQuery = { platformStats: { upcomingConferences: number, heldConferences: number, registeredAttendees: number, checkedIn: number, speakers: number, organizers: number, registrationsThisWeek: number }, upcomingCategories: Array<{ category: Category, count: number }>, upcomingCities: Array<{ city: string, count: number }>, conferences: { edges: Array<{ node: { id: string, slug: string, status: ConferenceStatus, category: Category, coverUrl: string | null, city: string | null, onlineUrl: string | null, timezone: string, startsAt: string, endsAt: string, capacity: number | null, seatsLeft: number | null, distanceKm: number | null, title: { en: string, si: string | null, ta: string | null }, summary: { en: string, si: string | null, ta: string | null } | null, venue: { name: string | null } } }> } };

export type BrowseConferencesQueryVariables = Exact<{
  filter?: ConferenceFilter | null | undefined;
  first: number;
  after?: string | null | undefined;
}>;


export type BrowseConferencesQuery = { conferences: { edges: Array<{ node: { id: string, slug: string, status: ConferenceStatus, category: Category, coverUrl: string | null, city: string | null, onlineUrl: string | null, timezone: string, startsAt: string, endsAt: string, capacity: number | null, seatsLeft: number | null, distanceKm: number | null, venue: { name: string | null, location: { latitude: number, longitude: number } | null }, title: { en: string, si: string | null, ta: string | null }, summary: { en: string, si: string | null, ta: string | null } | null } }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type ConferenceCardFieldsFragment = { id: string, slug: string, status: ConferenceStatus, category: Category, coverUrl: string | null, city: string | null, onlineUrl: string | null, timezone: string, startsAt: string, endsAt: string, capacity: number | null, seatsLeft: number | null, distanceKm: number | null, title: { en: string, si: string | null, ta: string | null }, summary: { en: string, si: string | null, ta: string | null } | null, venue: { name: string | null } };

export type RegisterForConferenceMutationVariables = Exact<{
  slug: string;
  input: AttendeeInput;
}>;


export type RegisterForConferenceMutation = { registerForConference:
    | { __typename: 'AlreadyRegistered', email: string }
    | { __typename: 'ConferenceFull', capacity: number }
    | { __typename: 'Registered', ticketCode: string, holdExpiresAt: string | null }
    | { __typename: 'UserError', code: ErrorCode, field: string | null, remainingAttempts: number | null, retryAfterSeconds: number | null }
    | { __typename: 'Waitlisted', ticketCode: string, position: number }
   };

export type ConfirmRegistrationMutationVariables = Exact<{
  ticketCode: string;
  code: string;
}>;


export type ConfirmRegistrationMutation = { confirmRegistration:
    | { __typename: 'Ticket', status: RegistrationStatus, waitlistPosition: number | null }
    | { __typename: 'UserError', code: ErrorCode, remainingAttempts: number | null, retryAfterSeconds: number | null }
   };

export type ResendConfirmationMutationVariables = Exact<{
  ticketCode: string;
}>;


export type ResendConfirmationMutation = { resendConfirmation:
    | { __typename: 'ConfirmationSent', resendAfterSeconds: number }
    | { __typename: 'UserError', code: ErrorCode, retryAfterSeconds: number | null }
   };

export const ConferenceCardFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ConferenceCardFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Conference"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"title"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"en"}},{"kind":"Field","name":{"kind":"Name","value":"si"}},{"kind":"Field","name":{"kind":"Name","value":"ta"}}]}},{"kind":"Field","name":{"kind":"Name","value":"summary"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"en"}},{"kind":"Field","name":{"kind":"Name","value":"si"}},{"kind":"Field","name":{"kind":"Name","value":"ta"}}]}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"coverUrl"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"onlineUrl"}},{"kind":"Field","name":{"kind":"Name","value":"timezone"}},{"kind":"Field","name":{"kind":"Name","value":"startsAt"}},{"kind":"Field","name":{"kind":"Name","value":"endsAt"}},{"kind":"Field","name":{"kind":"Name","value":"capacity"}},{"kind":"Field","name":{"kind":"Name","value":"seatsLeft"}},{"kind":"Field","name":{"kind":"Name","value":"distanceKm"}},{"kind":"Field","name":{"kind":"Name","value":"venue"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<ConferenceCardFieldsFragment, unknown>;
export const ConferencePageDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ConferencePage"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"conference"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"title"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"en"}},{"kind":"Field","name":{"kind":"Name","value":"si"}},{"kind":"Field","name":{"kind":"Name","value":"ta"}}]}},{"kind":"Field","name":{"kind":"Name","value":"summary"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"en"}},{"kind":"Field","name":{"kind":"Name","value":"si"}},{"kind":"Field","name":{"kind":"Name","value":"ta"}}]}},{"kind":"Field","name":{"kind":"Name","value":"description"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"en"}},{"kind":"Field","name":{"kind":"Name","value":"si"}},{"kind":"Field","name":{"kind":"Name","value":"ta"}}]}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"coverUrl"}},{"kind":"Field","name":{"kind":"Name","value":"venue"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"address"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"location"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"latitude"}},{"kind":"Field","name":{"kind":"Name","value":"longitude"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"onlineUrl"}},{"kind":"Field","name":{"kind":"Name","value":"timezone"}},{"kind":"Field","name":{"kind":"Name","value":"startsAt"}},{"kind":"Field","name":{"kind":"Name","value":"endsAt"}},{"kind":"Field","name":{"kind":"Name","value":"ended"}},{"kind":"Field","name":{"kind":"Name","value":"capacity"}},{"kind":"Field","name":{"kind":"Name","value":"seatsLeft"}},{"kind":"Field","name":{"kind":"Name","value":"waitlistEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"counters"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"waitlisted"}}]}},{"kind":"Field","name":{"kind":"Name","value":"organizer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"organization"}}]}},{"kind":"Field","name":{"kind":"Name","value":"days"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"label"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"en"}},{"kind":"Field","name":{"kind":"Name","value":"si"}},{"kind":"Field","name":{"kind":"Name","value":"ta"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"speakers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"jobTitle"}},{"kind":"Field","name":{"kind":"Name","value":"organization"}},{"kind":"Field","name":{"kind":"Name","value":"photoUrl"}},{"kind":"Field","name":{"kind":"Name","value":"bio"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"en"}},{"kind":"Field","name":{"kind":"Name","value":"si"}},{"kind":"Field","name":{"kind":"Name","value":"ta"}}]}},{"kind":"Field","name":{"kind":"Name","value":"links"}}]}},{"kind":"Field","name":{"kind":"Name","value":"sessions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"day"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"title"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"en"}},{"kind":"Field","name":{"kind":"Name","value":"si"}},{"kind":"Field","name":{"kind":"Name","value":"ta"}}]}},{"kind":"Field","name":{"kind":"Name","value":"description"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"en"}},{"kind":"Field","name":{"kind":"Name","value":"si"}},{"kind":"Field","name":{"kind":"Name","value":"ta"}}]}},{"kind":"Field","name":{"kind":"Name","value":"startsAt"}},{"kind":"Field","name":{"kind":"Name","value":"endsAt"}},{"kind":"Field","name":{"kind":"Name","value":"room"}},{"kind":"Field","name":{"kind":"Name","value":"track"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"en"}},{"kind":"Field","name":{"kind":"Name","value":"si"}},{"kind":"Field","name":{"kind":"Name","value":"ta"}}]}},{"kind":"Field","name":{"kind":"Name","value":"color"}}]}},{"kind":"Field","name":{"kind":"Name","value":"speakers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"photoUrl"}}]}}]}}]}}]}}]} as unknown as DocumentNode<ConferencePageQuery, ConferencePageQueryVariables>;
export const BrowseCitiesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"BrowseCities"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"upcomingCities"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"50"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"city"}}]}}]}}]} as unknown as DocumentNode<BrowseCitiesQuery, BrowseCitiesQueryVariables>;
export const HomeDataDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"HomeData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"platformStats"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"upcomingConferences"}},{"kind":"Field","name":{"kind":"Name","value":"heldConferences"}},{"kind":"Field","name":{"kind":"Name","value":"registeredAttendees"}},{"kind":"Field","name":{"kind":"Name","value":"checkedIn"}},{"kind":"Field","name":{"kind":"Name","value":"speakers"}},{"kind":"Field","name":{"kind":"Name","value":"organizers"}},{"kind":"Field","name":{"kind":"Name","value":"registrationsThisWeek"}}]}},{"kind":"Field","name":{"kind":"Name","value":"upcomingCategories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"upcomingCities"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"10"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"conferences"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"7"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ConferenceCardFields"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ConferenceCardFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Conference"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"title"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"en"}},{"kind":"Field","name":{"kind":"Name","value":"si"}},{"kind":"Field","name":{"kind":"Name","value":"ta"}}]}},{"kind":"Field","name":{"kind":"Name","value":"summary"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"en"}},{"kind":"Field","name":{"kind":"Name","value":"si"}},{"kind":"Field","name":{"kind":"Name","value":"ta"}}]}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"coverUrl"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"onlineUrl"}},{"kind":"Field","name":{"kind":"Name","value":"timezone"}},{"kind":"Field","name":{"kind":"Name","value":"startsAt"}},{"kind":"Field","name":{"kind":"Name","value":"endsAt"}},{"kind":"Field","name":{"kind":"Name","value":"capacity"}},{"kind":"Field","name":{"kind":"Name","value":"seatsLeft"}},{"kind":"Field","name":{"kind":"Name","value":"distanceKm"}},{"kind":"Field","name":{"kind":"Name","value":"venue"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<HomeDataQuery, HomeDataQueryVariables>;
export const BrowseConferencesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"BrowseConferences"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ConferenceFilter"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"conferences"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ConferenceCardFields"}},{"kind":"Field","name":{"kind":"Name","value":"venue"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"location"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"latitude"}},{"kind":"Field","name":{"kind":"Name","value":"longitude"}}]}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ConferenceCardFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Conference"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slug"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"title"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"en"}},{"kind":"Field","name":{"kind":"Name","value":"si"}},{"kind":"Field","name":{"kind":"Name","value":"ta"}}]}},{"kind":"Field","name":{"kind":"Name","value":"summary"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"en"}},{"kind":"Field","name":{"kind":"Name","value":"si"}},{"kind":"Field","name":{"kind":"Name","value":"ta"}}]}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"coverUrl"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"onlineUrl"}},{"kind":"Field","name":{"kind":"Name","value":"timezone"}},{"kind":"Field","name":{"kind":"Name","value":"startsAt"}},{"kind":"Field","name":{"kind":"Name","value":"endsAt"}},{"kind":"Field","name":{"kind":"Name","value":"capacity"}},{"kind":"Field","name":{"kind":"Name","value":"seatsLeft"}},{"kind":"Field","name":{"kind":"Name","value":"distanceKm"}},{"kind":"Field","name":{"kind":"Name","value":"venue"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<BrowseConferencesQuery, BrowseConferencesQueryVariables>;
export const RegisterForConferenceDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RegisterForConference"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"slug"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AttendeeInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"registerForConference"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"slug"},"value":{"kind":"Variable","name":{"kind":"Name","value":"slug"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Registered"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ticketCode"}},{"kind":"Field","name":{"kind":"Name","value":"holdExpiresAt"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Waitlisted"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ticketCode"}},{"kind":"Field","name":{"kind":"Name","value":"position"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"AlreadyRegistered"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"email"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ConferenceFull"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"capacity"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"UserError"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"field"}},{"kind":"Field","name":{"kind":"Name","value":"remainingAttempts"}},{"kind":"Field","name":{"kind":"Name","value":"retryAfterSeconds"}}]}}]}}]}}]} as unknown as DocumentNode<RegisterForConferenceMutation, RegisterForConferenceMutationVariables>;
export const ConfirmRegistrationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ConfirmRegistration"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ticketCode"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"code"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"confirmRegistration"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"ticketCode"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ticketCode"}}},{"kind":"Argument","name":{"kind":"Name","value":"code"},"value":{"kind":"Variable","name":{"kind":"Name","value":"code"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Ticket"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"waitlistPosition"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"UserError"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"remainingAttempts"}},{"kind":"Field","name":{"kind":"Name","value":"retryAfterSeconds"}}]}}]}}]}}]} as unknown as DocumentNode<ConfirmRegistrationMutation, ConfirmRegistrationMutationVariables>;
export const ResendConfirmationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ResendConfirmation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ticketCode"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"resendConfirmation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"ticketCode"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ticketCode"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ConfirmationSent"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"resendAfterSeconds"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"UserError"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"retryAfterSeconds"}}]}}]}}]}}]} as unknown as DocumentNode<ResendConfirmationMutation, ResendConfirmationMutationVariables>;