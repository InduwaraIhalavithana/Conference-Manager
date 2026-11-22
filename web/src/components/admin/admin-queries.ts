// GraphQL for the admin area and the organizer help page.
import { graphql } from "@/graphql/generated";

export const AdminOverviewQuery = graphql(`
  query AdminOverview {
    adminOverview {
      __typename
      ... on AdminOverview {
        organizersActive
        organizersSuspended
        organizersUnverified
        conferencesUpcoming
        conferencesDrafts
        conferencesCancelled
        conferencesHidden
        registrationsActive
        registrationsWeek
        contactsOpen
        feedbackOpen
      }
      ... on UserError { code }
    }
  }
`);

export const SystemStatusQuery = graphql(`
  query SystemStatus {
    systemStatus {
      __typename
      ... on SystemStatus {
        mongo
        redis
        workerRunning
        workerSeenAt
        queueLength
        failedEmailsToday
        requestsLastHour
        errorsLastHour
        jobs { name at ok result }
      }
      ... on UserError { code }
    }
  }
`);

export const AdminOrganizersQuery = graphql(`
  query AdminOrganizers($q: String, $status: OrganizerFilter!, $first: Int!, $offset: Int!) {
    adminOrganizers(q: $q, status: $status, first: $first, offset: $offset) {
      __typename
      ... on AdminOrganizerPage {
        total
        items {
          suspended
          conferences
          organizer { id firstName lastName email organization avatarUrl emailVerified createdAt }
        }
      }
      ... on UserError { code }
    }
  }
`);

export const SuspendOrganizer = graphql(`
  mutation SuspendOrganizer($id: ID!) {
    suspendOrganizer(id: $id) {
      __typename
      ... on UserError { code }
    }
  }
`);

export const RestoreOrganizer = graphql(`
  mutation RestoreOrganizer($id: ID!) {
    restoreOrganizer(id: $id) {
      __typename
      ... on UserError { code }
    }
  }
`);

export const DeleteOrganizer = graphql(`
  mutation DeleteOrganizer($id: ID!) {
    deleteOrganizer(id: $id) {
      __typename
      ... on Removed { conferences registrations }
      ... on UserError { code }
    }
  }
`);

export const AdminConferencesQuery = graphql(`
  query AdminConferences($q: String, $status: AdminConferenceFilter!, $first: Int!, $offset: Int!) {
    adminConferences(q: $q, status: $status, first: $first, offset: $offset) {
      __typename
      ... on AdminConferencePage {
        total
        items { id slug title status hidden hiddenReason startsAt city registered capacity organizerName organizerEmail }
      }
      ... on UserError { code }
    }
  }
`);

export const SetConferenceHidden = graphql(`
  mutation SetConferenceHidden($id: ID!, $hidden: Boolean!) {
    setConferenceHidden(id: $id, hidden: $hidden) {
      __typename
      ... on UserError { code }
    }
  }
`);

export const ContactMessagesQuery = graphql(`
  query ContactMessages($status: ContactStatus, $first: Int!, $offset: Int!) {
    contactMessages(status: $status, first: $first, offset: $offset) {
      __typename
      ... on ContactPage {
        total
        items { id name email topic message status createdAt resolvedAt }
      }
      ... on UserError { code }
    }
  }
`);

export const ReplyToContact = graphql(`
  mutation ReplyToContact($id: ID!, $message: String!) {
    replyToContact(id: $id, message: $message) {
      __typename
      ... on UserError { code field }
    }
  }
`);

export const SetContactResolved = graphql(`
  mutation SetContactResolved($id: ID!, $resolved: Boolean!) {
    setContactResolved(id: $id, resolved: $resolved) {
      __typename
      ... on UserError { code }
    }
  }
`);

export const AdminFeedbackQuery = graphql(`
  query AdminFeedback($status: FeedbackStatus, $first: Int!, $offset: Int!) {
    adminFeedback(status: $status, first: $first, offset: $offset) {
      __typename
      ... on FeedbackPage {
        total
        items { id subject message status reply repliedAt createdAt organizerName organizerEmail }
      }
      ... on UserError { code }
    }
  }
`);

export const ReplyToFeedback = graphql(`
  mutation ReplyToFeedback($id: ID!, $reply: String!) {
    replyToFeedback(id: $id, reply: $reply) {
      __typename
      ... on UserError { code field }
    }
  }
`);

export const CloseFeedback = graphql(`
  mutation CloseFeedback($id: ID!) {
    closeFeedback(id: $id) {
      __typename
      ... on UserError { code }
    }
  }
`);

export const ActivityLogQuery = graphql(`
  query ActivityLog($actorType: String, $action: String, $first: Int!, $offset: Int!) {
    activityLog(actorType: $actorType, action: $action, first: $first, offset: $offset) {
      __typename
      ... on ActivityPage {
        total
        actions
        items { id actorType actorName action target createdAt }
      }
      ... on UserError { code }
    }
  }
`);

export const MyFeedbackQuery = graphql(`
  query MyFeedback {
    myFeedback {
      __typename
      ... on FeedbackList { items { id subject message status reply repliedAt createdAt } }
      ... on UserError { code }
    }
  }
`);

export const SendFeedback = graphql(`
  mutation SendFeedback($subject: String!, $message: String!) {
    sendFeedback(subject: $subject, message: $message) {
      __typename
      ... on UserError { code field retryAfterSeconds }
    }
  }
`);
