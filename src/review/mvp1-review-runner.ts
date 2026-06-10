import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { normalizePostgresUrl } from "../db/database-url.js";
import {
  createMemoryReviewPersistence,
  createPostgresReviewPersistence
} from "./mvp1-review-persistence.js";
import { startMvp1ReviewServer } from "./mvp1-review-server.js";

const connectionString = process.env.DATABASE_URL
  ? normalizePostgresUrl(process.env.DATABASE_URL)
  : undefined;

const persistence = connectionString
  ? createPostgresReviewPersistence(drizzle(new Pool({ connectionString })))
  : createMemoryReviewPersistence();

startMvp1ReviewServer(Number(process.env.PORT ?? 4173), { persistence });
