const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const { sha256 } = require('../utils/hash');

/**
 * 导入数据（执行匹配策略）
 * @param {Array} rows - 解析后的数据行
 * @param {string} module - 模块标识
 * @param {string} username - 操作用户
 */
async function importData(rows, module, username) {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  // 确定 title 字段名
  const titleField = module === 'selection' ? '材质编号' : '物料编号';

  for (const row of rows) {
    const title = row[titleField] || '';
    if (!title) {
      skipped++;
      continue;
    }

    // 按 title 匹配已有记录
    const existing = await db.query(
      'SELECT id, data FROM data_record WHERE module = $1 AND title = $2 LIMIT 1',
      [module, title]
    );

    if (existing.rows.length > 0) {
      // 相同编号 → 合并更新（仅填充空值字段）
      const record = existing.rows[0];
      const merged = { ...record.data };
      let hasChanges = false;

      for (const [key, val] of Object.entries(row)) {
        if (key === titleField) continue;
        if (val !== undefined && val !== null && val !== '') {
          if (!merged[key] || merged[key] === '' || merged[key] === null) {
            merged[key] = val;
            hasChanges = true;
          }
        }
      }

      if (hasChanges) {
        const contentHash = sha256(JSON.stringify({ title, data: merged }));
        await db.query(
          `UPDATE data_record
           SET data = $1, content_hash = $2, _updated_at = NOW(), _updated_by = $3
           WHERE id = $4`,
          [JSON.stringify(merged), contentHash, username, record.id]
        );
        updated++;
      } else {
        skipped++;
      }
    } else {
      // 不同编号 → 新增记录
      const data = { ...row };
      delete data[titleField];

      const id = uuidv4();
      const contentHash = sha256(JSON.stringify({ title, data }));

      await db.query(
        `INSERT INTO data_record (id, title, type, data, content_hash, source, module, _created_at, _created_by, _updated_at, _updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, NOW(), $8)`,
        [id, title, '', JSON.stringify(data), contentHash, 'import', module, username]
      );
      created++;
    }
  }

  return { created, updated, skipped, total: rows.length };
}

module.exports = { importData };
