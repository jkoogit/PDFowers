import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { AUTH_ERRORS } from "./auth-errors.js";

function createPasswordHash(password, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [algorithm, salt, hash] = storedHash.split(":");
  if (algorithm !== "scrypt" || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, "hex");
  const actual = Buffer.from(createPasswordHash(password, salt).split(":")[2], "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createLocalUser({ loginId, email, password, displayName }) {
  return {
    userUuid: randomUUID(),
    loginId,
    primaryEmail: email,
    passwordHash: createPasswordHash(password),
    displayName,
    status: "active",
    identities: [],
    auditLogs: [{ eventType: "LOCAL_USER_CREATED" }]
  };
}

export function verifyLocalLogin(user, password) {
  if (!verifyPassword(password, user.passwordHash)) {
    return { ok: false, error: AUTH_ERRORS.INVALID_CREDENTIALS };
  }

  return { ok: true, userUuid: user.userUuid };
}

export function unlinkLocalCredential() {
  return { ok: false, error: AUTH_ERRORS.LOCAL_CREDENTIAL_REQUIRED };
}

function findUserByIdentity(users, provider, providerUserId) {
  return users.find((user) =>
    user.identities.some((identity) =>
      identity.provider === provider && identity.providerUserId === providerUserId
    )
  );
}

export function linkOAuthIdentity({ currentUser, allUsers, provider, providerUserId }) {
  const owner = findUserByIdentity(allUsers, provider, providerUserId);

  if (!owner) {
    currentUser.identities.push({ provider, providerUserId });
    currentUser.auditLogs.push({ eventType: "AUTH_IDENTITY_LINKED", provider });
    return { ok: true };
  }

  if (owner.userUuid === currentUser.userUuid) {
    return { ok: false, error: AUTH_ERRORS.AUTH_IDENTITY_ALREADY_LINKED };
  }

  return {
    ok: false,
    error: AUTH_ERRORS.ACCOUNT_MERGE_REQUIRED,
    mergeRequest: {
      mergeRequestUuid: randomUUID(),
      requestUserUuid: currentUser.userUuid,
      targetUserUuid: owner.userUuid,
      provider,
      providerUserId,
      status: "pending"
    }
  };
}

export function approveMergeRequest({ requestUser, targetUser, mergeRequest }) {
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
  requestUser.auditLogs.push({ eventType: "ACCOUNT_MERGE_APPROVED" });
  return { ok: true };
}
