type DatabaseEnv = Partial<Record<string, string>>;

export function normalizePostgresUrl(url: string): string {
  if (url.startsWith("jdbc:postgresql://")) {
    return url.replace(/^jdbc:postgresql:\/\//, "postgresql://");
  }

  return url;
}

export function getDatabaseUrl(env: DatabaseEnv): string {
  const url = env.DATABASE_URL;

  if (!url) {
    throw new Error("DATABASE_URL is required");
  }

  return normalizePostgresUrl(url);
}
