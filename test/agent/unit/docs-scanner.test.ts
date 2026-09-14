/**
 * @file docs-scanner.test.ts
 * @description 마크다운 문서 스캐너 및 동기화/크로스체크 테스트
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as path from "node:path";
import { LocalDocsScanner } from "../../../src/agent/adapters/out/filesystem/local-docs-scanner.js";
import { MemoryAgentRepository } from "../../../src/agent/adapters/out/persistence/memory-agent-repository.js";
import { AgentApplicationService } from "../../../src/agent/service/agent-application-service.js";

describe("LocalDocsScanner & Docs Sync - 문서 동기화 및 크로스체크", () => {
  const docsDir = path.resolve(process.cwd(), "docs");
  let scanner: LocalDocsScanner;
  let repository: MemoryAgentRepository;
  let service: AgentApplicationService;

  beforeEach(() => {
    scanner = new LocalDocsScanner(docsDir);
    repository = new MemoryAgentRepository();
    service = new AgentApplicationService(repository, scanner);
  });

  it("로컬 /docs 디렉토리의 모든 마크다운 파일을 스캔하여 H1 제목과 SHA-256 해시를 정상 추출해야 한다", async () => {
    const docs = await scanner.scanAllDocs();
    expect(docs.length).toBeGreaterThan(10); // 10개 이상의 문서가 존재

    const readmeDoc = docs.find((d) => d.filePath === "docs/README.md");
    expect(readmeDoc).toBeDefined();
    expect(readmeDoc?.title).toContain("PDFowers");
    expect(readmeDoc?.contentHash).toHaveLength(64); // SHA-256 64자리 hex
  });

  it("syncDocs() 호출 시 모든 스캔 문서가 DB(Repository)에 정상 현행화되어야 한다", async () => {
    const syncResult = await service.syncDocs("tester");
    expect(syncResult.syncedCount).toBeGreaterThan(10);

    const dbDocs = await repository.findAllDocsMeta();
    expect(dbDocs.length).toBe(syncResult.syncedCount);
  });

  it("동기화 완료 후 verifyDocsConsistency() 크로스체크 시 정합성이 100% 일치해야 한다", async () => {
    await service.syncDocs("tester");

    const verifyResult = await service.verifyDocsConsistency();
    expect(verifyResult.isConsistent).toBe(true);
    expect(verifyResult.missingInDb.length).toBe(0);
    expect(verifyResult.outdatedInDb.length).toBe(0);
  });
});
