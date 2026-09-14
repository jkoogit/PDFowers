/**
 * @file docs-scanner.port.ts
 * @description 파일시스템 마크다운 문서 스캔 및 해시 계산 아웃바운드 포트
 */

export interface ScannedDocInfo {
  filePath: string;
  category: string;
  title: string;
  contentHash: string;
  headings: string[];
  docPayload: any;
}

export interface DocsScannerPort {
  scanAllDocs(): Promise<ScannedDocInfo[]>;
}
