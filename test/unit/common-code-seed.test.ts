import { describe, expect, test } from "vitest";
import { getInitialCommonCodes } from "../../src/db/seed/common-codes.js";

describe("시스템 공통코드 seed", () => {
  test("DB 관리이력의 MVP1 공통코드 후보 27건을 재구축 가능한 seed로 제공한다", () => {
    const codes = getInitialCommonCodes();

    expect(codes).toHaveLength(27);
    expect(codes).toContainEqual(
      expect.objectContaining({
        codeGroupCd: "AUTH_PROVIDER",
        codeCd: "kakao",
        codeLabel: "카카오",
        sortOrder: 10,
        isActive: true
      })
    );
    expect(codes).toContainEqual(
      expect.objectContaining({
        codeGroupCd: "AUDIT_EVENT_TYPE",
        codeCd: "ACCOUNT_MERGED",
        codeLabel: "계정 통합됨",
        sortOrder: 100,
        isActive: true
      })
    );
  });

  test("공통코드는 그룹과 코드값 조합이 중복되지 않고 그룹별 정렬 순서가 안정적이다", () => {
    const codes = getInitialCommonCodes();
    const uniqueKeys = new Set(codes.map((code) => `${code.codeGroupCd}:${code.codeCd}`));

    expect(uniqueKeys.size).toBe(codes.length);

    for (const group of new Set(codes.map((code) => code.codeGroupCd))) {
      const groupCodes = codes.filter((code) => code.codeGroupCd === group);
      const sorted = [...groupCodes].sort((a, b) => a.sortOrder - b.sortOrder);

      expect(groupCodes).toEqual(sorted);
    }
  });
});
