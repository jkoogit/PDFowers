import { describe, expect, test } from "vitest";
import { getDatabaseUrl, normalizePostgresUrl } from "../../src/db/database-url.js";

describe("DB 접속 URL 정리", () => {
  test("JDBC PostgreSQL URL은 Node pg가 사용할 수 있는 URL로 변환한다", () => {
    expect(normalizePostgresUrl("jdbc:postgresql://192.168.219.125:35432/pdfowers_dev")).toBe(
      "postgresql://192.168.219.125:35432/pdfowers_dev"
    );
  });

  test("DATABASE_URL만 DB 접속 기준으로 사용한다", () => {
    const env = {
      DATABASE_URL: "jdbc:postgresql://devdbusr:secret@192.168.219.125:35432/pdfowers_dev"
    };

    expect(getDatabaseUrl(env)).toBe(
      "postgresql://devdbusr:secret@192.168.219.125:35432/pdfowers_dev"
    );
  });

  test("DATABASE_URL이 없으면 환경별 보조 URL로 대체하지 않는다", () => {
    expect(() =>
      getDatabaseUrl({
        LEGACY_DATABASE_URL: "postgresql://devdbusr:secret@192.168.219.125:35432/pdfowers_dev"
      })
    ).toThrow("DATABASE_URL is required");
  });
});
