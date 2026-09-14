import { Pool } from 'pg';
import 'dotenv/config';
import { getDatabaseUrl } from '../../db/database-url.js';

const pool = new Pool({ connectionString: getDatabaseUrl(process.env) });

async function syncActualState() {
  try {
    // 1. 임의 루프 레코드 삭제
    await pool.query("DELETE FROM harness_loop_meta WHERE loop_id = 'LP-20260915-01'");
    console.log('✅ 임의 루프 레코드(LP-20260915-01) 삭제 완료');

    // 2. 태스크 doc_payload의 loopList 정리
    const taskRes = await pool.query("SELECT doc_payload FROM harness_task_meta WHERE task_id = 'TSK-20260915-01'");
    if (taskRes.rows.length > 0) {
      const payload = taskRes.rows[0].doc_payload;
      payload.loopList = [];
      await pool.query("UPDATE harness_task_meta SET doc_payload = $1 WHERE task_id = 'TSK-20260915-01'", [JSON.stringify(payload)]);
      console.log('✅ 태스크(TSK-20260915-01) 루프 목록 빈 배열 현행화 완료');
    }

    // 3. 현재 DB 테이블 카운트 확인
    const s = await pool.query('SELECT COUNT(*) FROM harness_session_meta');
    const t = await pool.query('SELECT COUNT(*) FROM harness_task_meta');
    const l = await pool.query('SELECT COUNT(*) FROM harness_loop_meta');
    const d = await pool.query('SELECT COUNT(*) FROM agent_docs_meta');
    const tr = await pool.query('SELECT COUNT(*) FROM agent_conversation_trace');
    console.log(`📊 DB 현행화 완료: 세션=${s.rows[0].count}, 태스크=${t.rows[0].count}, 루프=${l.rows[0].count}, 문서=${d.rows[0].count}, 감사로그=${tr.rows[0].count}`);
  } catch (e: any) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

syncActualState();
