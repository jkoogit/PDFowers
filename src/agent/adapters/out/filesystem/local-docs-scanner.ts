/**
 * @file local-docs-scanner.ts
 * @description 로컬 파일시스템의 /docs 마크다운 문서를 스캔하고 파싱/해시를 계산하는 아웃바운드 어댑터
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { DocsScannerPort, ScannedDocInfo } from "../../../ports/out/docs-scanner.port.js";

export class LocalDocsScanner implements DocsScannerPort {
  constructor(private readonly rootDocsDir: string) {}

  async scanAllDocs(): Promise<ScannedDocInfo[]> {
    const results: ScannedDocInfo[] = [];
    await this.walkDir(this.rootDocsDir, results);
    return results;
  }

  private async walkDir(dir: string, results: ScannedDocInfo[]): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await this.walkDir(fullPath, results);
        } else if (entry.isFile() && entry.name.endsWith(".md")) {
          const docInfo = await this.parseDocFile(fullPath);
          if (docInfo) {
            results.push(docInfo);
          }
        }
      }
    } catch (err: any) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }
  }

  private async parseDocFile(fullPath: string): Promise<ScannedDocInfo | null> {
    const content = await fs.readFile(fullPath, "utf-8");
    const relativePath = path.relative(path.resolve(this.rootDocsDir, ".."), fullPath).replace(/\\/g, "/");

    // SHA-256 해시 계산
    const hash = crypto.createHash("sha256").update(content, "utf-8").digest("hex");

    // 제목 (첫 번째 H1 추출)
    const h1Match = content.match(/^#\s+(.+)$/m);
    const title = h1Match ? h1Match[1].trim() : path.basename(fullPath, ".md");

    // 카테고리 추출 (docs/03_설계관리/... -> 설계관리)
    const parts = relativePath.split("/");
    let category = "일반";
    if (parts.length > 1) {
      category = parts[1].replace(/^\d+_/, "");
    }

    // 헤딩 목록 추출
    const headingMatches = content.match(/^#{1,6}\s+(.+)$/gm) || [];
    const headings = headingMatches.map((h) => h.replace(/^#+\s+/, "").trim());

    return {
      filePath: relativePath,
      category,
      title,
      contentHash: hash,
      headings,
      docPayload: {
        filePath: relativePath,
        category,
        title,
        headingCount: headings.length,
        sizeBytes: Buffer.byteLength(content, "utf-8")
      }
    };
  }
}
