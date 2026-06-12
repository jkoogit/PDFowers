import { describe, expect, test } from "vitest";
import {
  buildSmtpMessage,
  createEmailSenderFromEnv,
  normalizeSmtpConfig
} from "../../src/review/smtp-email-sender.js";

describe("SMTP 이메일 발송 어댑터", () => {
  test("환경변수가 없으면 명시적으로 발송 불가 sender를 반환한다", async () => {
    const sender = createEmailSenderFromEnv({});

    await expect(sender.send({
      to: "target@example.test",
      subject: "테스트",
      body: "본문"
    })).rejects.toThrow("EMAIL_SENDER_NOT_CONFIGURED");
  });

  test("SMTP 환경변수는 실발송 설정으로 정규화한다", () => {
    const config = normalizeSmtpConfig({
      SMTP_HOST: "smtp.example.test",
      SMTP_PORT: "465",
      SMTP_SECURE: "true",
      SMTP_USER: "smtp-user",
      SMTP_PASS: "smtp-pass",
      SMTP_FROM: "noreply@example.test"
    });

    expect(config).toEqual({
      host: "smtp.example.test",
      port: 465,
      secure: true,
      username: "smtp-user",
      password: "smtp-pass",
      from: "noreply@example.test"
    });
  });

  test("SMTP 메시지는 From, To, Subject와 UTF-8 본문을 포함한다", () => {
    const message = buildSmtpMessage({
      from: "noreply@example.test",
      to: "target@example.test",
      subject: "계정 통합 승인 요청",
      body: "요청 계정에서 통합을 요청했습니다."
    });

    expect(message).toContain("From: noreply@example.test");
    expect(message).toContain("To: target@example.test");
    expect(message).toContain("Subject: =?UTF-8?B?");
    expect(message).toContain("Content-Type: text/plain; charset=utf-8");
    expect(message).toContain("요청 계정에서 통합을 요청했습니다.");
    expect(message.endsWith("\r\n")).toBe(true);
  });
});
