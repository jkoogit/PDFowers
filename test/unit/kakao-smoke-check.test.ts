import { describe, expect, test, vi } from "vitest";
import { checkKakaoDeployment } from "../../src/review/kakao-smoke-check.js";

describe("Kakao deployment smoke check", () => {
  test("config-status와 start redirect가 모두 정상이면 통과한다", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            enabled: true,
            missing: [],
            redirectUri: "https://jkok2.myqnapcloud.com:4443/auth/kakao/callback"
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: {
            location: "https://kauth.kakao.com/oauth/authorize?client_id=rest-api-key"
          }
        })
      );

    const result = await checkKakaoDeployment("https://jkok2.myqnapcloud.com:4443", fetchMock);

    expect(result.ok).toBe(true);
    expect(result.baseUrl).toBe("https://jkok2.myqnapcloud.com:4443");
    expect(result.redirectUri).toBe("https://jkok2.myqnapcloud.com:4443/auth/kakao/callback");
    expect(result.checks).toEqual([
      { name: "config-status", ok: true },
      { name: "kakao-start-redirect", ok: true }
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://jkok2.myqnapcloud.com:4443/auth/kakao/start",
      { redirect: "manual" }
    );
  });

  test("Kakao 설정이 비활성 상태면 누락 항목을 실패 결과로 반환한다", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          enabled: false,
          missing: ["KAKAO_REST_API_KEY"],
          redirectUri: null
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const result = await checkKakaoDeployment("https://jkok2.myqnapcloud.com:4443", fetchMock);

    expect(result.ok).toBe(false);
    expect(result.checks).toEqual([
      {
        name: "config-status",
        ok: false,
        message: "Kakao OAuth disabled: KAKAO_REST_API_KEY"
      }
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("서비스에 연결할 수 없으면 네트워크 실패 결과를 반환한다", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError("fetch failed"));

    const result = await checkKakaoDeployment("https://jkok2.myqnapcloud.com:4443", fetchMock);

    expect(result).toEqual({
      ok: false,
      baseUrl: "https://jkok2.myqnapcloud.com:4443",
      redirectUri: null,
      checks: [
        {
          name: "config-status",
          ok: false,
          message: "network error: fetch failed"
        }
      ]
    });
  });
});
