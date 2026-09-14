import { createRequire } from 'module';
const require = createRequire('d:/dev/workspace/git.jkoogit/PDFowers/package.json');

const { Pool } = require('pg');
require('dotenv').config({ path: 'd:/dev/workspace/git.jkoogit/PDFowers/.env' });

import { DrizzleAgentRepository } from '../adapters/out/persistence/drizzle-agent-repository.js';
import { LocalDocsScanner } from '../adapters/out/filesystem/local-docs-scanner.js';
import { AgentApplicationService } from '../service/agent-application-service.js';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../../db/schema/index.js';

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pdfowers_dev';
const pool = new Pool({ connectionString: dbUrl });
const db = drizzle(pool, { schema });

import * as path from 'path';

async function syncAndVerifyDocs() {
  try {
    const repository = new DrizzleAgentRepository(db);
    const scanner = new LocalDocsScanner(path.resolve(process.cwd(), 'docs'));
    const service = new AgentApplicationService(repository, scanner);

    console.log('📂 로컬 /docs 마크다운 문서 스캔 및 DB 동기화 시작...');
    const syncRes = await service.syncDocs();
    console.log(`✅ 문서 동기화 완료: 총 반영 건수 = ${syncRes.syncedCount}`);

    console.log('🔍 마크다운 문서 DB 정합성(Consistency) 크로스체크 실행...');
    const verifyRes = await service.verifyDocsConsistency();
    console.log(`📊 정합성 검증 결과: 일치 여부 = ${verifyRes.isConsistent ? '100% 일치 (Consistent)' : '불일치 발생'}`);
    console.log(`   - 총 문서 수: ${verifyRes.totalFiles}개`);
    console.log(`   - DB 누락 문서: ${verifyRes.missingInDb.length}개`);
    console.log(`   - DB 불일치(변경) 문서: ${verifyRes.outdatedInDb.length}개`);

    if (!verifyRes.isConsistent) {
      console.error('누락 목록:', verifyRes.missingInDb);
      console.error('불일치 목록:', verifyRes.outdatedInDb);
      process.exit(1);
    }
  } catch (err: any) {
    console.error('오류 발생:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

syncAndVerifyDocs();
