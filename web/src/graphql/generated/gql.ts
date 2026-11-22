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
    "\n  query ConferenceMeta($slug: String!) {\n    conference(slug: $slug) {\n      title { en si ta }\n      summary { en si ta }\n    }\n  }\n": typeof types.ConferenceMetaDocument,
    "\n  query BrowseCities {\n    upcomingCities(first: 50) { city }\n  }\n": typeof types.BrowseCitiesDocument,
    "\n  query HomeData {\n    platformStats {\n      upcomingConferences\n      heldConferences\n      registeredAttendees\n      checkedIn\n      speakers\n      organizers\n      registrationsThisWeek\n    }\n    upcomingCategories { category count }\n    upcomingCities(first: 10) { city count }\n    conferences(first: 7) {\n      edges { node { ...ConferenceCardFields } }\n    }\n  }\n": typeof types.HomeDataDocument,
    "\n  query TicketPage($code: String!) {\n    ticket(code: $code) {\n      code\n      name\n      email\n      status\n      confirmed\n      holdExpiresAt\n      waitlistPosition\n      checkedInAt\n      createdAt\n      conference {\n        slug\n        status\n        title { en si ta }\n        summary { en si ta }\n        category\n        coverUrl\n        timezone\n        startsAt\n        endsAt\n        ended\n        venue { name address city }\n      }\n    }\n  }\n": typeof types.TicketPageDocument,
    "\n  query SitemapConferences($after: String) {\n    conferences(filter: { timeframe: ALL }, first: 100, after: $after) {\n      edges { node { slug } }\n      pageInfo { hasNextPage endCursor }\n    }\n  }\n": typeof types.SitemapConferencesDocument,
    "\n  mutation Login($email: String!, $password: String!) {\n    login(email: $email, password: $password) {\n      __typename\n      ... on UserError { code field retryAfterSeconds }\n    }\n  }\n": typeof types.LoginDocument,
    "\n  mutation AdminLogin($email: String!, $password: String!) {\n    adminLogin(email: $email, password: $password) {\n      __typename\n      ... on UserError { code field retryAfterSeconds }\n    }\n  }\n": typeof types.AdminLoginDocument,
    "\n  mutation Register($input: RegisterInput!) {\n    register(input: $input) {\n      __typename\n      ... on CodeSent { email resendAfterSeconds }\n      ... on UserError { code field retryAfterSeconds }\n    }\n  }\n": typeof types.RegisterDocument,
    "\n  mutation VerifyEmail($email: String!, $code: String!) {\n    verifyEmail(email: $email, code: $code) {\n      __typename\n      ... on UserError { code remainingAttempts retryAfterSeconds }\n    }\n  }\n": typeof types.VerifyEmailDocument,
    "\n  mutation ResendCode($email: String!) {\n    resendCode(email: $email) {\n      __typename\n      ... on CodeSent { resendAfterSeconds }\n      ... on UserError { code retryAfterSeconds }\n    }\n  }\n": typeof types.ResendCodeDocument,
    "\n  mutation ForgotPassword($email: String!) {\n    forgotPassword(email: $email) {\n      __typename\n      ... on UserError { code field retryAfterSeconds }\n    }\n  }\n": typeof types.ForgotPasswordDocument,
    "\n  mutation ResetPassword($token: String!, $newPassword: String!) {\n    resetPassword(token: $token, newPassword: $newPassword) {\n      __typename\n      ... on UserError { code field }\n    }\n  }\n": typeof types.ResetPasswordDocument,
    "\n  query AuthStats {\n    platformStats { upcomingConferences registeredAttendees organizers }\n  }\n": typeof types.AuthStatsDocument,
    "\n  query BrowseConferences($filter: ConferenceFilter, $first: Int!, $after: String) {\n    conferences(filter: $filter, first: $first, after: $after) {\n      edges { node { ...ConferenceCardFields venue { location { latitude longitude } } } }\n      pageInfo { hasNextPage endCursor }\n    }\n  }\n": typeof types.BrowseConferencesDocument,
    "\n  fragment ConferenceCardFields on Conference {\n    id\n    slug\n    status\n    title { en si ta }\n    summary { en si ta }\n    category\n    coverUrl\n    city\n    onlineUrl\n    timezone\n    startsAt\n    endsAt\n    capacity\n    seatsLeft\n    distanceKm\n    venue { name }\n  }\n": typeof types.ConferenceCardFieldsFragmentDoc,
    "\n  mutation RegisterForConference($slug: String!, $input: AttendeeInput!) {\n    registerForConference(slug: $slug, input: $input) {\n      __typename\n      ... on Registered { ticketCode holdExpiresAt }\n      ... on Waitlisted { ticketCode position }\n      ... on AlreadyRegistered { email }\n      ... on ConferenceFull { capacity }\n      ... on UserError { code field remainingAttempts retryAfterSeconds }\n    }\n  }\n": typeof types.RegisterForConferenceDocument,
    "\n  mutation ConfirmRegistration($ticketCode: String!, $code: String!) {\n    confirmRegistration(ticketCode: $ticketCode, code: $code) {\n      __typename\n      ... on Ticket { status waitlistPosition }\n      ... on UserError { code remainingAttempts retryAfterSeconds }\n    }\n  }\n": typeof types.ConfirmRegistrationDocument,
    "\n  mutation ResendConfirmation($ticketCode: String!) {\n    resendConfirmation(ticketCode: $ticketCode) {\n      __typename\n      ... on ConfirmationSent { resendAfterSeconds }\n      ... on UserError { code retryAfterSeconds }\n    }\n  }\n": typeof types.ResendConfirmationDocument,
    "\n  mutation TicketConfirm($ticketCode: String!, $code: String!) {\n    confirmRegistration(ticketCode: $ticketCode, code: $code) {\n      __typename\n      ... on Ticket { status }\n      ... on UserError { code remainingAttempts retryAfterSeconds }\n    }\n  }\n": typeof types.TicketConfirmDocument,
    "\n  mutation TicketResend($ticketCode: String!) {\n    resendConfirmation(ticketCode: $ticketCode) {\n      __typename\n      ... on ConfirmationSent { resendAfterSeconds }\n      ... on UserError { code retryAfterSeconds }\n    }\n  }\n": typeof types.TicketResendDocument,
    "\n  mutation TicketCancel($ticketCode: String!) {\n    cancelRegistration(ticketCode: $ticketCode) {\n      __typename\n      ... on Ticket { status }\n      ... on UserError { code retryAfterSeconds }\n    }\n  }\n": typeof types.TicketCancelDocument,
    "\n  fragment EditorConferenceFields on Conference {\n    id\n    slug\n    status\n    title { en si ta }\n    summary { en si ta }\n    description { en si ta }\n    category\n    tags\n    coverUrl\n    venue { name address city location { latitude longitude } }\n    onlineUrl\n    timezone\n    startsAt\n    endsAt\n    ended\n    capacity\n    waitlistEnabled\n    counters { registered confirmed waitlisted checkedIn }\n    publishProblems\n    days { date label { en si ta } }\n    tracks { id name { en si ta } color }\n    speakers { id name jobTitle organization photoUrl bio { en si ta } links }\n    sessions {\n      id\n      day\n      kind\n      title { en si ta }\n      description { en si ta }\n      startsAt\n      endsAt\n      room\n      capacity\n      track { id }\n      speakers { id }\n    }\n  }\n": typeof types.EditorConferenceFieldsFragmentDoc,
    "\n  query MyConferences {\n    myConferences {\n      __typename\n      ... on ConferenceList {\n        items {\n          id\n          slug\n          status\n          title { en si ta }\n          category\n          coverUrl\n          timezone\n          startsAt\n          endsAt\n          ended\n          capacity\n          venue { city }\n          counters { registered confirmed waitlisted checkedIn }\n        }\n      }\n      ... on UserError { code }\n    }\n  }\n": typeof types.MyConferencesDocument,
    "\n  query MyConference($id: ID!) {\n    myConference(id: $id) {\n      __typename\n      ... on Conference { ...EditorConferenceFields }\n      ... on UserError { code }\n    }\n  }\n": typeof types.MyConferenceDocument,
    "\n  mutation CreateConference($input: ConferenceInput!) {\n    createConference(input: $input) {\n      __typename\n      ... on Conference { id }\n      ... on UserError { code field }\n    }\n  }\n": typeof types.CreateConferenceDocument,
    "\n  mutation UpdateConference($id: ID!, $input: ConferenceInput!) {\n    updateConference(id: $id, input: $input) {\n      __typename\n      ... on Conference { ...EditorConferenceFields }\n      ... on UserError { code field }\n    }\n  }\n": typeof types.UpdateConferenceDocument,
    "\n  mutation PublishConference($id: ID!) {\n    publishConference(id: $id) {\n      __typename\n      ... on Conference { ...EditorConferenceFields }\n      ... on UserError { code field }\n    }\n  }\n": typeof types.PublishConferenceDocument,
    "\n  mutation UnpublishConference($id: ID!) {\n    unpublishConference(id: $id) {\n      __typename\n      ... on Conference { ...EditorConferenceFields }\n      ... on UserError { code field }\n    }\n  }\n": typeof types.UnpublishConferenceDocument,
    "\n  mutation CancelConference($id: ID!) {\n    cancelConference(id: $id) {\n      __typename\n      ... on Conference { ...EditorConferenceFields }\n      ... on UserError { code field }\n    }\n  }\n": typeof types.CancelConferenceDocument,
    "\n  mutation DuplicateConference($id: ID!) {\n    duplicateConference(id: $id) {\n      __typename\n      ... on Conference { id }\n      ... on UserError { code }\n    }\n  }\n": typeof types.DuplicateConferenceDocument,
    "\n  mutation DeleteConference($id: ID!) {\n    deleteConference(id: $id) {\n      __typename\n      ... on UserError { code }\n    }\n  }\n": typeof types.DeleteConferenceDocument,
    "\n  mutation UpsertTrack($conferenceId: ID!, $input: TrackInput!, $trackId: ID) {\n    upsertTrack(conferenceId: $conferenceId, input: $input, trackId: $trackId) {\n      __typename\n      ... on UserError { code field }\n    }\n  }\n": typeof types.UpsertTrackDocument,
    "\n  mutation RemoveTrack($conferenceId: ID!, $trackId: ID!) {\n    removeTrack(conferenceId: $conferenceId, trackId: $trackId) {\n      __typename\n      ... on UserError { code }\n    }\n  }\n": typeof types.RemoveTrackDocument,
    "\n  mutation UpsertSpeaker($conferenceId: ID!, $input: SpeakerInput!, $speakerId: ID) {\n    upsertSpeaker(conferenceId: $conferenceId, input: $input, speakerId: $speakerId) {\n      __typename\n      ... on UserError { code field }\n    }\n  }\n": typeof types.UpsertSpeakerDocument,
    "\n  mutation RemoveSpeaker($conferenceId: ID!, $speakerId: ID!) {\n    removeSpeaker(conferenceId: $conferenceId, speakerId: $speakerId) {\n      __typename\n      ... on UserError { code }\n    }\n  }\n": typeof types.RemoveSpeakerDocument,
    "\n  mutation UpsertSession($conferenceId: ID!, $input: SessionInput!, $sessionId: ID) {\n    upsertSession(conferenceId: $conferenceId, input: $input, sessionId: $sessionId) {\n      __typename\n      ... on UserError { code field }\n    }\n  }\n": typeof types.UpsertSessionDocument,
    "\n  mutation RemoveSession($conferenceId: ID!, $sessionId: ID!) {\n    removeSession(conferenceId: $conferenceId, sessionId: $sessionId) {\n      __typename\n      ... on UserError { code }\n    }\n  }\n": typeof types.RemoveSessionDocument,
    "\n  mutation SetDayLabel($conferenceId: ID!, $day: Date!, $label: LocalizedTextInput) {\n    setDayLabel(conferenceId: $conferenceId, day: $day, label: $label) {\n      __typename\n      ... on UserError { code field }\n    }\n  }\n": typeof types.SetDayLabelDocument,
    "\n  query Attendees($conferenceId: ID!, $filter: AttendeeFilter, $first: Int!, $after: String) {\n    attendees(conferenceId: $conferenceId, filter: $filter, first: $first, after: $after) {\n      __typename\n      ... on AttendeeConnection {\n        totalCount\n        pageInfo { hasNextPage endCursor }\n        edges {\n          node { id name email lang status ticketCode confirmedAt promotedAt checkedInAt cancelledAt createdAt }\n        }\n      }\n      ... on UserError { code }\n    }\n  }\n": typeof types.AttendeesDocument,
    "\n  mutation RemoveAttendee($conferenceId: ID!, $attendeeId: ID!) {\n    removeAttendee(conferenceId: $conferenceId, attendeeId: $attendeeId) {\n      __typename\n      ... on UserError { code }\n    }\n  }\n": typeof types.RemoveAttendeeDocument,
    "\n  mutation UndoCheckIn($conferenceId: ID!, $attendeeId: ID!) {\n    undoCheckIn(conferenceId: $conferenceId, attendeeId: $attendeeId) {\n      __typename\n      ... on UserError { code }\n    }\n  }\n": typeof types.UndoCheckInDocument,
    "\n  mutation SendReminders($conferenceId: ID!) {\n    sendRemindersNow(conferenceId: $conferenceId) {\n      __typename\n      ... on RemindersSent { count }\n      ... on UserError { code retryAfterSeconds }\n    }\n  }\n": typeof types.SendRemindersDocument,
    "\n  query DashboardData {\n    myConferences {\n      __typename\n      ... on ConferenceList {\n        items {\n          id\n          slug\n          status\n          title { en si ta }\n          timezone\n          startsAt\n          endsAt\n          ended\n          capacity\n          counters { registered confirmed waitlisted checkedIn }\n          sessions { id }\n        }\n      }\n    }\n  }\n": typeof types.DashboardDataDocument,
    "\n  query Me {\n    me {\n      __typename\n      ... on Organizer {\n        id\n        firstName\n        lastName\n        email\n        phone\n        organization\n        avatarUrl\n        lang\n        createdAt\n        bio { en si ta }\n      }\n      ... on Admin { id username email }\n    }\n  }\n": typeof types.MeDocument,
    "\n  query Notifications($first: Int!, $after: String) {\n    notifications(first: $first, after: $after) {\n      __typename\n      ... on NotificationPage {\n        unread\n        hasNextPage\n        endCursor\n        items { id kind params link read createdAt }\n      }\n    }\n  }\n": typeof types.NotificationsDocument,
    "\n  query Unread {\n    unreadNotifications {\n      __typename\n      ... on UnreadCount { unread }\n    }\n  }\n": typeof types.UnreadDocument,
    "\n  mutation MarkRead($ids: [ID!]) {\n    markNotificationsRead(ids: $ids) {\n      __typename\n      ... on UnreadCount { unread }\n    }\n  }\n": typeof types.MarkReadDocument,
    "\n  mutation Logout {\n    logout { ok }\n  }\n": typeof types.LogoutDocument,
    "\n  mutation UpdateProfile($input: ProfileInput!) {\n    updateProfile(input: $input) {\n      __typename\n      ... on Organizer { id firstName lastName phone organization avatarUrl lang bio { en si ta } }\n      ... on UserError { code field }\n    }\n  }\n": typeof types.UpdateProfileDocument,
    "\n  mutation ChangePassword($currentPassword: String!, $newPassword: String!) {\n    changePassword(currentPassword: $currentPassword, newPassword: $newPassword) {\n      __typename\n      ... on UserError { code field }\n    }\n  }\n": typeof types.ChangePasswordDocument,
    "\n  mutation SignOutOthers {\n    signOutOtherDevices {\n      __typename\n      ... on UserError { code }\n    }\n  }\n": typeof types.SignOutOthersDocument,
    "\n  mutation SendContactMessage($input: ContactInput!) {\n    sendContactMessage(input: $input) {\n      __typename\n      ... on UserError { code field retryAfterSeconds }\n    }\n  }\n": typeof types.SendContactMessageDocument,
};
const documents: Documents = {
    "\n  query AboutStats {\n    platformStats { upcomingConferences registeredAttendees organizers speakers }\n  }\n": types.AboutStatsDocument,
    "\n  query OgConference($slug: String!) {\n    conference(slug: $slug) {\n      title { en }\n      category\n      timezone\n      startsAt\n      endsAt\n      venue { city }\n    }\n  }\n": types.OgConferenceDocument,
    "\n  query ConferencePage($slug: String!) {\n    conference(slug: $slug) {\n      id\n      slug\n      status\n      title { en si ta }\n      summary { en si ta }\n      description { en si ta }\n      category\n      tags\n      coverUrl\n      venue { name address city location { latitude longitude } }\n      onlineUrl\n      timezone\n      startsAt\n      endsAt\n      ended\n      capacity\n      seatsLeft\n      waitlistEnabled\n      counters { waitlisted }\n      organizer { name organization }\n      days { date label { en si ta } }\n      speakers { id name jobTitle organization photoUrl bio { en si ta } links }\n      sessions {\n        id\n        day\n        kind\n        title { en si ta }\n        description { en si ta }\n        startsAt\n        endsAt\n        room\n        track { name { en si ta } color }\n        speakers { id name photoUrl }\n      }\n    }\n  }\n": types.ConferencePageDocument,
    "\n  query ConferenceMeta($slug: String!) {\n    conference(slug: $slug) {\n      title { en si ta }\n      summary { en si ta }\n    }\n  }\n": types.ConferenceMetaDocument,
    "\n  query BrowseCities {\n    upcomingCities(first: 50) { city }\n  }\n": types.BrowseCitiesDocument,
    "\n  query HomeData {\n    platformStats {\n      upcomingConferences\n      heldConferences\n      registeredAttendees\n      checkedIn\n      speakers\n      organizers\n      registrationsThisWeek\n    }\n    upcomingCategories { category count }\n    upcomingCities(first: 10) { city count }\n    conferences(first: 7) {\n      edges { node { ...ConferenceCardFields } }\n    }\n  }\n": types.HomeDataDocument,
    "\n  query TicketPage($code: String!) {\n    ticket(code: $code) {\n      code\n      name\n      email\n      status\n      confirmed\n      holdExpiresAt\n      waitlistPosition\n      checkedInAt\n      createdAt\n      conference {\n        slug\n        status\n        title { en si ta }\n        summary { en si ta }\n        category\n        coverUrl\n        timezone\n        startsAt\n        endsAt\n        ended\n        venue { name address city }\n      }\n    }\n  }\n": types.TicketPageDocument,
    "\n  query SitemapConferences($after: String) {\n    conferences(filter: { timeframe: ALL }, first: 100, after: $after) {\n      edges { node { slug } }\n      pageInfo { hasNextPage endCursor }\n    }\n  }\n": types.SitemapConferencesDocument,
    "\n  mutation Login($email: String!, $password: String!) {\n    login(email: $email, password: $password) {\n      __typename\n      ... on UserError { code field retryAfterSeconds }\n    }\n  }\n": types.LoginDocument,
    "\n  mutation AdminLogin($email: String!, $password: String!) {\n    adminLogin(email: $email, password: $password) {\n      __typename\n      ... on UserError { code field retryAfterSeconds }\n    }\n  }\n": types.AdminLoginDocument,
    "\n  mutation Register($input: RegisterInput!) {\n    register(input: $input) {\n      __typename\n      ... on CodeSent { email resendAfterSeconds }\n      ... on UserError { code field retryAfterSeconds }\n    }\n  }\n": types.RegisterDocument,
    "\n  mutation VerifyEmail($email: String!, $code: String!) {\n    verifyEmail(email: $email, code: $code) {\n      __typename\n      ... on UserError { code remainingAttempts retryAfterSeconds }\n    }\n  }\n": types.VerifyEmailDocument,
    "\n  mutation ResendCode($email: String!) {\n    resendCode(email: $email) {\n      __typename\n      ... on CodeSent { resendAfterSeconds }\n      ... on UserError { code retryAfterSeconds }\n    }\n  }\n": types.ResendCodeDocument,
    "\n  mutation ForgotPassword($email: String!) {\n    forgotPassword(email: $email) {\n      __typename\n      ... on UserError { code field retryAfterSeconds }\n    }\n  }\n": types.ForgotPasswordDocument,
    "\n  mutation ResetPassword($token: String!, $newPassword: String!) {\n    resetPassword(token: $token, newPassword: $newPassword) {\n      __typename\n      ... on UserError { code field }\n    }\n  }\n": types.ResetPasswordDocument,
    "\n  query AuthStats {\n    platformStats { upcomingConferences registeredAttendees organizers }\n  }\n": types.AuthStatsDocument,
    "\n  query BrowseConferences($filter: ConferenceFilter, $first: Int!, $after: String) {\n    conferences(filter: $filter, first: $first, after: $after) {\n      edges { node { ...ConferenceCardFields venue { location { latitude longitude } } } }\n      pageInfo { hasNextPage endCursor }\n    }\n  }\n": types.BrowseConferencesDocument,
    "\n  fragment ConferenceCardFields on Conference {\n    id\n    slug\n    status\n    title { en si ta }\n    summary { en si ta }\n    category\n    coverUrl\n    city\n    onlineUrl\n    timezone\n    startsAt\n    endsAt\n    capacity\n    seatsLeft\n    distanceKm\n    venue { name }\n  }\n": types.ConferenceCardFieldsFragmentDoc,
    "\n  mutation RegisterForConference($slug: String!, $input: AttendeeInput!) {\n    registerForConference(slug: $slug, input: $input) {\n      __typename\n      ... on Registered { ticketCode holdExpiresAt }\n      ... on Waitlisted { ticketCode position }\n      ... on AlreadyRegistered { email }\n      ... on ConferenceFull { capacity }\n      ... on UserError { code field remainingAttempts retryAfterSeconds }\n    }\n  }\n": types.RegisterForConferenceDocument,
    "\n  mutation ConfirmRegistration($ticketCode: String!, $code: String!) {\n    confirmRegistration(ticketCode: $ticketCode, code: $code) {\n      __typename\n      ... on Ticket { status waitlistPosition }\n      ... on UserError { code remainingAttempts retryAfterSeconds }\n    }\n  }\n": types.ConfirmRegistrationDocument,
    "\n  mutation ResendConfirmation($ticketCode: String!) {\n    resendConfirmation(ticketCode: $ticketCode) {\n      __typename\n      ... on ConfirmationSent { resendAfterSeconds }\n      ... on UserError { code retryAfterSeconds }\n    }\n  }\n": types.ResendConfirmationDocument,
    "\n  mutation TicketConfirm($ticketCode: String!, $code: String!) {\n    confirmRegistration(ticketCode: $ticketCode, code: $code) {\n      __typename\n      ... on Ticket { status }\n      ... on UserError { code remainingAttempts retryAfterSeconds }\n    }\n  }\n": types.TicketConfirmDocument,
    "\n  mutation TicketResend($ticketCode: String!) {\n    resendConfirmation(ticketCode: $ticketCode) {\n      __typename\n      ... on ConfirmationSent { resendAfterSeconds }\n      ... on UserError { code retryAfterSeconds }\n    }\n  }\n": types.TicketResendDocument,
    "\n  mutation TicketCancel($ticketCode: String!) {\n    cancelRegistration(ticketCode: $ticketCode) {\n      __typename\n      ... on Ticket { status }\n      ... on UserError { code retryAfterSeconds }\n    }\n  }\n": types.TicketCancelDocument,
    "\n  fragment EditorConferenceFields on Conference {\n    id\n    slug\n    status\n    title { en si ta }\n    summary { en si ta }\n    description { en si ta }\n    category\n    tags\n    coverUrl\n    venue { name address city location { latitude longitude } }\n    onlineUrl\n    timezone\n    startsAt\n    endsAt\n    ended\n    capacity\n    waitlistEnabled\n    counters { registered confirmed waitlisted checkedIn }\n    publishProblems\n    days { date label { en si ta } }\n    tracks { id name { en si ta } color }\n    speakers { id name jobTitle organization photoUrl bio { en si ta } links }\n    sessions {\n      id\n      day\n      kind\n      title { en si ta }\n      description { en si ta }\n      startsAt\n      endsAt\n      room\n      capacity\n      track { id }\n      speakers { id }\n    }\n  }\n": types.EditorConferenceFieldsFragmentDoc,
    "\n  query MyConferences {\n    myConferences {\n      __typename\n      ... on ConferenceList {\n        items {\n          id\n          slug\n          status\n          title { en si ta }\n          category\n          coverUrl\n          timezone\n          startsAt\n          endsAt\n          ended\n          capacity\n          venue { city }\n          counters { registered confirmed waitlisted checkedIn }\n        }\n      }\n      ... on UserError { code }\n    }\n  }\n": types.MyConferencesDocument,
    "\n  query MyConference($id: ID!) {\n    myConference(id: $id) {\n      __typename\n      ... on Conference { ...EditorConferenceFields }\n      ... on UserError { code }\n    }\n  }\n": types.MyConferenceDocument,
    "\n  mutation CreateConference($input: ConferenceInput!) {\n    createConference(input: $input) {\n      __typename\n      ... on Conference { id }\n      ... on UserError { code field }\n    }\n  }\n": types.CreateConferenceDocument,
    "\n  mutation UpdateConference($id: ID!, $input: ConferenceInput!) {\n    updateConference(id: $id, input: $input) {\n      __typename\n      ... on Conference { ...EditorConferenceFields }\n      ... on UserError { code field }\n    }\n  }\n": types.UpdateConferenceDocument,
    "\n  mutation PublishConference($id: ID!) {\n    publishConference(id: $id) {\n      __typename\n      ... on Conference { ...EditorConferenceFields }\n      ... on UserError { code field }\n    }\n  }\n": types.PublishConferenceDocument,
    "\n  mutation UnpublishConference($id: ID!) {\n    unpublishConference(id: $id) {\n      __typename\n      ... on Conference { ...EditorConferenceFields }\n      ... on UserError { code field }\n    }\n  }\n": types.UnpublishConferenceDocument,
    "\n  mutation CancelConference($id: ID!) {\n    cancelConference(id: $id) {\n      __typename\n      ... on Conference { ...EditorConferenceFields }\n      ... on UserError { code field }\n    }\n  }\n": types.CancelConferenceDocument,
    "\n  mutation DuplicateConference($id: ID!) {\n    duplicateConference(id: $id) {\n      __typename\n      ... on Conference { id }\n      ... on UserError { code }\n    }\n  }\n": types.DuplicateConferenceDocument,
    "\n  mutation DeleteConference($id: ID!) {\n    deleteConference(id: $id) {\n      __typename\n      ... on UserError { code }\n    }\n  }\n": types.DeleteConferenceDocument,
    "\n  mutation UpsertTrack($conferenceId: ID!, $input: TrackInput!, $trackId: ID) {\n    upsertTrack(conferenceId: $conferenceId, input: $input, trackId: $trackId) {\n      __typename\n      ... on UserError { code field }\n    }\n  }\n": types.UpsertTrackDocument,
    "\n  mutation RemoveTrack($conferenceId: ID!, $trackId: ID!) {\n    removeTrack(conferenceId: $conferenceId, trackId: $trackId) {\n      __typename\n      ... on UserError { code }\n    }\n  }\n": types.RemoveTrackDocument,
    "\n  mutation UpsertSpeaker($conferenceId: ID!, $input: SpeakerInput!, $speakerId: ID) {\n    upsertSpeaker(conferenceId: $conferenceId, input: $input, speakerId: $speakerId) {\n      __typename\n      ... on UserError { code field }\n    }\n  }\n": types.UpsertSpeakerDocument,
    "\n  mutation RemoveSpeaker($conferenceId: ID!, $speakerId: ID!) {\n    removeSpeaker(conferenceId: $conferenceId, speakerId: $speakerId) {\n      __typename\n      ... on UserError { code }\n    }\n  }\n": types.RemoveSpeakerDocument,
    "\n  mutation UpsertSession($conferenceId: ID!, $input: SessionInput!, $sessionId: ID) {\n    upsertSession(conferenceId: $conferenceId, input: $input, sessionId: $sessionId) {\n      __typename\n      ... on UserError { code field }\n    }\n  }\n": types.UpsertSessionDocument,
    "\n  mutation RemoveSession($conferenceId: ID!, $sessionId: ID!) {\n    removeSession(conferenceId: $conferenceId, sessionId: $sessionId) {\n      __typename\n      ... on UserError { code }\n    }\n  }\n": types.RemoveSessionDocument,
    "\n  mutation SetDayLabel($conferenceId: ID!, $day: Date!, $label: LocalizedTextInput) {\n    setDayLabel(conferenceId: $conferenceId, day: $day, label: $label) {\n      __typename\n      ... on UserError { code field }\n    }\n  }\n": types.SetDayLabelDocument,
    "\n  query Attendees($conferenceId: ID!, $filter: AttendeeFilter, $first: Int!, $after: String) {\n    attendees(conferenceId: $conferenceId, filter: $filter, first: $first, after: $after) {\n      __typename\n      ... on AttendeeConnection {\n        totalCount\n        pageInfo { hasNextPage endCursor }\n        edges {\n          node { id name email lang status ticketCode confirmedAt promotedAt checkedInAt cancelledAt createdAt }\n        }\n      }\n      ... on UserError { code }\n    }\n  }\n": types.AttendeesDocument,
    "\n  mutation RemoveAttendee($conferenceId: ID!, $attendeeId: ID!) {\n    removeAttendee(conferenceId: $conferenceId, attendeeId: $attendeeId) {\n      __typename\n      ... on UserError { code }\n    }\n  }\n": types.RemoveAttendeeDocument,
    "\n  mutation UndoCheckIn($conferenceId: ID!, $attendeeId: ID!) {\n    undoCheckIn(conferenceId: $conferenceId, attendeeId: $attendeeId) {\n      __typename\n      ... on UserError { code }\n    }\n  }\n": types.UndoCheckInDocument,
    "\n  mutation SendReminders($conferenceId: ID!) {\n    sendRemindersNow(conferenceId: $conferenceId) {\n      __typename\n      ... on RemindersSent { count }\n      ... on UserError { code retryAfterSeconds }\n    }\n  }\n": types.SendRemindersDocument,
    "\n  query DashboardData {\n    myConferences {\n      __typename\n      ... on ConferenceList {\n        items {\n          id\n          slug\n          status\n          title { en si ta }\n          timezone\n          startsAt\n          endsAt\n          ended\n          capacity\n          counters { registered confirmed waitlisted checkedIn }\n          sessions { id }\n        }\n      }\n    }\n  }\n": types.DashboardDataDocument,
    "\n  query Me {\n    me {\n      __typename\n      ... on Organizer {\n        id\n        firstName\n        lastName\n        email\n        phone\n        organization\n        avatarUrl\n        lang\n        createdAt\n        bio { en si ta }\n      }\n      ... on Admin { id username email }\n    }\n  }\n": types.MeDocument,
    "\n  query Notifications($first: Int!, $after: String) {\n    notifications(first: $first, after: $after) {\n      __typename\n      ... on NotificationPage {\n        unread\n        hasNextPage\n        endCursor\n        items { id kind params link read createdAt }\n      }\n    }\n  }\n": types.NotificationsDocument,
    "\n  query Unread {\n    unreadNotifications {\n      __typename\n      ... on UnreadCount { unread }\n    }\n  }\n": types.UnreadDocument,
    "\n  mutation MarkRead($ids: [ID!]) {\n    markNotificationsRead(ids: $ids) {\n      __typename\n      ... on UnreadCount { unread }\n    }\n  }\n": types.MarkReadDocument,
    "\n  mutation Logout {\n    logout { ok }\n  }\n": types.LogoutDocument,
    "\n  mutation UpdateProfile($input: ProfileInput!) {\n    updateProfile(input: $input) {\n      __typename\n      ... on Organizer { id firstName lastName phone organization avatarUrl lang bio { en si ta } }\n      ... on UserError { code field }\n    }\n  }\n": types.UpdateProfileDocument,
    "\n  mutation ChangePassword($currentPassword: String!, $newPassword: String!) {\n    changePassword(currentPassword: $currentPassword, newPassword: $newPassword) {\n      __typename\n      ... on UserError { code field }\n    }\n  }\n": types.ChangePasswordDocument,
    "\n  mutation SignOutOthers {\n    signOutOtherDevices {\n      __typename\n      ... on UserError { code }\n    }\n  }\n": types.SignOutOthersDocument,
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
export function graphql(source: "\n  query ConferenceMeta($slug: String!) {\n    conference(slug: $slug) {\n      title { en si ta }\n      summary { en si ta }\n    }\n  }\n"): (typeof documents)["\n  query ConferenceMeta($slug: String!) {\n    conference(slug: $slug) {\n      title { en si ta }\n      summary { en si ta }\n    }\n  }\n"];
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
export function graphql(source: "\n  mutation Login($email: String!, $password: String!) {\n    login(email: $email, password: $password) {\n      __typename\n      ... on UserError { code field retryAfterSeconds }\n    }\n  }\n"): (typeof documents)["\n  mutation Login($email: String!, $password: String!) {\n    login(email: $email, password: $password) {\n      __typename\n      ... on UserError { code field retryAfterSeconds }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation AdminLogin($email: String!, $password: String!) {\n    adminLogin(email: $email, password: $password) {\n      __typename\n      ... on UserError { code field retryAfterSeconds }\n    }\n  }\n"): (typeof documents)["\n  mutation AdminLogin($email: String!, $password: String!) {\n    adminLogin(email: $email, password: $password) {\n      __typename\n      ... on UserError { code field retryAfterSeconds }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation Register($input: RegisterInput!) {\n    register(input: $input) {\n      __typename\n      ... on CodeSent { email resendAfterSeconds }\n      ... on UserError { code field retryAfterSeconds }\n    }\n  }\n"): (typeof documents)["\n  mutation Register($input: RegisterInput!) {\n    register(input: $input) {\n      __typename\n      ... on CodeSent { email resendAfterSeconds }\n      ... on UserError { code field retryAfterSeconds }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation VerifyEmail($email: String!, $code: String!) {\n    verifyEmail(email: $email, code: $code) {\n      __typename\n      ... on UserError { code remainingAttempts retryAfterSeconds }\n    }\n  }\n"): (typeof documents)["\n  mutation VerifyEmail($email: String!, $code: String!) {\n    verifyEmail(email: $email, code: $code) {\n      __typename\n      ... on UserError { code remainingAttempts retryAfterSeconds }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ResendCode($email: String!) {\n    resendCode(email: $email) {\n      __typename\n      ... on CodeSent { resendAfterSeconds }\n      ... on UserError { code retryAfterSeconds }\n    }\n  }\n"): (typeof documents)["\n  mutation ResendCode($email: String!) {\n    resendCode(email: $email) {\n      __typename\n      ... on CodeSent { resendAfterSeconds }\n      ... on UserError { code retryAfterSeconds }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ForgotPassword($email: String!) {\n    forgotPassword(email: $email) {\n      __typename\n      ... on UserError { code field retryAfterSeconds }\n    }\n  }\n"): (typeof documents)["\n  mutation ForgotPassword($email: String!) {\n    forgotPassword(email: $email) {\n      __typename\n      ... on UserError { code field retryAfterSeconds }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ResetPassword($token: String!, $newPassword: String!) {\n    resetPassword(token: $token, newPassword: $newPassword) {\n      __typename\n      ... on UserError { code field }\n    }\n  }\n"): (typeof documents)["\n  mutation ResetPassword($token: String!, $newPassword: String!) {\n    resetPassword(token: $token, newPassword: $newPassword) {\n      __typename\n      ... on UserError { code field }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query AuthStats {\n    platformStats { upcomingConferences registeredAttendees organizers }\n  }\n"): (typeof documents)["\n  query AuthStats {\n    platformStats { upcomingConferences registeredAttendees organizers }\n  }\n"];
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
export function graphql(source: "\n  fragment EditorConferenceFields on Conference {\n    id\n    slug\n    status\n    title { en si ta }\n    summary { en si ta }\n    description { en si ta }\n    category\n    tags\n    coverUrl\n    venue { name address city location { latitude longitude } }\n    onlineUrl\n    timezone\n    startsAt\n    endsAt\n    ended\n    capacity\n    waitlistEnabled\n    counters { registered confirmed waitlisted checkedIn }\n    publishProblems\n    days { date label { en si ta } }\n    tracks { id name { en si ta } color }\n    speakers { id name jobTitle organization photoUrl bio { en si ta } links }\n    sessions {\n      id\n      day\n      kind\n      title { en si ta }\n      description { en si ta }\n      startsAt\n      endsAt\n      room\n      capacity\n      track { id }\n      speakers { id }\n    }\n  }\n"): (typeof documents)["\n  fragment EditorConferenceFields on Conference {\n    id\n    slug\n    status\n    title { en si ta }\n    summary { en si ta }\n    description { en si ta }\n    category\n    tags\n    coverUrl\n    venue { name address city location { latitude longitude } }\n    onlineUrl\n    timezone\n    startsAt\n    endsAt\n    ended\n    capacity\n    waitlistEnabled\n    counters { registered confirmed waitlisted checkedIn }\n    publishProblems\n    days { date label { en si ta } }\n    tracks { id name { en si ta } color }\n    speakers { id name jobTitle organization photoUrl bio { en si ta } links }\n    sessions {\n      id\n      day\n      kind\n      title { en si ta }\n      description { en si ta }\n      startsAt\n      endsAt\n      room\n      capacity\n      track { id }\n      speakers { id }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query MyConferences {\n    myConferences {\n      __typename\n      ... on ConferenceList {\n        items {\n          id\n          slug\n          status\n          title { en si ta }\n          category\n          coverUrl\n          timezone\n          startsAt\n          endsAt\n          ended\n          capacity\n          venue { city }\n          counters { registered confirmed waitlisted checkedIn }\n        }\n      }\n      ... on UserError { code }\n    }\n  }\n"): (typeof documents)["\n  query MyConferences {\n    myConferences {\n      __typename\n      ... on ConferenceList {\n        items {\n          id\n          slug\n          status\n          title { en si ta }\n          category\n          coverUrl\n          timezone\n          startsAt\n          endsAt\n          ended\n          capacity\n          venue { city }\n          counters { registered confirmed waitlisted checkedIn }\n        }\n      }\n      ... on UserError { code }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query MyConference($id: ID!) {\n    myConference(id: $id) {\n      __typename\n      ... on Conference { ...EditorConferenceFields }\n      ... on UserError { code }\n    }\n  }\n"): (typeof documents)["\n  query MyConference($id: ID!) {\n    myConference(id: $id) {\n      __typename\n      ... on Conference { ...EditorConferenceFields }\n      ... on UserError { code }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateConference($input: ConferenceInput!) {\n    createConference(input: $input) {\n      __typename\n      ... on Conference { id }\n      ... on UserError { code field }\n    }\n  }\n"): (typeof documents)["\n  mutation CreateConference($input: ConferenceInput!) {\n    createConference(input: $input) {\n      __typename\n      ... on Conference { id }\n      ... on UserError { code field }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateConference($id: ID!, $input: ConferenceInput!) {\n    updateConference(id: $id, input: $input) {\n      __typename\n      ... on Conference { ...EditorConferenceFields }\n      ... on UserError { code field }\n    }\n  }\n"): (typeof documents)["\n  mutation UpdateConference($id: ID!, $input: ConferenceInput!) {\n    updateConference(id: $id, input: $input) {\n      __typename\n      ... on Conference { ...EditorConferenceFields }\n      ... on UserError { code field }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation PublishConference($id: ID!) {\n    publishConference(id: $id) {\n      __typename\n      ... on Conference { ...EditorConferenceFields }\n      ... on UserError { code field }\n    }\n  }\n"): (typeof documents)["\n  mutation PublishConference($id: ID!) {\n    publishConference(id: $id) {\n      __typename\n      ... on Conference { ...EditorConferenceFields }\n      ... on UserError { code field }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UnpublishConference($id: ID!) {\n    unpublishConference(id: $id) {\n      __typename\n      ... on Conference { ...EditorConferenceFields }\n      ... on UserError { code field }\n    }\n  }\n"): (typeof documents)["\n  mutation UnpublishConference($id: ID!) {\n    unpublishConference(id: $id) {\n      __typename\n      ... on Conference { ...EditorConferenceFields }\n      ... on UserError { code field }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CancelConference($id: ID!) {\n    cancelConference(id: $id) {\n      __typename\n      ... on Conference { ...EditorConferenceFields }\n      ... on UserError { code field }\n    }\n  }\n"): (typeof documents)["\n  mutation CancelConference($id: ID!) {\n    cancelConference(id: $id) {\n      __typename\n      ... on Conference { ...EditorConferenceFields }\n      ... on UserError { code field }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DuplicateConference($id: ID!) {\n    duplicateConference(id: $id) {\n      __typename\n      ... on Conference { id }\n      ... on UserError { code }\n    }\n  }\n"): (typeof documents)["\n  mutation DuplicateConference($id: ID!) {\n    duplicateConference(id: $id) {\n      __typename\n      ... on Conference { id }\n      ... on UserError { code }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteConference($id: ID!) {\n    deleteConference(id: $id) {\n      __typename\n      ... on UserError { code }\n    }\n  }\n"): (typeof documents)["\n  mutation DeleteConference($id: ID!) {\n    deleteConference(id: $id) {\n      __typename\n      ... on UserError { code }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpsertTrack($conferenceId: ID!, $input: TrackInput!, $trackId: ID) {\n    upsertTrack(conferenceId: $conferenceId, input: $input, trackId: $trackId) {\n      __typename\n      ... on UserError { code field }\n    }\n  }\n"): (typeof documents)["\n  mutation UpsertTrack($conferenceId: ID!, $input: TrackInput!, $trackId: ID) {\n    upsertTrack(conferenceId: $conferenceId, input: $input, trackId: $trackId) {\n      __typename\n      ... on UserError { code field }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RemoveTrack($conferenceId: ID!, $trackId: ID!) {\n    removeTrack(conferenceId: $conferenceId, trackId: $trackId) {\n      __typename\n      ... on UserError { code }\n    }\n  }\n"): (typeof documents)["\n  mutation RemoveTrack($conferenceId: ID!, $trackId: ID!) {\n    removeTrack(conferenceId: $conferenceId, trackId: $trackId) {\n      __typename\n      ... on UserError { code }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpsertSpeaker($conferenceId: ID!, $input: SpeakerInput!, $speakerId: ID) {\n    upsertSpeaker(conferenceId: $conferenceId, input: $input, speakerId: $speakerId) {\n      __typename\n      ... on UserError { code field }\n    }\n  }\n"): (typeof documents)["\n  mutation UpsertSpeaker($conferenceId: ID!, $input: SpeakerInput!, $speakerId: ID) {\n    upsertSpeaker(conferenceId: $conferenceId, input: $input, speakerId: $speakerId) {\n      __typename\n      ... on UserError { code field }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RemoveSpeaker($conferenceId: ID!, $speakerId: ID!) {\n    removeSpeaker(conferenceId: $conferenceId, speakerId: $speakerId) {\n      __typename\n      ... on UserError { code }\n    }\n  }\n"): (typeof documents)["\n  mutation RemoveSpeaker($conferenceId: ID!, $speakerId: ID!) {\n    removeSpeaker(conferenceId: $conferenceId, speakerId: $speakerId) {\n      __typename\n      ... on UserError { code }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpsertSession($conferenceId: ID!, $input: SessionInput!, $sessionId: ID) {\n    upsertSession(conferenceId: $conferenceId, input: $input, sessionId: $sessionId) {\n      __typename\n      ... on UserError { code field }\n    }\n  }\n"): (typeof documents)["\n  mutation UpsertSession($conferenceId: ID!, $input: SessionInput!, $sessionId: ID) {\n    upsertSession(conferenceId: $conferenceId, input: $input, sessionId: $sessionId) {\n      __typename\n      ... on UserError { code field }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RemoveSession($conferenceId: ID!, $sessionId: ID!) {\n    removeSession(conferenceId: $conferenceId, sessionId: $sessionId) {\n      __typename\n      ... on UserError { code }\n    }\n  }\n"): (typeof documents)["\n  mutation RemoveSession($conferenceId: ID!, $sessionId: ID!) {\n    removeSession(conferenceId: $conferenceId, sessionId: $sessionId) {\n      __typename\n      ... on UserError { code }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetDayLabel($conferenceId: ID!, $day: Date!, $label: LocalizedTextInput) {\n    setDayLabel(conferenceId: $conferenceId, day: $day, label: $label) {\n      __typename\n      ... on UserError { code field }\n    }\n  }\n"): (typeof documents)["\n  mutation SetDayLabel($conferenceId: ID!, $day: Date!, $label: LocalizedTextInput) {\n    setDayLabel(conferenceId: $conferenceId, day: $day, label: $label) {\n      __typename\n      ... on UserError { code field }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Attendees($conferenceId: ID!, $filter: AttendeeFilter, $first: Int!, $after: String) {\n    attendees(conferenceId: $conferenceId, filter: $filter, first: $first, after: $after) {\n      __typename\n      ... on AttendeeConnection {\n        totalCount\n        pageInfo { hasNextPage endCursor }\n        edges {\n          node { id name email lang status ticketCode confirmedAt promotedAt checkedInAt cancelledAt createdAt }\n        }\n      }\n      ... on UserError { code }\n    }\n  }\n"): (typeof documents)["\n  query Attendees($conferenceId: ID!, $filter: AttendeeFilter, $first: Int!, $after: String) {\n    attendees(conferenceId: $conferenceId, filter: $filter, first: $first, after: $after) {\n      __typename\n      ... on AttendeeConnection {\n        totalCount\n        pageInfo { hasNextPage endCursor }\n        edges {\n          node { id name email lang status ticketCode confirmedAt promotedAt checkedInAt cancelledAt createdAt }\n        }\n      }\n      ... on UserError { code }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RemoveAttendee($conferenceId: ID!, $attendeeId: ID!) {\n    removeAttendee(conferenceId: $conferenceId, attendeeId: $attendeeId) {\n      __typename\n      ... on UserError { code }\n    }\n  }\n"): (typeof documents)["\n  mutation RemoveAttendee($conferenceId: ID!, $attendeeId: ID!) {\n    removeAttendee(conferenceId: $conferenceId, attendeeId: $attendeeId) {\n      __typename\n      ... on UserError { code }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UndoCheckIn($conferenceId: ID!, $attendeeId: ID!) {\n    undoCheckIn(conferenceId: $conferenceId, attendeeId: $attendeeId) {\n      __typename\n      ... on UserError { code }\n    }\n  }\n"): (typeof documents)["\n  mutation UndoCheckIn($conferenceId: ID!, $attendeeId: ID!) {\n    undoCheckIn(conferenceId: $conferenceId, attendeeId: $attendeeId) {\n      __typename\n      ... on UserError { code }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SendReminders($conferenceId: ID!) {\n    sendRemindersNow(conferenceId: $conferenceId) {\n      __typename\n      ... on RemindersSent { count }\n      ... on UserError { code retryAfterSeconds }\n    }\n  }\n"): (typeof documents)["\n  mutation SendReminders($conferenceId: ID!) {\n    sendRemindersNow(conferenceId: $conferenceId) {\n      __typename\n      ... on RemindersSent { count }\n      ... on UserError { code retryAfterSeconds }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query DashboardData {\n    myConferences {\n      __typename\n      ... on ConferenceList {\n        items {\n          id\n          slug\n          status\n          title { en si ta }\n          timezone\n          startsAt\n          endsAt\n          ended\n          capacity\n          counters { registered confirmed waitlisted checkedIn }\n          sessions { id }\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query DashboardData {\n    myConferences {\n      __typename\n      ... on ConferenceList {\n        items {\n          id\n          slug\n          status\n          title { en si ta }\n          timezone\n          startsAt\n          endsAt\n          ended\n          capacity\n          counters { registered confirmed waitlisted checkedIn }\n          sessions { id }\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Me {\n    me {\n      __typename\n      ... on Organizer {\n        id\n        firstName\n        lastName\n        email\n        phone\n        organization\n        avatarUrl\n        lang\n        createdAt\n        bio { en si ta }\n      }\n      ... on Admin { id username email }\n    }\n  }\n"): (typeof documents)["\n  query Me {\n    me {\n      __typename\n      ... on Organizer {\n        id\n        firstName\n        lastName\n        email\n        phone\n        organization\n        avatarUrl\n        lang\n        createdAt\n        bio { en si ta }\n      }\n      ... on Admin { id username email }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Notifications($first: Int!, $after: String) {\n    notifications(first: $first, after: $after) {\n      __typename\n      ... on NotificationPage {\n        unread\n        hasNextPage\n        endCursor\n        items { id kind params link read createdAt }\n      }\n    }\n  }\n"): (typeof documents)["\n  query Notifications($first: Int!, $after: String) {\n    notifications(first: $first, after: $after) {\n      __typename\n      ... on NotificationPage {\n        unread\n        hasNextPage\n        endCursor\n        items { id kind params link read createdAt }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Unread {\n    unreadNotifications {\n      __typename\n      ... on UnreadCount { unread }\n    }\n  }\n"): (typeof documents)["\n  query Unread {\n    unreadNotifications {\n      __typename\n      ... on UnreadCount { unread }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation MarkRead($ids: [ID!]) {\n    markNotificationsRead(ids: $ids) {\n      __typename\n      ... on UnreadCount { unread }\n    }\n  }\n"): (typeof documents)["\n  mutation MarkRead($ids: [ID!]) {\n    markNotificationsRead(ids: $ids) {\n      __typename\n      ... on UnreadCount { unread }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation Logout {\n    logout { ok }\n  }\n"): (typeof documents)["\n  mutation Logout {\n    logout { ok }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateProfile($input: ProfileInput!) {\n    updateProfile(input: $input) {\n      __typename\n      ... on Organizer { id firstName lastName phone organization avatarUrl lang bio { en si ta } }\n      ... on UserError { code field }\n    }\n  }\n"): (typeof documents)["\n  mutation UpdateProfile($input: ProfileInput!) {\n    updateProfile(input: $input) {\n      __typename\n      ... on Organizer { id firstName lastName phone organization avatarUrl lang bio { en si ta } }\n      ... on UserError { code field }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ChangePassword($currentPassword: String!, $newPassword: String!) {\n    changePassword(currentPassword: $currentPassword, newPassword: $newPassword) {\n      __typename\n      ... on UserError { code field }\n    }\n  }\n"): (typeof documents)["\n  mutation ChangePassword($currentPassword: String!, $newPassword: String!) {\n    changePassword(currentPassword: $currentPassword, newPassword: $newPassword) {\n      __typename\n      ... on UserError { code field }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SignOutOthers {\n    signOutOtherDevices {\n      __typename\n      ... on UserError { code }\n    }\n  }\n"): (typeof documents)["\n  mutation SignOutOthers {\n    signOutOtherDevices {\n      __typename\n      ... on UserError { code }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SendContactMessage($input: ContactInput!) {\n    sendContactMessage(input: $input) {\n      __typename\n      ... on UserError { code field retryAfterSeconds }\n    }\n  }\n"): (typeof documents)["\n  mutation SendContactMessage($input: ContactInput!) {\n    sendContactMessage(input: $input) {\n      __typename\n      ... on UserError { code field retryAfterSeconds }\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;