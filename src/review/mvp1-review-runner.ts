import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { normalizePostgresUrl } from "../db/database-url.js";
import {
  createMemoryReviewPersistence,
  createPostgresReviewPersistence
} from "./mvp1-review-persistence.js";
import { startMvp1ReviewServer } from "./mvp1-review-server.js";
import { createKakaoOAuthClient, type KakaoOAuthConfig } from "./kakao-oauth.js";

const connectionString = process.env.DATABASE_URL
  ? normalizePostgresUrl(process.env.DATABASE_URL)
  : undefined;

const persistence = connectionString
  ? createPostgresReviewPersistence(drizzle(new Pool({ connectionString })))
  : createMemoryReviewPersistence();

const kakaoConfig = createKakaoConfigFromEnv();

startMvp1ReviewServer(Number(process.env.PORT ?? 4173), {
  persistence,
  kakaoConfig,
  kakaoOAuth: kakaoConfig ? createKakaoOAuthClient(kakaoConfig) : undefined
});

function createKakaoConfigFromEnv(): KakaoOAuthConfig | undefined {
  if (!process.env.KAKAO_REST_API_KEY || !process.env.KAKAO_REDIRECT_URI) {
    return undefined;
  }

  return {
    restApiKey: process.env.KAKAO_REST_API_KEY,
    redirectUri: process.env.KAKAO_REDIRECT_URI,
    clientSecret: process.env.KAKAO_CLIENT_SECRET,
    scope: process.env.KAKAO_SCOPE
  };
}
