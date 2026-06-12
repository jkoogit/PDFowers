import { createConnection, type Socket } from "node:net";
import { connect as connectTls, type TLSSocket } from "node:tls";
import type { EmailMessage, EmailSender } from "./review-notifications.js";

type SmtpEnv = Partial<Record<string, string>>;

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username?: string;
  password?: string;
  from: string;
}

type SmtpConnection = Socket | TLSSocket;

export function normalizeSmtpConfig(env: SmtpEnv): SmtpConfig | undefined {
  if (!env.SMTP_HOST || !env.SMTP_FROM) {
    return undefined;
  }

  const secure = env.SMTP_SECURE === "true";
  return {
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT ?? (secure ? 465 : 25)),
    secure,
    username: env.SMTP_USER,
    password: env.SMTP_PASS,
    from: env.SMTP_FROM
  };
}

export function createEmailSenderFromEnv(env: SmtpEnv): EmailSender {
  const config = normalizeSmtpConfig(env);
  if (!config) {
    return createMissingEmailSender();
  }

  return createSmtpEmailSender(config);
}

export function createSmtpEmailSender(config: SmtpConfig): EmailSender {
  return {
    send: async (message) => {
      await sendSmtpMessage(config, message);
    }
  };
}

export function buildSmtpMessage({
  from,
  to,
  subject,
  body
}: EmailMessage & { from: string }) {
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    body
  ].join("\r\n") + "\r\n";
}

async function sendSmtpMessage(config: SmtpConfig, message: EmailMessage) {
  const socket = await openConnection(config);
  const reader = createSmtpReader(socket);

  try {
    await reader.expect(220);
    await writeCommand(socket, `EHLO pdfowers.local`);
    await reader.expect(250);

    if (config.username && config.password) {
      const token = Buffer.from(`\0${config.username}\0${config.password}`).toString("base64");
      await writeCommand(socket, `AUTH PLAIN ${token}`);
      await reader.expect(235);
    }

    await writeCommand(socket, `MAIL FROM:<${config.from}>`);
    await reader.expect(250);
    await writeCommand(socket, `RCPT TO:<${message.to}>`);
    await reader.expect(250);
    await writeCommand(socket, "DATA");
    await reader.expect(354);
    socket.write(`${escapeSmtpData(buildSmtpMessage({ ...message, from: config.from }))}\r\n.\r\n`);
    await reader.expect(250);
    await writeCommand(socket, "QUIT");
    await reader.expect(221);
  } finally {
    socket.end();
  }
}

function openConnection(config: SmtpConfig): Promise<SmtpConnection> {
  return new Promise((resolve, reject) => {
    const socket = config.secure
      ? connectTls({ host: config.host, port: config.port, servername: config.host })
      : createConnection({ host: config.host, port: config.port });

    socket.once("connect", () => resolve(socket));
    socket.once("secureConnect", () => resolve(socket));
    socket.once("error", reject);
  });
}

function createSmtpReader(socket: SmtpConnection) {
  let buffer = "";
  const pending: Array<() => void> = [];
  socket.setEncoding("utf8");
  socket.on("data", (chunk) => {
    buffer += chunk;
    while (pending.length > 0) {
      pending.shift()?.();
    }
  });

  return {
    expect: async (code: number) => {
      const response = await readResponse();
      if (!response.startsWith(String(code))) {
        throw new Error(`SMTP_EXPECTED_${code}_GOT_${response.trim()}`);
      }
    }
  };

  async function readResponse(): Promise<string> {
    while (!hasCompleteResponse(buffer)) {
      await new Promise<void>((resolve) => pending.push(resolve));
    }
    const lines = buffer.split(/\r?\n/);
    const responseLines: string[] = [];
    let consumed = 0;
    for (const line of lines) {
      consumed += line.length + 2;
      if (!line) {
        continue;
      }
      responseLines.push(line);
      if (/^\d{3} /.test(line)) {
        break;
      }
    }
    buffer = buffer.slice(consumed);
    return responseLines.join("\n");
  }
}

function hasCompleteResponse(buffer: string) {
  return buffer.split(/\r?\n/).some((line) => /^\d{3} /.test(line));
}

function writeCommand(socket: SmtpConnection, command: string) {
  socket.write(`${command}\r\n`);
}

function encodeHeader(value: string) {
  if (/^[\x00-\x7F]*$/.test(value)) {
    return value;
  }

  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function escapeSmtpData(value: string) {
  return value.replace(/^\./gm, "..");
}

function createMissingEmailSender(): EmailSender {
  return {
    send: async () => {
      throw new Error("EMAIL_SENDER_NOT_CONFIGURED");
    }
  };
}
