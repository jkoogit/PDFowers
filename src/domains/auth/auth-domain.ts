import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { AUTH_ERRORS, type AuthErrorCode } from "./auth-errors.js";

export type AuthProvider = "kakao" | "naver" | "google";
export type UserStatus = "active" | "merged";
export type MergeRequestStatus = "pending" | "approved" | "cancelled" | "expired";

export interface AuthIdentity {
  provider: AuthProvider;
  providerUserId: string;
  emailFromProvider?: string;
  connectedAt: Date;
  lastLoginAt?: Date;
}

export interface VerifiedEmail {
  email: string;
  emailVerifiedAt: Date | null;
  emailNotificationOptIn: boolean;
}

export interface AuditLog {
  eventType: string;
  provider?: AuthProvider;
  actorUserUuid?: string;
  targetUserUuid?: string;
  metadata?: Record<string, unknown>;
}

export interface AuthUser {
  userUuid: string;
  loginId: string;
  primaryEmail: string;
  passwordHash: string;
  displayName: string;
  status: UserStatus;
  identities: AuthIdentity[];
  verifiedEmails: VerifiedEmail[];
  auditLogs: AuditLog[];
  mergedIntoUserUuid?: string;
  pendingEmail?: string;
}

export interface AccountMergeRequest {
  mergeRequestUuid: string;
  requestUserUuid: string;
  targetUserUuid: string;
  provider: AuthProvider;
  providerUserId: string;
  status: MergeRequestStatus;
  expiresAt: Date;
  approvedAt?: Date;
  cancelledAt?: Date;
}

type AuthResult<T extends object = object> =
  | ({ ok: true } & Partial<T>)
  | ({ ok: false; error: AuthErrorCode } & Partial<T>);

const DEFAULT_MERGE_EXPIRES_IN_MS = 24 * 60 * 60 * 1000;

function createPasswordHash(password: string, salt = randomBytes(16).toString("hex")): string {
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [algorithm, salt, hash] = storedHash.split(":");
  if (algorithm !== "scrypt" || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, "hex");
  const actual = Buffer.from(createPasswordHash(password, salt).split(":")[2], "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function hasVerifiedPrimaryEmail(user: AuthUser): boolean {
  return user.verifiedEmails.some(
    (email) => email.email === user.primaryEmail && email.emailVerifiedAt !== null
  );
}

function appendAuditLog(user: AuthUser, eventType: string, details: Omit<AuditLog, "eventType"> = {}) {
  user.auditLogs.push({ eventType, ...details });
}

export function createLocalUser({
  loginId,
  email,
  password,
  displayName,
  emailNotificationOptIn = false,
  emailVerifiedAt = null
}: {
  loginId: string;
  email: string;
  password: string;
  displayName: string;
  emailNotificationOptIn?: boolean;
  emailVerifiedAt?: Date | null;
}): AuthUser {
  return {
    userUuid: randomUUID(),
    loginId,
    primaryEmail: email,
    passwordHash: createPasswordHash(password),
    displayName,
    status: "active",
    identities: [],
    verifiedEmails: [{ email, emailVerifiedAt, emailNotificationOptIn }],
    auditLogs: [{ eventType: "LOCAL_USER_CREATED" }]
  };
}

export function createOAuthUser({
  loginId,
  email,
  password,
  displayName,
  provider,
  providerUserId,
  emailFromProvider
}: {
  loginId: string;
  email: string;
  password: string;
  displayName: string;
  provider: AuthProvider;
  providerUserId: string;
  emailFromProvider?: string;
}): AuthUser {
  const user = createLocalUser({ loginId, email, password, displayName });
  user.identities.push({ provider, providerUserId, emailFromProvider, connectedAt: new Date() });
  appendAuditLog(user, "AUTH_IDENTITY_LINKED", { provider });
  return user;
}

export function verifyLocalLogin(
  user: AuthUser,
  password: string,
  options: { emailVerificationRequired?: boolean } = {}
): AuthResult<{ userUuid: string }> {
  if (!verifyPassword(password, user.passwordHash)) {
    appendAuditLog(user, "LOGIN_FAILURE");
    return { ok: false, error: AUTH_ERRORS.INVALID_CREDENTIALS };
  }

  if (options.emailVerificationRequired && !hasVerifiedPrimaryEmail(user)) {
    appendAuditLog(user, "EMAIL_VERIFICATION_REQUIRED");
    return { ok: false, error: AUTH_ERRORS.EMAIL_VERIFICATION_REQUIRED };
  }

  appendAuditLog(user, "LOGIN_SUCCESS");
  return { ok: true, userUuid: user.userUuid };
}

export function findOAuthLogin(
  users: AuthUser[],
  provider: AuthProvider,
  providerUserId: string
): AuthResult<{ userUuid: string }> {
  const owner = findUserByIdentity(users, provider, providerUserId);
  if (!owner) {
    return { ok: false, error: AUTH_ERRORS.INVALID_CREDENTIALS };
  }

  const identity = owner.identities.find(
    (candidate) => candidate.provider === provider && candidate.providerUserId === providerUserId
  );
  if (identity) {
    identity.lastLoginAt = new Date();
  }
  appendAuditLog(owner, "LOGIN_SUCCESS", { provider });
  return { ok: true, userUuid: owner.userUuid };
}

export function unlinkLocalCredential(_user?: AuthUser): AuthResult {
  return { ok: false, error: AUTH_ERRORS.LOCAL_CREDENTIAL_REQUIRED };
}

function findUserByIdentity(users: AuthUser[], provider: AuthProvider, providerUserId: string) {
  return users.find((user) =>
    user.identities.some((identity) =>
      identity.provider === provider && identity.providerUserId === providerUserId
    )
  );
}

export function linkOAuthIdentity({
  currentUser,
  allUsers,
  provider,
  providerUserId,
  emailFromProvider,
  now = new Date(),
  expiresInMs = DEFAULT_MERGE_EXPIRES_IN_MS
}: {
  currentUser: AuthUser;
  allUsers: AuthUser[];
  provider: AuthProvider;
  providerUserId: string;
  emailFromProvider?: string;
  now?: Date;
  expiresInMs?: number;
}): AuthResult<{ mergeRequest: AccountMergeRequest }> {
  const owner = findUserByIdentity(allUsers, provider, providerUserId);

  if (!owner) {
    currentUser.identities.push({ provider, providerUserId, emailFromProvider, connectedAt: now });
    appendAuditLog(currentUser, "AUTH_IDENTITY_LINKED", { provider });
    return { ok: true };
  }

  if (owner.userUuid === currentUser.userUuid) {
    return { ok: false, error: AUTH_ERRORS.AUTH_IDENTITY_ALREADY_LINKED };
  }

  const mergeRequest: AccountMergeRequest = {
    mergeRequestUuid: randomUUID(),
    requestUserUuid: currentUser.userUuid,
    targetUserUuid: owner.userUuid,
    provider,
    providerUserId,
    status: "pending",
    expiresAt: new Date(now.getTime() + expiresInMs)
  };
  appendAuditLog(currentUser, "ACCOUNT_MERGE_REQUESTED", {
    provider,
    targetUserUuid: owner.userUuid
  });
  return {
    ok: false,
    error: AUTH_ERRORS.ACCOUNT_MERGE_REQUIRED,
    mergeRequest
  };
}

export function unlinkOAuthIdentity({
  user,
  provider
}: {
  user: AuthUser;
  provider: AuthProvider;
}): AuthResult {
  const before = user.identities.length;
  user.identities = user.identities.filter((identity) => identity.provider !== provider);

  if (user.identities.length === before) {
    return { ok: false, error: AUTH_ERRORS.AUTH_IDENTITY_NOT_LINKED };
  }

  appendAuditLog(user, "AUTH_IDENTITY_UNLINKED", { provider });
  return { ok: true };
}

export function approveMergeRequest({
  requestUser,
  targetUser,
  mergeRequest,
  now = new Date()
}: {
  requestUser: AuthUser;
  targetUser: AuthUser;
  mergeRequest: AccountMergeRequest;
  now?: Date;
}): AuthResult {
  if (mergeRequest.status === "approved") {
    return { ok: false, error: AUTH_ERRORS.DUPLICATE_MERGE_APPROVAL };
  }

  if (mergeRequest.status === "cancelled") {
    return { ok: false, error: AUTH_ERRORS.MERGE_REQUEST_CANCELLED };
  }

  if (mergeRequest.status !== "pending") {
    return { ok: false, error: AUTH_ERRORS.MERGE_REQUEST_NOT_PENDING };
  }

  if (mergeRequest.expiresAt.getTime() <= now.getTime()) {
    mergeRequest.status = "expired";
    appendAuditLog(requestUser, "ACCOUNT_MERGE_EXPIRED", { provider: mergeRequest.provider });
    return { ok: false, error: AUTH_ERRORS.MERGE_REQUEST_EXPIRED };
  }

  const movingIdentityIndex = targetUser.identities.findIndex((identity) =>
    identity.provider === mergeRequest.provider &&
    identity.providerUserId === mergeRequest.providerUserId
  );

  if (movingIdentityIndex === -1) {
    return { ok: false, error: AUTH_ERRORS.INVALID_CREDENTIALS };
  }

  const [identity] = targetUser.identities.splice(movingIdentityIndex, 1);
  requestUser.identities.push(identity);
  targetUser.status = "merged";
  targetUser.mergedIntoUserUuid = requestUser.userUuid;
  mergeRequest.status = "approved";
  mergeRequest.approvedAt = now;
  appendAuditLog(requestUser, "ACCOUNT_MERGE_APPROVED", {
    provider: mergeRequest.provider,
    targetUserUuid: targetUser.userUuid
  });
  appendAuditLog(targetUser, "ACCOUNT_MERGED", {
    actorUserUuid: requestUser.userUuid,
    provider: mergeRequest.provider
  });
  return { ok: true };
}

export function cancelMergeRequest({
  user,
  mergeRequest,
  now = new Date()
}: {
  user: AuthUser;
  mergeRequest: AccountMergeRequest;
  now?: Date;
}): AuthResult {
  if (mergeRequest.status !== "pending") {
    return { ok: false, error: AUTH_ERRORS.MERGE_REQUEST_NOT_PENDING };
  }

  mergeRequest.status = "cancelled";
  mergeRequest.cancelledAt = now;
  appendAuditLog(user, "ACCOUNT_MERGE_CANCELLED", { provider: mergeRequest.provider });
  return { ok: true };
}

export function deleteVerifiedEmail({
  user,
  email,
  emailVerificationRequired
}: {
  user: AuthUser;
  email: string;
  emailVerificationRequired: boolean;
}): AuthResult {
  const target = user.verifiedEmails.find((candidate) => candidate.email === email);
  if (emailVerificationRequired && target?.emailVerifiedAt) {
    return { ok: false, error: AUTH_ERRORS.VERIFIED_EMAIL_REQUIRED };
  }

  user.verifiedEmails = user.verifiedEmails.filter((candidate) => candidate.email !== email);
  appendAuditLog(user, "VERIFIED_EMAIL_DELETED", { metadata: { email } });
  return { ok: true };
}

export function requestEmailChange(user: AuthUser, nextEmail: string): AuthResult {
  user.pendingEmail = nextEmail;
  appendAuditLog(user, "EMAIL_CHANGE_REQUESTED", { metadata: { nextEmail } });
  return { ok: true };
}

export function confirmEmailChange(user: AuthUser, verifiedAt = new Date()): AuthResult {
  if (!user.pendingEmail) {
    return { ok: false, error: AUTH_ERRORS.INVALID_CREDENTIALS };
  }

  const previousEmail = user.primaryEmail;
  user.primaryEmail = user.pendingEmail;
  user.verifiedEmails = [
    { email: user.pendingEmail, emailVerifiedAt: verifiedAt, emailNotificationOptIn: true }
  ];
  delete user.pendingEmail;
  appendAuditLog(user, "EMAIL_CHANGED", { metadata: { previousEmail } });
  return { ok: true };
}
