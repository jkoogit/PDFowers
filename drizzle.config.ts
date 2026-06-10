import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { getDatabaseUrl } from "./src/db/database-url.js";

const defaultDevDatabaseUrl = "postgresql://devdbusr:password@192.168.219.125:35432/pdfowers_dev";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: getDatabaseUrl({
      DATABASE_URL: defaultDevDatabaseUrl,
      ...process.env
    })
  }
});
