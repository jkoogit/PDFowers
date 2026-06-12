import { randomUUID } from "node:crypto";
import type { AccountMergeRequest, AuthUser } from "../domains/auth/auth-domain.js";

export type ReviewNotificationChannel = "sample" | "email";
export type ReviewNotificationStatus = "recorded" | "sent" | "failed";

export interface ReviewNotificationEvent {
  notificationUuid: string;
  eventType: "ACCOUNT_MERGE_REQUESTED" | "ACCOUNT_MERGE_APPROVED";
  channel: ReviewNotificationChannel;
  status: ReviewNotificationStatus;
  recipientUserUuid: string;
  recipientEmail: string;
  provider: AccountMergeRequest["provider"];
  mergeRequestUuid: string;
  subject: string;
  body: string;
  createdAt: string;
  sentAt?: string;
  error?: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

interface MergeNotificationInput {
  mergeRequest: AccountMergeRequest;
  requestUser: AuthUser;
  targetUser: AuthUser;
  sender: EmailSender;
  now?: Date;
}

export async function createAccountMergeRequestedNotifications({
  mergeRequest,
  requestUser,
  targetUser,
  sender,
  now = new Date()
}: MergeNotificationInput): Promise<ReviewNotificationEvent[]> {
  const message = {
    recipient: targetUser,
    subject: "[PDFowers] 계정 통합 승인 요청",
    body:
      `${requestUser.displayName} 계정에서 ${mergeRequest.provider} 로그인 수단 통합을 요청했습니다.\n` +
      `요청을 승인하면 해당 로그인 수단은 요청 계정으로 이전됩니다.\n` +
      `만료 시각: ${mergeRequest.expiresAt.toISOString()}`
  };

  return createNotificationPair({
    eventType: "ACCOUNT_MERGE_REQUESTED",
    mergeRequest,
    message,
    sender,
    now
  });
}

export async function createAccountMergeApprovedNotifications({
  mergeRequest,
  requestUser,
  targetUser,
  sender,
  now = new Date()
}: MergeNotificationInput): Promise<ReviewNotificationEvent[]> {
  const messages = [
    {
      recipient: requestUser,
      subject: "[PDFowers] 계정 통합이 완료되었습니다",
      body:
        `${targetUser.displayName} 계정의 ${mergeRequest.provider} 로그인 수단이 현재 계정으로 이전되었습니다.`
    },
    {
      recipient: targetUser,
      subject: "[PDFowers] 계정 통합 승인 완료",
      body:
        `${mergeRequest.provider} 로그인 수단이 ${requestUser.displayName} 계정으로 이전되었고, 이 계정은 통합됨 상태가 되었습니다.`
    }
  ];

  const events: ReviewNotificationEvent[] = [];
  for (const message of messages) {
    events.push(
      ...(await createNotificationPair({
        eventType: "ACCOUNT_MERGE_APPROVED",
        mergeRequest,
        message,
        sender,
        now
      }))
    );
  }
  return events;
}

async function createNotificationPair({
  eventType,
  mergeRequest,
  message,
  sender,
  now
}: {
  eventType: ReviewNotificationEvent["eventType"];
  mergeRequest: AccountMergeRequest;
  message: {
    recipient: AuthUser;
    subject: string;
    body: string;
  };
  sender: EmailSender;
  now: Date;
}): Promise<ReviewNotificationEvent[]> {
  const base = {
    eventType,
    recipientUserUuid: message.recipient.userUuid,
    recipientEmail: message.recipient.primaryEmail,
    provider: mergeRequest.provider,
    mergeRequestUuid: mergeRequest.mergeRequestUuid,
    subject: message.subject,
    body: message.body,
    createdAt: now.toISOString()
  };
  const sampleEvent: ReviewNotificationEvent = {
    ...base,
    notificationUuid: randomUUID(),
    channel: "sample",
    status: "recorded"
  };
  const emailEvent: ReviewNotificationEvent = {
    ...base,
    notificationUuid: randomUUID(),
    channel: "email",
    status: "sent",
    sentAt: now.toISOString()
  };

  try {
    await sender.send({
      to: message.recipient.primaryEmail,
      subject: message.subject,
      body: message.body
    });
  } catch (error) {
    emailEvent.status = "failed";
    delete emailEvent.sentAt;
    emailEvent.error = error instanceof Error ? error.message : "EMAIL_SEND_FAILED";
  }

  return [sampleEvent, emailEvent];
}
