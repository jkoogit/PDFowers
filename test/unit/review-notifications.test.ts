import { describe, expect, test } from "vitest";
import { createLocalUser, type AccountMergeRequest } from "../../src/domains/auth/auth-domain.js";
import {
  createAccountMergeApprovedNotifications,
  createAccountMergeRequestedNotifications,
  type EmailSender
} from "../../src/review/review-notifications.js";

function mergeFixture() {
  const requestUser = createLocalUser({
    loginId: "requester",
    email: "requester@example.test",
    password: "correct-password",
    displayName: "요청 계정",
    emailVerifiedAt: new Date("2026-06-12T00:00:00.000Z")
  });
  const targetUser = createLocalUser({
    loginId: "target",
    email: "target@example.test",
    password: "correct-password",
    displayName: "대상 계정",
    emailVerifiedAt: new Date("2026-06-12T00:00:00.000Z")
  });
  const mergeRequest: AccountMergeRequest = {
    mergeRequestUuid: "merge-request-001",
    requestUserUuid: requestUser.userUuid,
    targetUserUuid: targetUser.userUuid,
    provider: "kakao",
    providerUserId: "kakao-user-001",
    status: "pending",
    expiresAt: new Date("2026-06-13T00:00:00.000Z")
  };
  return { requestUser, targetUser, mergeRequest };
}

describe("MVP1 계정통합 알림 이벤트", () => {
  test("계정 통합 요청은 대상 계정에 샘플 이벤트와 이메일 발송 이벤트를 만든다", async () => {
    const { requestUser, targetUser, mergeRequest } = mergeFixture();
    const sent: string[] = [];
    const sender: EmailSender = {
      send: async (message) => {
        sent.push(message.to);
      }
    };

    const events = await createAccountMergeRequestedNotifications({
      mergeRequest,
      requestUser,
      targetUser,
      sender,
      now: new Date("2026-06-12T01:00:00.000Z")
    });

    expect(events).toHaveLength(2);
    expect(events.map((event) => event.channel)).toEqual(["sample", "email"]);
    expect(events.map((event) => event.status)).toEqual(["recorded", "sent"]);
    expect(events[0]).toMatchObject({
      eventType: "ACCOUNT_MERGE_REQUESTED",
      recipientUserUuid: targetUser.userUuid,
      recipientEmail: "target@example.test",
      provider: "kakao"
    });
    expect(sent).toEqual(["target@example.test"]);
  });

  test("계정 통합 승인은 요청 계정과 대상 계정 양쪽에 샘플 이벤트와 이메일 발송 이벤트를 만든다", async () => {
    const { requestUser, targetUser, mergeRequest } = mergeFixture();
    mergeRequest.status = "approved";
    const sent: string[] = [];
    const sender: EmailSender = {
      send: async (message) => {
        sent.push(message.to);
      }
    };

    const events = await createAccountMergeApprovedNotifications({
      mergeRequest,
      requestUser,
      targetUser,
      sender,
      now: new Date("2026-06-12T01:30:00.000Z")
    });

    expect(events).toHaveLength(4);
    expect(events.filter((event) => event.channel === "sample")).toHaveLength(2);
    expect(events.filter((event) => event.channel === "email")).toHaveLength(2);
    expect(events.every((event) => event.eventType === "ACCOUNT_MERGE_APPROVED")).toBe(true);
    expect(sent).toEqual(["requester@example.test", "target@example.test"]);
  });

  test("이메일 발송 실패는 계정 통합 이벤트를 실패 상태로 남긴다", async () => {
    const { requestUser, targetUser, mergeRequest } = mergeFixture();
    const sender: EmailSender = {
      send: async () => {
        throw new Error("SMTP unavailable");
      }
    };

    const events = await createAccountMergeRequestedNotifications({
      mergeRequest,
      requestUser,
      targetUser,
      sender,
      now: new Date("2026-06-12T01:00:00.000Z")
    });

    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({
      channel: "email",
      status: "failed",
      error: "SMTP unavailable"
    });
  });
});
