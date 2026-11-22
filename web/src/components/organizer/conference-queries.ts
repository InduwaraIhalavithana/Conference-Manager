// GraphQL for the organizer's conference list, editor and attendees page.
import { graphql } from "@/graphql/generated";

export const EditorConferenceFields = graphql(`
  fragment EditorConferenceFields on Conference {
    id
    slug
    status
    title { en si ta }
    summary { en si ta }
    description { en si ta }
    category
    tags
    coverUrl
    venue { name address city location { latitude longitude } }
    onlineUrl
    timezone
    startsAt
    endsAt
    ended
    capacity
    waitlistEnabled
    counters { registered confirmed waitlisted checkedIn }
    publishProblems
    days { date label { en si ta } }
    tracks { id name { en si ta } color }
    speakers { id name jobTitle organization photoUrl bio { en si ta } links }
    sessions {
      id
      day
      kind
      title { en si ta }
      description { en si ta }
      startsAt
      endsAt
      room
      capacity
      track { id }
      speakers { id }
    }
  }
`);

export const MyConferencesQuery = graphql(`
  query MyConferences {
    myConferences {
      __typename
      ... on ConferenceList {
        items {
          id
          slug
          status
          title { en si ta }
          category
          coverUrl
          timezone
          startsAt
          endsAt
          ended
          capacity
          venue { city }
          counters { registered confirmed waitlisted checkedIn }
        }
      }
      ... on UserError { code }
    }
  }
`);

export const MyConferenceQuery = graphql(`
  query MyConference($id: ID!) {
    myConference(id: $id) {
      __typename
      ... on Conference { ...EditorConferenceFields }
      ... on UserError { code }
    }
  }
`);

export const CreateConference = graphql(`
  mutation CreateConference($input: ConferenceInput!) {
    createConference(input: $input) {
      __typename
      ... on Conference { id }
      ... on UserError { code field }
    }
  }
`);

export const UpdateConference = graphql(`
  mutation UpdateConference($id: ID!, $input: ConferenceInput!) {
    updateConference(id: $id, input: $input) {
      __typename
      ... on Conference { ...EditorConferenceFields }
      ... on UserError { code field }
    }
  }
`);

export const PublishConference = graphql(`
  mutation PublishConference($id: ID!) {
    publishConference(id: $id) {
      __typename
      ... on Conference { ...EditorConferenceFields }
      ... on UserError { code field }
    }
  }
`);

export const UnpublishConference = graphql(`
  mutation UnpublishConference($id: ID!) {
    unpublishConference(id: $id) {
      __typename
      ... on Conference { ...EditorConferenceFields }
      ... on UserError { code field }
    }
  }
`);

export const CancelConference = graphql(`
  mutation CancelConference($id: ID!) {
    cancelConference(id: $id) {
      __typename
      ... on Conference { ...EditorConferenceFields }
      ... on UserError { code field }
    }
  }
`);

export const DuplicateConference = graphql(`
  mutation DuplicateConference($id: ID!) {
    duplicateConference(id: $id) {
      __typename
      ... on Conference { id }
      ... on UserError { code }
    }
  }
`);

export const DeleteConference = graphql(`
  mutation DeleteConference($id: ID!) {
    deleteConference(id: $id) {
      __typename
      ... on UserError { code }
    }
  }
`);

export const UpsertTrack = graphql(`
  mutation UpsertTrack($conferenceId: ID!, $input: TrackInput!, $trackId: ID) {
    upsertTrack(conferenceId: $conferenceId, input: $input, trackId: $trackId) {
      __typename
      ... on UserError { code field }
    }
  }
`);

export const RemoveTrack = graphql(`
  mutation RemoveTrack($conferenceId: ID!, $trackId: ID!) {
    removeTrack(conferenceId: $conferenceId, trackId: $trackId) {
      __typename
      ... on UserError { code }
    }
  }
`);

export const UpsertSpeaker = graphql(`
  mutation UpsertSpeaker($conferenceId: ID!, $input: SpeakerInput!, $speakerId: ID) {
    upsertSpeaker(conferenceId: $conferenceId, input: $input, speakerId: $speakerId) {
      __typename
      ... on UserError { code field }
    }
  }
`);

export const RemoveSpeaker = graphql(`
  mutation RemoveSpeaker($conferenceId: ID!, $speakerId: ID!) {
    removeSpeaker(conferenceId: $conferenceId, speakerId: $speakerId) {
      __typename
      ... on UserError { code }
    }
  }
`);

export const UpsertSession = graphql(`
  mutation UpsertSession($conferenceId: ID!, $input: SessionInput!, $sessionId: ID) {
    upsertSession(conferenceId: $conferenceId, input: $input, sessionId: $sessionId) {
      __typename
      ... on UserError { code field }
    }
  }
`);

export const RemoveSession = graphql(`
  mutation RemoveSession($conferenceId: ID!, $sessionId: ID!) {
    removeSession(conferenceId: $conferenceId, sessionId: $sessionId) {
      __typename
      ... on UserError { code }
    }
  }
`);

export const SetDayLabel = graphql(`
  mutation SetDayLabel($conferenceId: ID!, $day: Date!, $label: LocalizedTextInput) {
    setDayLabel(conferenceId: $conferenceId, day: $day, label: $label) {
      __typename
      ... on UserError { code field }
    }
  }
`);

export const AttendeesQuery = graphql(`
  query Attendees($conferenceId: ID!, $filter: AttendeeFilter, $first: Int!, $after: String) {
    attendees(conferenceId: $conferenceId, filter: $filter, first: $first, after: $after) {
      __typename
      ... on AttendeeConnection {
        totalCount
        pageInfo { hasNextPage endCursor }
        edges {
          node { id name email lang status ticketCode confirmedAt promotedAt checkedInAt cancelledAt createdAt }
        }
      }
      ... on UserError { code }
    }
  }
`);

export const RemoveAttendee = graphql(`
  mutation RemoveAttendee($conferenceId: ID!, $attendeeId: ID!) {
    removeAttendee(conferenceId: $conferenceId, attendeeId: $attendeeId) {
      __typename
      ... on UserError { code }
    }
  }
`);

export const UndoCheckIn = graphql(`
  mutation UndoCheckIn($conferenceId: ID!, $attendeeId: ID!) {
    undoCheckIn(conferenceId: $conferenceId, attendeeId: $attendeeId) {
      __typename
      ... on UserError { code }
    }
  }
`);

export const SendReminders = graphql(`
  mutation SendReminders($conferenceId: ID!) {
    sendRemindersNow(conferenceId: $conferenceId) {
      __typename
      ... on RemindersSent { count }
      ... on UserError { code retryAfterSeconds }
    }
  }
`);

export const CheckIn = graphql(`
  mutation CheckIn($conferenceId: ID!, $code: String!, $scannedAt: DateTime) {
    checkIn(conferenceId: $conferenceId, code: $code, scannedAt: $scannedAt) {
      __typename
      ... on CheckedIn { attendee { id name checkedInAt } }
      ... on AlreadyCheckedIn { checkedInAt attendee { id name } }
      ... on UserError { code }
    }
  }
`);

export const ConferenceAnalyticsQuery = graphql(`
  query ConferenceAnalytics($conferenceId: ID!) {
    conferenceAnalytics(conferenceId: $conferenceId) {
      __typename
      ... on ConferenceAnalytics {
        registered
        confirmed
        waitlisted
        checkedIn
        capacity
        everConfirmed
        totalSignups
        byDay { day registered left waitlisted }
        arrivals { at count }
        byStatus { key count }
        byLanguage { key count }
      }
      ... on UserError { code }
    }
  }
`);

export const AnalyticsOverviewQuery = graphql(`
  query AnalyticsOverview($days: Int!) {
    analyticsOverview(days: $days) {
      __typename
      ... on AnalyticsOverview {
        byDay { day registered left waitlisted }
        conferences { id title startsAt capacity registered checkedIn }
      }
      ... on UserError { code }
    }
  }
`);
