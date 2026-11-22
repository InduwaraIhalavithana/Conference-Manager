// GraphQL documents shared by the organizer and admin areas (kept out of "use client" files so server code can import them too).
import { graphql } from "@/graphql/generated";

export const MeQuery = graphql(`
  query Me {
    me {
      __typename
      ... on Organizer {
        id
        firstName
        lastName
        email
        phone
        organization
        avatarUrl
        lang
        createdAt
        bio { en si ta }
      }
      ... on Admin { id username email }
    }
  }
`);

export const NotificationsQuery = graphql(`
  query Notifications($first: Int!, $after: String) {
    notifications(first: $first, after: $after) {
      __typename
      ... on NotificationPage {
        unread
        hasNextPage
        endCursor
        items { id kind params link read createdAt }
      }
    }
  }
`);

export const UnreadQuery = graphql(`
  query Unread {
    unreadNotifications {
      __typename
      ... on UnreadCount { unread }
    }
  }
`);

export const MarkReadMutation = graphql(`
  mutation MarkRead($ids: [ID!]) {
    markNotificationsRead(ids: $ids) {
      __typename
      ... on UnreadCount { unread }
    }
  }
`);

export const LogoutMutation = graphql(`
  mutation Logout {
    logout { ok }
  }
`);
