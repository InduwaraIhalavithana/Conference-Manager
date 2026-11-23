"use client";

import { useEffect, useRef, useState } from "react";

import { graphql } from "@/graphql/generated";

export const LiveQuestionsQuery = graphql(`
  query LiveQuestions($ticketCode: String!, $sessionId: ID) {
    liveQuestions(ticketCode: $ticketCode, sessionId: $sessionId) {
      __typename
      ... on QaBoard {
        open
        conferenceId
        conferenceTitle { en si ta }
        slug
        timezone
        sessionId
        sessions { id title { en si ta } startsAt endsAt room questions }
        questions { id sessionId text authorName votes status createdAt votedByMe mine }
      }
      ... on UserError { code message field }
    }
  }
`);

export const AskQuestion = graphql(`
  mutation AskQuestion($ticketCode: String!, $sessionId: ID!, $text: String!) {
    askQuestion(ticketCode: $ticketCode, sessionId: $sessionId, text: $text) {
      __typename
      ... on LiveQuestion { id }
      ... on UserError { code message field }
    }
  }
`);

export const VoteQuestion = graphql(`
  mutation VoteQuestion($ticketCode: String!, $questionId: ID!, $voted: Boolean!) {
    voteQuestion(ticketCode: $ticketCode, questionId: $questionId, voted: $voted) {
      __typename
      ... on LiveQuestion { id votes votedByMe }
      ... on UserError { code message field }
    }
  }
`);

export const SessionQuestionsQuery = graphql(`
  query SessionQuestions($conferenceId: ID!, $sessionId: ID!) {
    sessionQuestions(conferenceId: $conferenceId, sessionId: $sessionId) {
      __typename
      ... on SessionQuestions {
        sessions { id title { en si ta } startsAt endsAt room questions }
        questions { id sessionId text authorName votes status createdAt answeredAt }
      }
      ... on UserError { code }
    }
  }
`);

export const SetQuestionStatus = graphql(`
  mutation SetQuestionStatus($questionId: ID!, $status: QuestionStatus!) {
    setQuestionStatus(questionId: $questionId, status: $status) {
      __typename
      ... on ModeratedQuestion { id status answeredAt }
      ... on UserError { code message field }
    }
  }
`);

/**
 * Listens to the conference's public "questions changed" stream and calls `onChange` when the given session's
 * questions change. The stream carries no content; callers refetch. Returns whether the stream is connected.
 */
export function useQaSignals(conferenceId: string | null | undefined, sessionId: string | null | undefined, onChange: () => void): boolean {
  const [live, setLive] = useState(false);
  const latest = useRef({ sessionId, onChange });
  useEffect(() => {
    latest.current = { sessionId, onChange };
  });
  useEffect(() => {
    if (!conferenceId) return;
    const source = new EventSource(`/api/conferences/${conferenceId}/qa-live`);
    source.onopen = () => setLive(true);
    source.onerror = () => setLive(false);
    source.onmessage = (message) => {
      const event = JSON.parse(message.data) as { type: string; sessionId?: string };
      if (event.type === "questions" && event.sessionId === latest.current.sessionId) latest.current.onChange();
    };
    return () => source.close();
  }, [conferenceId]);
  return live;
}

export function LiveDot({ live, label }: { live: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
      <span className={live ? "size-2 animate-pulse rounded-full bg-success" : "size-2 rounded-full bg-muted-foreground"} aria-hidden />
      {label}
    </span>
  );
}
