# GraphQL API reference

Generated from the code by `uv run python -m scripts.export_schema`; do not edit by hand. The schema itself is in
[`web/src/graphql/schema.graphql`](../web/src/graphql/schema.graphql).

- **Endpoint:** `POST /graphql` on the API (the web app reaches it as `/api/graphql`, same site).
- **Sign-in:** httpOnly cookies set by `login` / `adminLogin` (see [ADR 0005](adr/0005-cookie-sessions.md)).
  Every mutation needs the `X-CSRF-Token` header with the value of the `cm_csrf` cookie.
- **Errors:** expected failures are data, not exceptions: most fields return a union with a `UserError` member
  (`code`, `message`, `field`). Ask for `__typename` and handle `UserError`.
- **Live updates** are server-sent events outside GraphQL: `GET /conferences/{id}/live` (check-ins, owner only) and
  `GET /conferences/{id}/qa-live` (live Q&A signals).

## Queries

### `activityLog`

Returns [`ActivityPageResult!`](#activitypageresult).

| Argument | Type | Default |
|---|---|---|
| `actorType` | `String` |  |
| `action` | `String` |  |
| `first` | `Int!` | `50` |
| `offset` | `Int!` | `0` |

### `adminConferences`

Returns [`AdminConferencePageResult!`](#adminconferencepageresult).

| Argument | Type | Default |
|---|---|---|
| `q` | `String` |  |
| `status` | [`AdminConferenceFilter!`](#adminconferencefilter) | `ALL` |
| `first` | `Int!` | `25` |
| `offset` | `Int!` | `0` |

### `adminFeedback`

Returns [`FeedbackPageResult!`](#feedbackpageresult).

| Argument | Type | Default |
|---|---|---|
| `status` | [`FeedbackStatus`](#feedbackstatus) |  |
| `first` | `Int!` | `25` |
| `offset` | `Int!` | `0` |

### `adminOrganizers`

Returns [`AdminOrganizerPageResult!`](#adminorganizerpageresult).

| Argument | Type | Default |
|---|---|---|
| `q` | `String` |  |
| `status` | [`OrganizerFilter!`](#organizerfilter) | `ALL` |
| `first` | `Int!` | `25` |
| `offset` | `Int!` | `0` |

### `adminOverview`

Returns [`AdminOverviewResult!`](#adminoverviewresult). Platform numbers for the admin dashboard.

### `analyticsOverview`

Returns [`AnalyticsOverviewResult!`](#analyticsoverviewresult). Sign-ups per day over the last `days` across your conferences, and how full each one is.

| Argument | Type | Default |
|---|---|---|
| `days` | `Int!` | `30` |

### `attendees`

Returns [`AttendeesResult!`](#attendeesresult). The attendees of one of the signed-in organizer's conferences.

| Argument | Type | Default |
|---|---|---|
| `conferenceId` | `ID!` | `Undefined` |
| `filter` | [`AttendeeFilter`](#attendeefilter) |  |
| `first` | `Int!` | `50` |
| `after` | `String` |  |

### `categories`

Returns [`[Category!]!`](#category).

### `conference`

Returns [`Conference`](#conference). One public conference by its web address.

| Argument | Type | Default |
|---|---|---|
| `slug` | `String!` | `Undefined` |

### `conferenceAnalytics`

Returns [`ConferenceAnalyticsResult!`](#conferenceanalyticsresult). Registrations over time, arrivals, and breakdowns for one of your conferences.

| Argument | Type | Default |
|---|---|---|
| `conferenceId` | `ID!` | `Undefined` |

### `conferenceFeedback`

Returns [`ConferenceFeedbackResult!`](#conferencefeedbackresult). Ratings and comments for one of the signed-in organizer's conferences.

| Argument | Type | Default |
|---|---|---|
| `conferenceId` | `ID!` | `Undefined` |

### `conferences`

Returns [`ConferenceConnection!`](#conferenceconnection). Published (and cancelled) conferences: soonest first, or nearest first with `near`. Without a date range, only conferences that have not ended.

| Argument | Type | Default |
|---|---|---|
| `filter` | [`ConferenceFilter`](#conferencefilter) |  |
| `first` | `Int!` | `20` |
| `after` | `String` |  |

### `contactMessages`

Returns [`ContactPageResult!`](#contactpageresult).

| Argument | Type | Default |
|---|---|---|
| `status` | [`ContactStatus`](#contactstatus) |  |
| `first` | `Int!` | `25` |
| `offset` | `Int!` | `0` |

### `liveQuestions`

Returns [`QaBoardResult!`](#qaboardresult). Live Q&A for a ticket holder: one session's questions (the current or next session when none is given), most votes first.

| Argument | Type | Default |
|---|---|---|
| `ticketCode` | `String!` | `Undefined` |
| `sessionId` | `ID` |  |

### `me`

Returns [`Viewer`](#viewer). The signed-in organizer or admin, or null.

### `myConference`

Returns [`ConferenceResult!`](#conferenceresult). One of the signed-in organizer's conferences, for editing (drafts included).

| Argument | Type | Default |
|---|---|---|
| `id` | `ID!` | `Undefined` |

### `myConferences`

Returns [`ConferenceListResult!`](#conferencelistresult). The signed-in organizer's conferences, newest first, in every status.

### `myFeedback`

Returns [`FeedbackListResult!`](#feedbacklistresult). The signed-in organizer's own feedback and the replies.

### `notifications`

Returns [`NotificationPageResult!`](#notificationpageresult). The signed-in person's notifications, newest first.

| Argument | Type | Default |
|---|---|---|
| `first` | `Int!` | `30` |
| `after` | `String` |  |

### `platformStats`

Returns [`PlatformStats!`](#platformstats). Platform-wide numbers, refreshed every minute.

### `sessionQuestions`

Returns [`SessionQuestionsResult!`](#sessionquestionsresult). All questions in one session of the signed-in organizer's conference.

| Argument | Type | Default |
|---|---|---|
| `conferenceId` | `ID!` | `Undefined` |
| `sessionId` | `ID!` | `Undefined` |

### `systemStatus`

Returns [`SystemStatusResult!`](#systemstatusresult). Databases, the worker and its jobs, the queue, and recent errors.

### `ticket`

Returns [`Ticket`](#ticket). A ticket by the code from the email (the code is the only key to it).

| Argument | Type | Default |
|---|---|---|
| `code` | `String!` | `Undefined` |

### `unreadNotifications`

Returns [`UnreadCountResult!`](#unreadcountresult). How many notifications are unread (for the bell in the header).

### `upcomingCategories`

Returns [`[CategoryCount!]!`](#categorycount). How many upcoming conferences each topic has (topics with none are left out).

### `upcomingCities`

Returns [`[CityCount!]!`](#citycount). Cities with upcoming conferences, most first.

| Argument | Type | Default |
|---|---|---|
| `first` | `Int!` | `12` |

## Mutations

### `adminLogin`

Returns [`AuthResult!`](#authresult). Administrator sign-in, by email (or the username 'admin').

| Argument | Type | Default |
|---|---|---|
| `email` | `String!` | `Undefined` |
| `password` | `String!` | `Undefined` |

### `askQuestion`

Returns [`LiveQuestionResult!`](#livequestionresult). Ask a question in a session (3-300 characters). Confirmed ticket holders only.

| Argument | Type | Default |
|---|---|---|
| `ticketCode` | `String!` | `Undefined` |
| `sessionId` | `ID!` | `Undefined` |
| `text` | `String!` | `Undefined` |

### `cancelConference`

Returns [`ConferenceResult!`](#conferenceresult). Cancel a published conference; it stays visible, marked as cancelled.

| Argument | Type | Default |
|---|---|---|
| `id` | `ID!` | `Undefined` |

### `cancelRegistration`

Returns [`TicketResult!`](#ticketresult). Cancel by ticket code; the seat goes to the next confirmed waitlister.

| Argument | Type | Default |
|---|---|---|
| `ticketCode` | `String!` | `Undefined` |

### `changePassword`

Returns [`DoneResult!`](#doneresult). Change the password. Keeps this device signed in, signs out the others.

| Argument | Type | Default |
|---|---|---|
| `currentPassword` | `String!` | `Undefined` |
| `newPassword` | `String!` | `Undefined` |

### `checkIn`

Returns [`CheckInResult!`](#checkinresult). Check someone in by the code on their ticket (QR or typed). An offline desk sends `scannedAt` when it syncs (ignored if in the future or over a day old).

| Argument | Type | Default |
|---|---|---|
| `conferenceId` | `ID!` | `Undefined` |
| `code` | `String!` | `Undefined` |
| `gate` | `String!` | `main` |
| `scannedAt` | [`DateTime`](#datetime) |  |

### `closeFeedback`

Returns [`FeedbackResult!`](#feedbackresult).

| Argument | Type | Default |
|---|---|---|
| `id` | `ID!` | `Undefined` |

### `confirmRegistration`

Returns [`TicketResult!`](#ticketresult). Enter the emailed code: confirms the seat (or the waitlist place).

| Argument | Type | Default |
|---|---|---|
| `ticketCode` | `String!` | `Undefined` |
| `code` | `String!` | `Undefined` |

### `createConference`

Returns [`ConferenceResult!`](#conferenceresult). Create a draft conference owned by the signed-in organizer.

| Argument | Type | Default |
|---|---|---|
| `input` | [`ConferenceInput!`](#conferenceinput) | `Undefined` |

### `deleteConference`

Returns [`DoneResult!`](#doneresult). Delete a conference and its images; only while nobody has registered.

| Argument | Type | Default |
|---|---|---|
| `id` | `ID!` | `Undefined` |

### `deleteOrganizer`

Returns [`RemovedResult!`](#removedresult). Delete the organizer and everything they own; attendees of upcoming events are emailed.

| Argument | Type | Default |
|---|---|---|
| `id` | `ID!` | `Undefined` |

### `duplicateConference`

Returns [`ConferenceResult!`](#conferenceresult). Copy a conference (details, agenda and images) into a new draft.

| Argument | Type | Default |
|---|---|---|
| `id` | `ID!` | `Undefined` |

### `forgotPassword`

Returns [`DoneResult!`](#doneresult). Emails a reset link when the address is registered. Same answer either way.

| Argument | Type | Default |
|---|---|---|
| `email` | `String!` | `Undefined` |

### `login`

Returns [`AuthResult!`](#authresult).

| Argument | Type | Default |
|---|---|---|
| `email` | `String!` | `Undefined` |
| `password` | `String!` | `Undefined` |

### `logout`

Returns [`Done!`](#done).

### `markNotificationsRead`

Returns [`UnreadCountResult!`](#unreadcountresult). Mark notifications read: the given ids, or all of them when `ids` is left out.

| Argument | Type | Default |
|---|---|---|
| `ids` | `[ID!]` |  |

### `publishConference`

Returns [`ConferenceResult!`](#conferenceresult). Make a draft public. Fails with NOT_PUBLISHABLE and the reasons when incomplete.

| Argument | Type | Default |
|---|---|---|
| `id` | `ID!` | `Undefined` |

### `rateSession`

Returns [`RatingResult!`](#ratingresult). Rate a session (or the conference, with no sessionId) 1-5 stars with an optional comment. Checked-in attendees only, after it has ended and until feedbackClosesAt; giving it again replaces it.

| Argument | Type | Default |
|---|---|---|
| `ticketCode` | `String!` | `Undefined` |
| `score` | `Int!` | `Undefined` |
| `sessionId` | `ID` |  |
| `comment` | `String` |  |

### `refresh`

Returns [`AuthResult!`](#authresult). Swap the refresh cookie for new tokens. A reused refresh token ends the session.

### `register`

Returns [`CodeSentResult!`](#codesentresult). Organizer sign-up. Emails a 6-digit code; the account works once it is entered.

| Argument | Type | Default |
|---|---|---|
| `input` | [`RegisterInput!`](#registerinput) | `Undefined` |

### `registerForConference`

Returns [`RegisterResult!`](#registerresult). Register for a conference (no account needed). Emails a 6-digit code.

| Argument | Type | Default |
|---|---|---|
| `slug` | `String!` | `Undefined` |
| `input` | [`AttendeeInput!`](#attendeeinput) | `Undefined` |

### `removeAttendee`

Returns [`AttendeeResult!`](#attendeeresult). Cancel someone's registration as the organizer; they are told by email.

| Argument | Type | Default |
|---|---|---|
| `conferenceId` | `ID!` | `Undefined` |
| `attendeeId` | `ID!` | `Undefined` |

### `removeSession`

Returns [`DoneResult!`](#doneresult).

| Argument | Type | Default |
|---|---|---|
| `conferenceId` | `ID!` | `Undefined` |
| `sessionId` | `ID!` | `Undefined` |

### `removeSpeaker`

Returns [`DoneResult!`](#doneresult). Remove a speaker; they are also taken off every session.

| Argument | Type | Default |
|---|---|---|
| `conferenceId` | `ID!` | `Undefined` |
| `speakerId` | `ID!` | `Undefined` |

### `removeTrack`

Returns [`DoneResult!`](#doneresult). Remove a track; its sessions keep their place without a track.

| Argument | Type | Default |
|---|---|---|
| `conferenceId` | `ID!` | `Undefined` |
| `trackId` | `ID!` | `Undefined` |

### `replyToContact`

Returns [`ContactResult!`](#contactresult). Email a reply to whoever used the contact form, and mark the message resolved.

| Argument | Type | Default |
|---|---|---|
| `id` | `ID!` | `Undefined` |
| `message` | `String!` | `Undefined` |

### `replyToFeedback`

Returns [`FeedbackResult!`](#feedbackresult). Answer an organizer's feedback; they get a notification and an email.

| Argument | Type | Default |
|---|---|---|
| `id` | `ID!` | `Undefined` |
| `reply` | `String!` | `Undefined` |

### `resendCode`

Returns [`CodeSentResult!`](#codesentresult). Send a new code. The answer is the same whether or not the email exists.

| Argument | Type | Default |
|---|---|---|
| `email` | `String!` | `Undefined` |

### `resendConfirmation`

Returns [`ConfirmationResult!`](#confirmationresult). Email a new confirmation code (once a minute).

| Argument | Type | Default |
|---|---|---|
| `ticketCode` | `String!` | `Undefined` |

### `resetPassword`

Returns [`DoneResult!`](#doneresult). Set a new password from an emailed link. Signs out every device.

| Argument | Type | Default |
|---|---|---|
| `token` | `String!` | `Undefined` |
| `newPassword` | `String!` | `Undefined` |

### `restoreOrganizer`

Returns [`AdminOrganizerResult!`](#adminorganizerresult). Let the organizer sign in again and show the conferences their suspension hid.

| Argument | Type | Default |
|---|---|---|
| `id` | `ID!` | `Undefined` |

### `sendContactMessage`

Returns [`DoneResult!`](#doneresult). The public contact form (5 messages per 10 minutes per address).

| Argument | Type | Default |
|---|---|---|
| `input` | [`ContactInput!`](#contactinput) | `Undefined` |

### `sendFeedback`

Returns [`FeedbackResult!`](#feedbackresult). An organizer writes to the admin team (10 an hour).

| Argument | Type | Default |
|---|---|---|
| `subject` | `String!` | `Undefined` |
| `message` | `String!` | `Undefined` |

### `sendRemindersNow`

Returns [`RemindersResult!`](#remindersresult). Email the day-before reminder now to confirmed attendees who have not had it.

| Argument | Type | Default |
|---|---|---|
| `conferenceId` | `ID!` | `Undefined` |

### `setBookmark`

Returns [`TicketResult!`](#ticketresult). Save or unsave a session on the ticket holder's own agenda.

| Argument | Type | Default |
|---|---|---|
| `ticketCode` | `String!` | `Undefined` |
| `sessionId` | `ID!` | `Undefined` |
| `bookmarked` | `Boolean!` | `Undefined` |

### `setConferenceHidden`

Returns [`AdminConferenceResult!`](#adminconferenceresult). Hide a conference from the public (the organizer is told), or show it again.

| Argument | Type | Default |
|---|---|---|
| `id` | `ID!` | `Undefined` |
| `hidden` | `Boolean!` | `Undefined` |

### `setContactResolved`

Returns [`ContactResult!`](#contactresult).

| Argument | Type | Default |
|---|---|---|
| `id` | `ID!` | `Undefined` |
| `resolved` | `Boolean!` | `Undefined` |

### `setDayLabel`

Returns [`ConferenceResult!`](#conferenceresult). Name a day, e.g. 'Workshop day'. Send no label to clear it.

| Argument | Type | Default |
|---|---|---|
| `conferenceId` | `ID!` | `Undefined` |
| `day` | [`Date!`](#date) | `Undefined` |
| `label` | [`LocalizedTextInput`](#localizedtextinput) |  |

### `setQuestionStatus`

Returns [`ModeratedQuestionResult!`](#moderatedquestionresult). Mark a question answered, hide it, or open it again (the organizer).

| Argument | Type | Default |
|---|---|---|
| `questionId` | `ID!` | `Undefined` |
| `status` | [`QuestionStatus!`](#questionstatus) | `Undefined` |

### `signOutOtherDevices`

Returns [`DoneResult!`](#doneresult). Sign out every other device; this one stays signed in.

### `suspendOrganizer`

Returns [`AdminOrganizerResult!`](#adminorganizerresult). Sign the organizer out everywhere and hide their conferences until restored.

| Argument | Type | Default |
|---|---|---|
| `id` | `ID!` | `Undefined` |

### `undoCheckIn`

Returns [`AttendeeResult!`](#attendeeresult).

| Argument | Type | Default |
|---|---|---|
| `conferenceId` | `ID!` | `Undefined` |
| `attendeeId` | `ID!` | `Undefined` |

### `unpublishConference`

Returns [`ConferenceResult!`](#conferenceresult). Back to draft; only while nobody has registered.

| Argument | Type | Default |
|---|---|---|
| `id` | `ID!` | `Undefined` |

### `updateConference`

Returns [`ConferenceResult!`](#conferenceresult).

| Argument | Type | Default |
|---|---|---|
| `id` | `ID!` | `Undefined` |
| `input` | [`ConferenceInput!`](#conferenceinput) | `Undefined` |

### `updateProfile`

Returns [`ProfileResult!`](#profileresult). Update the signed-in organizer's profile.

| Argument | Type | Default |
|---|---|---|
| `input` | [`ProfileInput!`](#profileinput) | `Undefined` |

### `upsertSession`

Returns [`SessionResult!`](#sessionresult). Add a session (no sessionId) or change one. Refuses room clashes.

| Argument | Type | Default |
|---|---|---|
| `conferenceId` | `ID!` | `Undefined` |
| `input` | [`SessionInput!`](#sessioninput) | `Undefined` |
| `sessionId` | `ID` |  |

### `upsertSpeaker`

Returns [`SpeakerResult!`](#speakerresult). Add a speaker (no speakerId) or change one.

| Argument | Type | Default |
|---|---|---|
| `conferenceId` | `ID!` | `Undefined` |
| `input` | [`SpeakerInput!`](#speakerinput) | `Undefined` |
| `speakerId` | `ID` |  |

### `upsertTrack`

Returns [`TrackResult!`](#trackresult). Add a track (no trackId) or change one.

| Argument | Type | Default |
|---|---|---|
| `conferenceId` | `ID!` | `Undefined` |
| `input` | [`TrackInput!`](#trackinput) | `Undefined` |
| `trackId` | `ID` |  |

### `verifyEmail`

Returns [`AuthResult!`](#authresult). Enter the emailed code: verifies the address and signs the organizer in.

| Argument | Type | Default |
|---|---|---|
| `email` | `String!` | `Undefined` |
| `code` | `String!` | `Undefined` |

### `voteQuestion`

Returns [`LiveQuestionResult!`](#livequestionresult). Upvote someone else's question, or take the vote back.

| Argument | Type | Default |
|---|---|---|
| `ticketCode` | `String!` | `Undefined` |
| `questionId` | `ID!` | `Undefined` |
| `voted` | `Boolean!` | `Undefined` |

## Object types

### ActivityEntry

| Field | Type | Description |
|---|---|---|
| `id` | `ID!` |  |
| `actorType` | `String!` |  |
| `actorName` | `String` |  |
| `action` | `String!` |  |
| `target` | `String` |  |
| `meta` | [`JSON!`](#json) |  |
| `createdAt` | [`DateTime!`](#datetime) |  |

### ActivityPage

| Field | Type | Description |
|---|---|---|
| `items` | [`[ActivityEntry!]!`](#activityentry) |  |
| `total` | `Int!` |  |
| `actions` | `[String!]!` |  |

### Admin

| Field | Type | Description |
|---|---|---|
| `id` | `ID!` |  |
| `username` | `String!` |  |
| `email` | `String!` |  |

### AdminConference

| Field | Type | Description |
|---|---|---|
| `id` | `ID!` |  |
| `slug` | `String!` |  |
| `title` | `String!` |  |
| `status` | `String!` |  |
| `hidden` | `Boolean!` |  |
| `hiddenReason` | `String` |  |
| `startsAt` | [`DateTime!`](#datetime) |  |
| `city` | `String` |  |
| `registered` | `Int!` |  |
| `capacity` | `Int` |  |
| `organizerName` | `String` |  |
| `organizerEmail` | `String` |  |

### AdminConferencePage

| Field | Type | Description |
|---|---|---|
| `items` | [`[AdminConference!]!`](#adminconference) |  |
| `total` | `Int!` |  |

### AdminOrganizer

| Field | Type | Description |
|---|---|---|
| `organizer` | [`Organizer!`](#organizer) |  |
| `suspended` | `Boolean!` |  |
| `conferences` | `Int!` |  |

### AdminOrganizerPage

| Field | Type | Description |
|---|---|---|
| `items` | [`[AdminOrganizer!]!`](#adminorganizer) |  |
| `total` | `Int!` |  |

### AdminOverview

| Field | Type | Description |
|---|---|---|
| `organizersActive` | `Int!` |  |
| `organizersSuspended` | `Int!` |  |
| `organizersUnverified` | `Int!` |  |
| `conferencesUpcoming` | `Int!` |  |
| `conferencesDrafts` | `Int!` |  |
| `conferencesCancelled` | `Int!` |  |
| `conferencesHidden` | `Int!` |  |
| `registrationsActive` | `Int!` |  |
| `registrationsWeek` | `Int!` |  |
| `contactsOpen` | `Int!` |  |
| `feedbackOpen` | `Int!` |  |

### AgendaSession

| Field | Type | Description |
|---|---|---|
| `id` | `ID!` |  |
| `day` | [`Date!`](#date) |  |
| `title` | [`LocalizedText!`](#localizedtext) |  |
| `description` | [`LocalizedText`](#localizedtext) |  |
| `kind` | [`SessionKind!`](#sessionkind) |  |
| `startsAt` | [`DateTime!`](#datetime) |  |
| `endsAt` | [`DateTime!`](#datetime) |  |
| `room` | `String` |  |
| `capacity` | `Int` |  |
| `track` | [`Track`](#track) |  |
| `speakers` | [`[Speaker!]!`](#speaker) |  |

### AlreadyCheckedIn

This ticket was already used: show when, so the desk can spot a copied ticket.

| Field | Type | Description |
|---|---|---|
| `attendee` | [`Attendee!`](#attendee) |  |
| `checkedInAt` | [`DateTime!`](#datetime) |  |

### AlreadyRegistered

This email already has a registration; the ticket link was emailed to it again.

| Field | Type | Description |
|---|---|---|
| `email` | `String!` |  |

### AnalyticsOverview

| Field | Type | Description |
|---|---|---|
| `byDay` | [`[DayCount!]!`](#daycount) |  |
| `conferences` | [`[ConferenceFill!]!`](#conferencefill) |  |

### Attendee

An attendee as the conference's organizer sees them.

| Field | Type | Description |
|---|---|---|
| `id` | `ID!` |  |
| `name` | `String!` |  |
| `email` | `String!` |  |
| `lang` | [`Lang!`](#lang) |  |
| `status` | [`RegistrationStatus!`](#registrationstatus) |  |
| `ticketCode` | `String!` |  |
| `confirmedAt` | [`DateTime`](#datetime) |  |
| `promotedAt` | [`DateTime`](#datetime) |  |
| `checkedInAt` | [`DateTime`](#datetime) |  |
| `cancelledAt` | [`DateTime`](#datetime) |  |
| `cancelledBy` | `String` |  |
| `createdAt` | [`DateTime!`](#datetime) |  |

### AttendeeConnection

| Field | Type | Description |
|---|---|---|
| `edges` | [`[AttendeeEdge!]!`](#attendeeedge) |  |
| `pageInfo` | [`PageInfo!`](#pageinfo) |  |
| `totalCount` | `Int!` |  |

### AttendeeEdge

| Field | Type | Description |
|---|---|---|
| `cursor` | `String!` |  |
| `node` | [`Attendee!`](#attendee) |  |

### CategoryCount

| Field | Type | Description |
|---|---|---|
| `category` | [`Category!`](#category) |  |
| `count` | `Int!` |  |

### CheckedIn

| Field | Type | Description |
|---|---|---|
| `attendee` | [`Attendee!`](#attendee) |  |

### CityCount

| Field | Type | Description |
|---|---|---|
| `city` | `String!` |  |
| `count` | `Int!` |  |

### CodeSent

| Field | Type | Description |
|---|---|---|
| `email` | `String!` |  |
| `resendAfterSeconds` | `Int!` |  |

### Conference

| Field | Type | Description |
|---|---|---|
| `id` | `ID!` |  |
| `slug` | `String!` |  |
| `status` | [`ConferenceStatus!`](#conferencestatus) |  |
| `title` | [`LocalizedText!`](#localizedtext) |  |
| `summary` | [`LocalizedText`](#localizedtext) |  |
| `description` | [`LocalizedText`](#localizedtext) |  |
| `sourceLang` | [`Lang!`](#lang) |  |
| `category` | [`Category!`](#category) |  |
| `tags` | `[String!]!` |  |
| `coverUrl` | `String` |  |
| `venue` | [`Venue!`](#venue) |  |
| `onlineUrl` | `String` |  |
| `timezone` | `String!` |  |
| `startsAt` | [`DateTime!`](#datetime) |  |
| `endsAt` | [`DateTime!`](#datetime) |  |
| `days` | [`[ConferenceDay!]!`](#conferenceday) |  |
| `tracks` | [`[Track!]!`](#track) |  |
| `speakers` | [`[Speaker!]!`](#speaker) |  |
| `sessions` | [`[AgendaSession!]!`](#agendasession) |  |
| `capacity` | `Int` |  |
| `waitlistEnabled` | `Boolean!` |  |
| `counters` | [`Counters!`](#counters) |  |
| `publishedAt` | [`DateTime`](#datetime) |  |
| `cancelledAt` | [`DateTime`](#datetime) |  |
| `distanceKm` | `Float` |  |
| `seatsLeft` | `Int` | Seats not yet taken; null when there is no limit. |
| `ended` | `Boolean!` | True once the conference's end time has passed (registration is then closed). |
| `city` | `String` | Shortcut for venue.city. |
| `publishProblems` | `[String!]!` | What blocks publishing, as codes: STARTS_IN_PAST, NEEDS_PLACE, NEEDS_CAPACITY (empty: ready). |
| `organizer` | [`OrganizerSummary`](#organizersummary) |  |

### ConferenceAnalytics

| Field | Type | Description |
|---|---|---|
| `byDay` | [`[DayCount!]!`](#daycount) |  |
| `arrivals` | [`[SlotCount!]!`](#slotcount) |  |
| `byStatus` | [`[KeyCount!]!`](#keycount) |  |
| `byLanguage` | [`[KeyCount!]!`](#keycount) |  |
| `registered` | `Int!` |  |
| `confirmed` | `Int!` |  |
| `waitlisted` | `Int!` |  |
| `checkedIn` | `Int!` |  |
| `capacity` | `Int` |  |
| `everConfirmed` | `Int!` | Registrations that entered their email code, ever. |
| `totalSignups` | `Int!` | Every registration, including cancelled and released ones. |

### ConferenceConnection

| Field | Type | Description |
|---|---|---|
| `edges` | [`[ConferenceEdge!]!`](#conferenceedge) |  |
| `pageInfo` | [`PageInfo!`](#pageinfo) |  |

### ConferenceDay

| Field | Type | Description |
|---|---|---|
| `date` | [`Date!`](#date) |  |
| `label` | [`LocalizedText`](#localizedtext) |  |

### ConferenceEdge

| Field | Type | Description |
|---|---|---|
| `cursor` | `String!` |  |
| `node` | [`Conference!`](#conference) |  |

### ConferenceFeedback

| Field | Type | Description |
|---|---|---|
| `respondents` | `Int!` | Tickets that gave at least one rating. |
| `attended` | `Int!` | People checked in (who could give feedback). |
| `scores` | [`[ScoreSummary!]!`](#scoresummary) |  |
| `comments` | [`[FeedbackComment!]!`](#feedbackcomment) |  |
| `closesAt` | [`DateTime!`](#datetime) |  |

### ConferenceFill

| Field | Type | Description |
|---|---|---|
| `id` | `ID!` |  |
| `title` | `String!` |  |
| `startsAt` | [`DateTime!`](#datetime) |  |
| `capacity` | `Int` |  |
| `registered` | `Int!` |  |
| `checkedIn` | `Int!` |  |

### ConferenceFull

| Field | Type | Description |
|---|---|---|
| `capacity` | `Int!` |  |

### ConferenceList

| Field | Type | Description |
|---|---|---|
| `items` | [`[Conference!]!`](#conference) |  |

### ConfirmationSent

| Field | Type | Description |
|---|---|---|
| `resendAfterSeconds` | `Int!` |  |

### ContactMessage

| Field | Type | Description |
|---|---|---|
| `id` | `ID!` |  |
| `name` | `String!` |  |
| `email` | `String!` |  |
| `topic` | `String!` |  |
| `message` | `String!` |  |
| `status` | [`ContactStatus!`](#contactstatus) |  |
| `createdAt` | [`DateTime!`](#datetime) |  |
| `resolvedAt` | [`DateTime`](#datetime) |  |

### ContactPage

| Field | Type | Description |
|---|---|---|
| `items` | [`[ContactMessage!]!`](#contactmessage) |  |
| `total` | `Int!` |  |

### Counters

| Field | Type | Description |
|---|---|---|
| `registered` | `Int!` |  |
| `confirmed` | `Int!` |  |
| `waitlisted` | `Int!` |  |
| `checkedIn` | `Int!` |  |

### DayCount

Sign-ups on one day (in the conference's time zone): how many, and how many later left.

| Field | Type | Description |
|---|---|---|
| `day` | `String!` |  |
| `registered` | `Int!` |  |
| `left` | `Int!` |  |
| `waitlisted` | `Int!` |  |

### Done

| Field | Type | Description |
|---|---|---|
| `ok` | `Boolean!` |  |

### FeedbackComment

A rating that came with a comment. Anonymous: the organizer never sees who wrote it.

| Field | Type | Description |
|---|---|---|
| `sessionId` | `ID` |  |
| `sessionTitle` | [`LocalizedText`](#localizedtext) |  |
| `score` | `Int!` |  |
| `comment` | `String!` |  |
| `updatedAt` | [`DateTime!`](#datetime) |  |

### FeedbackItem

| Field | Type | Description |
|---|---|---|
| `id` | `ID!` |  |
| `subject` | `String!` |  |
| `message` | `String!` |  |
| `status` | [`FeedbackStatus!`](#feedbackstatus) |  |
| `reply` | `String` |  |
| `repliedAt` | [`DateTime`](#datetime) |  |
| `createdAt` | [`DateTime!`](#datetime) |  |
| `organizerName` | `String` |  |
| `organizerEmail` | `String` |  |

### FeedbackList

| Field | Type | Description |
|---|---|---|
| `items` | [`[FeedbackItem!]!`](#feedbackitem) |  |

### FeedbackPage

| Field | Type | Description |
|---|---|---|
| `items` | [`[FeedbackItem!]!`](#feedbackitem) |  |
| `total` | `Int!` |  |

### GeoLocation

| Field | Type | Description |
|---|---|---|
| `latitude` | `Float!` |  |
| `longitude` | `Float!` |  |

### JobRun

| Field | Type | Description |
|---|---|---|
| `name` | `String!` |  |
| `at` | [`DateTime!`](#datetime) |  |
| `ok` | `Boolean!` |  |
| `result` | `String!` |  |

### KeyCount

| Field | Type | Description |
|---|---|---|
| `key` | `String!` |  |
| `count` | `Int!` |  |

### LiveQuestion

A question as ticket holders see it: first name only, and whether it is theirs.

| Field | Type | Description |
|---|---|---|
| `id` | `ID!` |  |
| `sessionId` | `ID!` |  |
| `text` | `String!` |  |
| `authorName` | `String!` |  |
| `votes` | `Int!` |  |
| `status` | [`QuestionStatus!`](#questionstatus) |  |
| `createdAt` | [`DateTime!`](#datetime) |  |
| `answeredAt` | [`DateTime`](#datetime) |  |
| `votedByMe` | `Boolean!` |  |
| `mine` | `Boolean!` |  |

### LocalizedText

| Field | Type | Description |
|---|---|---|
| `en` | `String!` |  |
| `si` | `String` |  |
| `ta` | `String` |  |

### ModeratedQuestion

A question as the organizer sees it, hidden ones included.

| Field | Type | Description |
|---|---|---|
| `id` | `ID!` |  |
| `sessionId` | `ID!` |  |
| `text` | `String!` |  |
| `authorName` | `String!` |  |
| `votes` | `Int!` |  |
| `status` | [`QuestionStatus!`](#questionstatus) |  |
| `createdAt` | [`DateTime!`](#datetime) |  |
| `answeredAt` | [`DateTime`](#datetime) |  |

### MyRating

One of the ticket holder's ratings: a session, or the conference when sessionId is null.

| Field | Type | Description |
|---|---|---|
| `sessionId` | `ID` |  |
| `score` | `Int!` |  |
| `comment` | `String` |  |
| `updatedAt` | [`DateTime!`](#datetime) |  |

### Notification

Translated in the web app from `kind` and `params`, so it reads in the viewer's language.

| Field | Type | Description |
|---|---|---|
| `id` | `ID!` |  |
| `kind` | `String!` |  |
| `params` | [`JSON!`](#json) |  |
| `link` | `String` |  |
| `read` | `Boolean!` |  |
| `createdAt` | [`DateTime!`](#datetime) |  |

### NotificationPage

| Field | Type | Description |
|---|---|---|
| `items` | [`[Notification!]!`](#notification) |  |
| `hasNextPage` | `Boolean!` |  |
| `endCursor` | `String` |  |
| `unread` | `Int!` |  |

### Organizer

| Field | Type | Description |
|---|---|---|
| `id` | `ID!` |  |
| `firstName` | `String!` |  |
| `lastName` | `String!` |  |
| `email` | `String!` |  |
| `phone` | `String` |  |
| `organization` | `String` |  |
| `bio` | [`ProfileBio`](#profilebio) |  |
| `avatarUrl` | `String` |  |
| `lang` | `String!` |  |
| `emailVerified` | `Boolean!` |  |
| `createdAt` | [`DateTime!`](#datetime) |  |

### OrganizerSummary

The public face of an organizer: no email or phone.

| Field | Type | Description |
|---|---|---|
| `name` | `String!` |  |
| `organization` | `String` |  |

### PageInfo

| Field | Type | Description |
|---|---|---|
| `hasNextPage` | `Boolean!` |  |
| `endCursor` | `String` |  |

### PlatformStats

| Field | Type | Description |
|---|---|---|
| `upcomingConferences` | `Int!` |  |
| `heldConferences` | `Int!` |  |
| `registeredAttendees` | `Int!` |  |
| `checkedIn` | `Int!` |  |
| `speakers` | `Int!` |  |
| `sessions` | `Int!` |  |
| `organizers` | `Int!` |  |
| `registrationsThisWeek` | `Int!` |  |

### ProfileBio

Text in the three app languages (English always present).

| Field | Type | Description |
|---|---|---|
| `en` | `String!` |  |
| `si` | `String` |  |
| `ta` | `String` |  |

### QaBoard

One session's live Q&A for a ticket holder.

| Field | Type | Description |
|---|---|---|
| `open` | `Boolean!` | False once Q&A has closed (then the board is read-only). |
| `conferenceId` | `ID!` |  |
| `conferenceTitle` | [`LocalizedText!`](#localizedtext) |  |
| `slug` | `String!` |  |
| `timezone` | `String!` |  |
| `sessionId` | `ID` |  |
| `sessions` | [`[QaSession!]!`](#qasession) |  |
| `questions` | [`[LiveQuestion!]!`](#livequestion) |  |

### QaSession

| Field | Type | Description |
|---|---|---|
| `id` | `ID!` |  |
| `title` | [`LocalizedText!`](#localizedtext) |  |
| `startsAt` | [`DateTime!`](#datetime) |  |
| `endsAt` | [`DateTime!`](#datetime) |  |
| `room` | `String` |  |
| `questions` | `Int!` | Visible questions in this session. |

### Registered

A seat is held; enter the emailed code before it is released.

| Field | Type | Description |
|---|---|---|
| `ticketCode` | `String!` |  |
| `holdExpiresAt` | [`DateTime`](#datetime) |  |

### RemindersSent

| Field | Type | Description |
|---|---|---|
| `count` | `Int!` |  |

### Removed

| Field | Type | Description |
|---|---|---|
| `registrations` | `Int!` |  |
| `conferences` | `Int!` |  |

### ScoreSummary

Average stars (1-5) and number of ratings: a session, or the conference when null.

| Field | Type | Description |
|---|---|---|
| `sessionId` | `ID` |  |
| `sessionTitle` | [`LocalizedText`](#localizedtext) | Null for the conference as a whole. |
| `average` | `Float!` |  |
| `count` | `Int!` |  |

### SessionQuestions

| Field | Type | Description |
|---|---|---|
| `sessions` | [`[QaSession!]!`](#qasession) |  |
| `questions` | [`[ModeratedQuestion!]!`](#moderatedquestion) |  |

### SignedIn

| Field | Type | Description |
|---|---|---|
| `viewer` | [`Viewer!`](#viewer) |  |
| `accessExpiresAt` | [`DateTime!`](#datetime) |  |

### SlotCount

Net arrivals (check-ins minus undone ones) in a 15-minute slot starting at `at`.

| Field | Type | Description |
|---|---|---|
| `at` | [`DateTime!`](#datetime) |  |
| `count` | `Int!` |  |

### Speaker

| Field | Type | Description |
|---|---|---|
| `id` | `ID!` |  |
| `name` | `String!` |  |
| `jobTitle` | `String` |  |
| `organization` | `String` |  |
| `bio` | [`LocalizedText`](#localizedtext) |  |
| `photoUrl` | `String` |  |
| `links` | `[String!]!` |  |

### SystemStatus

| Field | Type | Description |
|---|---|---|
| `mongo` | `Boolean!` |  |
| `redis` | `Boolean!` |  |
| `workerRunning` | `Boolean!` |  |
| `workerSeenAt` | [`DateTime`](#datetime) |  |
| `queueLength` | `Int!` |  |
| `failedEmailsToday` | `Int!` |  |
| `requestsLastHour` | `Int!` |  |
| `errorsLastHour` | `Int!` |  |
| `jobs` | [`[JobRun!]!`](#jobrun) |  |

### Ticket

What the ticket holder sees, by the code from their email.

| Field | Type | Description |
|---|---|---|
| `code` | `String!` |  |
| `name` | `String!` |  |
| `email` | `String!` |  |
| `lang` | [`Lang!`](#lang) |  |
| `status` | [`RegistrationStatus!`](#registrationstatus) |  |
| `confirmed` | `Boolean!` |  |
| `holdExpiresAt` | [`DateTime`](#datetime) |  |
| `waitlistPosition` | `Int` |  |
| `checkedInAt` | [`DateTime`](#datetime) |  |
| `createdAt` | [`DateTime!`](#datetime) |  |
| `conference` | [`Conference!`](#conference) |  |
| `bookmarkedSessionIds` | `[ID!]!` |  |
| `ratings` | [`[MyRating!]!`](#myrating) |  |
| `feedbackClosesAt` | [`DateTime!`](#datetime) | Ratings can be given (by checked-in attendees) until this time. |

### Track

| Field | Type | Description |
|---|---|---|
| `id` | `ID!` |  |
| `name` | [`LocalizedText!`](#localizedtext) |  |
| `color` | `String!` |  |

### UnreadCount

| Field | Type | Description |
|---|---|---|
| `unread` | `Int!` |  |

### UserError

Something the user can fix or retry, returned instead of a result.

| Field | Type | Description |
|---|---|---|
| `code` | [`ErrorCode!`](#errorcode) |  |
| `message` | `String!` |  |
| `field` | `String` |  |
| `retryAfterSeconds` | `Int` |  |
| `remainingAttempts` | `Int` |  |

### Venue

| Field | Type | Description |
|---|---|---|
| `name` | `String` |  |
| `address` | `String` |  |
| `city` | `String` |  |
| `location` | [`GeoLocation`](#geolocation) |  |

### Waitlisted

The conference is full; this person is on the waitlist.

| Field | Type | Description |
|---|---|---|
| `ticketCode` | `String!` |  |
| `position` | `Int!` |  |

## Unions

### ActivityPageResult

One of: [ActivityPage](#activitypage), [UserError](#usererror).

### AdminConferencePageResult

One of: [AdminConferencePage](#adminconferencepage), [UserError](#usererror).

### AdminConferenceResult

One of: [AdminConference](#adminconference), [UserError](#usererror).

### AdminOrganizerPageResult

One of: [AdminOrganizerPage](#adminorganizerpage), [UserError](#usererror).

### AdminOrganizerResult

One of: [AdminOrganizer](#adminorganizer), [UserError](#usererror).

### AdminOverviewResult

One of: [AdminOverview](#adminoverview), [UserError](#usererror).

### AnalyticsOverviewResult

One of: [AnalyticsOverview](#analyticsoverview), [UserError](#usererror).

### AttendeeResult

One of: [Attendee](#attendee), [UserError](#usererror).

### AttendeesResult

One of: [AttendeeConnection](#attendeeconnection), [UserError](#usererror).

### AuthResult

One of: [SignedIn](#signedin), [UserError](#usererror).

### CheckInResult

One of: [CheckedIn](#checkedin), [AlreadyCheckedIn](#alreadycheckedin), [UserError](#usererror).

### CodeSentResult

One of: [CodeSent](#codesent), [UserError](#usererror).

### ConferenceAnalyticsResult

One of: [ConferenceAnalytics](#conferenceanalytics), [UserError](#usererror).

### ConferenceFeedbackResult

One of: [ConferenceFeedback](#conferencefeedback), [UserError](#usererror).

### ConferenceListResult

One of: [ConferenceList](#conferencelist), [UserError](#usererror).

### ConferenceResult

One of: [Conference](#conference), [UserError](#usererror).

### ConfirmationResult

One of: [ConfirmationSent](#confirmationsent), [UserError](#usererror).

### ContactPageResult

One of: [ContactPage](#contactpage), [UserError](#usererror).

### ContactResult

One of: [ContactMessage](#contactmessage), [UserError](#usererror).

### DoneResult

One of: [Done](#done), [UserError](#usererror).

### FeedbackListResult

One of: [FeedbackList](#feedbacklist), [UserError](#usererror).

### FeedbackPageResult

One of: [FeedbackPage](#feedbackpage), [UserError](#usererror).

### FeedbackResult

One of: [FeedbackItem](#feedbackitem), [UserError](#usererror).

### LiveQuestionResult

One of: [LiveQuestion](#livequestion), [UserError](#usererror).

### ModeratedQuestionResult

One of: [ModeratedQuestion](#moderatedquestion), [UserError](#usererror).

### NotificationPageResult

One of: [NotificationPage](#notificationpage), [UserError](#usererror).

### ProfileResult

One of: [Organizer](#organizer), [UserError](#usererror).

### QaBoardResult

One of: [QaBoard](#qaboard), [UserError](#usererror).

### RatingResult

One of: [MyRating](#myrating), [UserError](#usererror).

### RegisterResult

One of: [Registered](#registered), [Waitlisted](#waitlisted), [AlreadyRegistered](#alreadyregistered), [ConferenceFull](#conferencefull), [UserError](#usererror).

### RemindersResult

One of: [RemindersSent](#reminderssent), [UserError](#usererror).

### RemovedResult

One of: [Removed](#removed), [UserError](#usererror).

### SessionQuestionsResult

One of: [SessionQuestions](#sessionquestions), [UserError](#usererror).

### SessionResult

One of: [AgendaSession](#agendasession), [UserError](#usererror).

### SpeakerResult

One of: [Speaker](#speaker), [UserError](#usererror).

### SystemStatusResult

One of: [SystemStatus](#systemstatus), [UserError](#usererror).

### TicketResult

One of: [Ticket](#ticket), [UserError](#usererror).

### TrackResult

One of: [Track](#track), [UserError](#usererror).

### UnreadCountResult

One of: [UnreadCount](#unreadcount), [UserError](#usererror).

### Viewer

Whoever is signed in.

One of: [Organizer](#organizer), [Admin](#admin).

## Input types

### AttendeeFilter

| Field | Type | Description |
|---|---|---|
| `statuses` | [`[RegistrationStatus!]`](#registrationstatus) |  |
| `q` | `String` |  |
| `checkedIn` | `Boolean` |  |

### AttendeeInput

| Field | Type | Description |
|---|---|---|
| `name` | `String!` |  |
| `email` | `String!` |  |
| `lang` | [`Lang!`](#lang) |  |

### BioInput

| Field | Type | Description |
|---|---|---|
| `en` | `String` |  |
| `si` | `String` |  |
| `ta` | `String` |  |

### ConferenceFilter

| Field | Type | Description |
|---|---|---|
| `q` | `String` |  |
| `category` | [`Category`](#category) |  |
| `city` | `String` |  |
| `near` | [`NearInput`](#nearinput) |  |
| `startsFrom` | [`DateTime`](#datetime) |  |
| `startsTo` | [`DateTime`](#datetime) |  |
| `timeframe` | [`Timeframe!`](#timeframe) |  |

### ConferenceInput

| Field | Type | Description |
|---|---|---|
| `title` | [`LocalizedTextInput!`](#localizedtextinput) |  |
| `startsAt` | [`DateTime!`](#datetime) |  |
| `endsAt` | [`DateTime!`](#datetime) |  |
| `summary` | [`LocalizedTextInput`](#localizedtextinput) |  |
| `description` | [`LocalizedTextInput`](#localizedtextinput) |  |
| `sourceLang` | [`Lang!`](#lang) |  |
| `category` | [`Category!`](#category) |  |
| `tags` | `[String!]!` |  |
| `venueName` | `String` |  |
| `venueAddress` | `String` |  |
| `city` | `String` |  |
| `latitude` | `Float` |  |
| `longitude` | `Float` |  |
| `onlineUrl` | `String` |  |
| `timezone` | `String!` |  |
| `capacity` | `Int` |  |
| `waitlistEnabled` | `Boolean!` |  |
| `coverUrl` | `String` |  |

### ContactInput

| Field | Type | Description |
|---|---|---|
| `name` | `String!` |  |
| `email` | `String!` |  |
| `message` | `String!` |  |
| `topic` | [`ContactTopic!`](#contacttopic) |  |

### LocalizedTextInput

| Field | Type | Description |
|---|---|---|
| `en` | `String` |  |
| `si` | `String` |  |
| `ta` | `String` |  |

### NearInput

| Field | Type | Description |
|---|---|---|
| `latitude` | `Float!` |  |
| `longitude` | `Float!` |  |
| `radiusKm` | `Float!` |  |

### ProfileInput

| Field | Type | Description |
|---|---|---|
| `firstName` | `String!` |  |
| `lastName` | `String!` |  |
| `phone` | `String` |  |
| `organization` | `String` |  |
| `bio` | [`BioInput`](#bioinput) |  |
| `avatarUrl` | `String` |  |
| `lang` | `String!` |  |

### RegisterInput

| Field | Type | Description |
|---|---|---|
| `firstName` | `String!` |  |
| `lastName` | `String!` |  |
| `email` | `String!` |  |
| `password` | `String!` |  |
| `phone` | `String` |  |
| `organization` | `String` |  |
| `lang` | `String!` |  |

### SessionInput

| Field | Type | Description |
|---|---|---|
| `title` | [`LocalizedTextInput!`](#localizedtextinput) |  |
| `startsAt` | [`DateTime!`](#datetime) |  |
| `endsAt` | [`DateTime!`](#datetime) |  |
| `description` | [`LocalizedTextInput`](#localizedtextinput) |  |
| `kind` | [`SessionKind!`](#sessionkind) |  |
| `room` | `String` |  |
| `trackId` | `ID` |  |
| `speakerIds` | `[ID!]!` |  |
| `capacity` | `Int` |  |

### SpeakerInput

| Field | Type | Description |
|---|---|---|
| `name` | `String!` |  |
| `jobTitle` | `String` |  |
| `organization` | `String` |  |
| `bio` | [`LocalizedTextInput`](#localizedtextinput) |  |
| `photoUrl` | `String` |  |
| `links` | `[String!]!` |  |

### TrackInput

| Field | Type | Description |
|---|---|---|
| `name` | [`LocalizedTextInput!`](#localizedtextinput) |  |
| `color` | `String!` |  |

## Enums

### AdminConferenceFilter

Values: `ALL`, `UPCOMING`, `PAST`, `DRAFT`, `CANCELLED`, `HIDDEN`.

### Category

Values: `TECH`, `HEALTH`, `EDUCATION`, `BUSINESS`, `SCIENCE`, `ARTS`, `OTHER`.

### ConferenceStatus

Values: `DRAFT`, `PUBLISHED`, `CANCELLED`, `ARCHIVED`.

### ContactStatus

Values: `OPEN`, `RESOLVED`.

### ContactTopic

Values: `GENERAL`, `ATTENDING`, `ORGANIZING`, `TECHNICAL`, `PARTNERSHIP`.

### ErrorCode

Stable error codes; the web app translates each one.

Values: `VALIDATION`, `NOT_AUTHENTICATED`, `FORBIDDEN`, `CSRF_FAILED`, `RATE_LIMITED`, `EMAIL_TAKEN`, `INVALID_CREDENTIALS`, `ACCOUNT_SUSPENDED`, `EMAIL_NOT_VERIFIED`, `CODE_INVALID`, `CODE_EXPIRED`, `CODE_LOCKED`, `SESSION_EXPIRED`, `SESSION_REUSED`, `RESET_INVALID`, `RESET_EXPIRED`, `PASSWORD_UNCHANGED`, `NOT_FOUND`, `CONFLICT`, `NOT_PUBLISHABLE`, `INVALID_STATE`, `SESSION_CLASH`, `FILE_TYPE`, `FILE_TOO_LARGE`, `FILE_NOT_IMAGE`, `REGISTRATION_CLOSED`, `REGISTRATION_INACTIVE`, `CHECKIN_UNCONFIRMED`, `CHECKIN_WAITLISTED`, `CAPACITY_BELOW_TAKEN`, `FEEDBACK_NOT_ATTENDED`, `FEEDBACK_NOT_YET`, `FEEDBACK_CLOSED`, `QA_TICKET_REQUIRED`, `QA_CLOSED`.

### FeedbackStatus

Values: `OPEN`, `REPLIED`, `CLOSED`.

### Lang

Values: `EN`, `SI`, `TA`.

### OrganizerFilter

Values: `ALL`, `ACTIVE`, `SUSPENDED`, `UNVERIFIED`.

### QuestionStatus

Values: `OPEN`, `ANSWERED`, `HIDDEN`.

### RegistrationStatus

Values: `HELD`, `REGISTERED`, `WAITLISTED`, `CANCELLED`, `RELEASED`.

### SessionKind

Values: `KEYNOTE`, `TALK`, `WORKSHOP`, `PANEL`, `BREAK`.

### Timeframe

Which conferences to list when no date range is given.

Values: `UPCOMING`, `PAST`, `ALL`.

## Scalars

### Date

Date (isoformat)

A custom scalar.

### DateTime

Date with time (isoformat)

A custom scalar.

### JSON

The `JSON` scalar type represents JSON values as specified by [ECMA-404](https://ecma-international.org/wp-content/uploads/ECMA-404_2nd_edition_december_2017.pdf).

A custom scalar.
