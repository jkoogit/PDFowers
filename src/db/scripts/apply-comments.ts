/**
 * @file apply-comments.ts
 * @description PostgreSQL 데이터베이스 전체 테이블 및 컬럼에 한글/영문 설명 주석(COMMENT ON)을 등록/갱신하는 실행 스크립트
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { getDatabaseUrl } from '../database-url.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sqlFilePath = path.resolve(__dirname, '../sql/table_column_comments.sql');

async function applyComments(): Promise<void> {
  const connectionString = getDatabaseUrl(process.env);
  const pool = new Pool({ connectionString });

  try {
    console.log('🚀 PostgreSQL 테이블 및 컬럼 한글 주석 적용을 시작합니다...');
    console.log(`📁 SQL 파일 경로: ${sqlFilePath}`);

    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`주석 SQL 파일을 찾을 수 없습니다: ${sqlFilePath}`);
    }

    const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');

    // 트랜잭션 내에서 주석 DDL 일괄 실행
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sqlContent);
      await client.query('COMMIT');
      console.log('✅ 전체 테이블 및 컬럼 주석 DDL 실행 완료');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // 주석 적용 결과 검증 쿼리
    const commentCountRes = await pool.query(`
      SELECT 
        (SELECT COUNT(*) 
         FROM pg_class c 
         JOIN pg_namespace n ON n.oid = c.relnamespace 
         WHERE n.nspname = 'public' 
           AND c.relkind = 'r' 
           AND obj_description(c.oid, 'pg_class') IS NOT NULL) AS table_comment_count,
        (SELECT COUNT(*) 
         FROM pg_description d
         JOIN pg_class c ON c.oid = d.objoid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' 
           AND c.relkind = 'r' 
           AND d.objsubid > 0) AS column_comment_count
    `);

    const { table_comment_count, column_comment_count } = commentCountRes.rows[0];
    console.log(`📊 주석 등록 검증 결과: 테이블 주석 = ${table_comment_count}개, 컬럼 주석 = ${column_comment_count}개`);

    // 대표 테이블 3종 주석 샘플 출력
    const sampleTables = ['user_account', 'harness_session_meta', 'common_code'];
    console.log('\n🔍 [등록된 주석 샘플 확인]');
    for (const tbl of sampleTables) {
      const tblCommentRes = await pool.query(`
        SELECT obj_description(c.oid, 'pg_class') AS tbl_comment
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = $1
      `, [tbl]);

      const colCommentsRes = await pool.query(`
        SELECT 
          a.attname AS col_name,
          col_description(a.attrelid, a.attnum) AS col_comment
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' 
          AND c.relname = $1 
          AND a.attnum > 0 
          AND NOT a.attisdropped
        ORDER BY a.attnum
        LIMIT 4
      `, [tbl]);

      console.log(`\n• 테이블: ${tbl} (${tblCommentRes.rows[0]?.tbl_comment || '주석 없음'})`);
      for (const col of colCommentsRes.rows) {
        console.log(`   - ${col.col_name}: ${col.col_comment}`);
      }
    }

  } catch (error: any) {
    console.error('❌ 주석 등록 중 오류 발생:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyComments();
