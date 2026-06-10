const express = require('express');
const router = express.Router();
const db = require('../db');
const { success, error } = require('../utils/response');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

/**
 * 构建通用 WHERE 条件片段
 */
function buildWhere(module, keyword, fieldFilters) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (module) {
    conditions.push(`module = $${idx}`);
    params.push(module);
    idx++;
  }

  // 多关键词 AND 搜索（空格分隔）
  if (keyword && keyword.trim()) {
    const keywords = keyword.trim().split(/\s+/).filter(Boolean);
    for (const kw of keywords) {
      conditions.push(
        `(title ILIKE $${idx} OR type ILIKE $${idx} OR source ILIKE $${idx} OR data::text ILIKE $${idx})`
      );
      params.push(`%${kw}%`);
      idx++;
    }
  }

  // 字段级过滤
  if (fieldFilters && typeof fieldFilters === 'object') {
    for (const [key, val] of Object.entries(fieldFilters)) {
      if (val && val.trim()) {
        conditions.push(`data->>'${key.replace(/'/g, "''")}' ILIKE $${idx}`);
        params.push(`%${val.trim()}%`);
        idx++;
      }
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereClause, params, idx };
}

/**
 * GET /api/statistics
 * 聚合统计：总数、type 分布、source 分布、已更新数
 */
router.get('/', async (req, res) => {
  try {
    const { module, keyword, fieldFilters: ffStr } = req.query;
    let fieldFilters;
    if (ffStr) {
      try { fieldFilters = JSON.parse(ffStr); } catch { fieldFilters = {}; }
    }

    const { whereClause, params } = buildWhere(module, keyword, fieldFilters);

    // 总数
    const totalResult = await db.query(
      `SELECT COUNT(*) FROM data_record ${whereClause}`, params
    );
    const totalCount = parseInt(totalResult.rows[0].count);

    // type 分布
    const typeResult = await db.query(
      `SELECT type, COUNT(*)::int as count FROM data_record ${whereClause} GROUP BY type ORDER BY count DESC`,
      params
    );
    const typeDistribution = {};
    typeResult.rows.forEach((r) => { typeDistribution[r.type || '(空)'] = r.count; });

    // source 分布
    const sourceResult = await db.query(
      `SELECT source, COUNT(*)::int as count FROM data_record ${whereClause} GROUP BY source ORDER BY count DESC`,
      params
    );
    const sourceDistribution = {};
    sourceResult.rows.forEach((r) => { sourceDistribution[r.source || '(空)'] = r.count; });

    // 已更新数（有 content_hash 的记录）
    const updatedWhere = whereClause
      ? `${whereClause} AND content_hash IS NOT NULL AND content_hash != ''`
      : `WHERE content_hash IS NOT NULL AND content_hash != ''`;
    const updatedResult = await db.query(
      `SELECT COUNT(*) FROM data_record ${updatedWhere}`, params
    );
    const updatedCount = parseInt(updatedResult.rows[0].count);

    success(res, { totalCount, typeDistribution, sourceDistribution, updatedCount });
  } catch (err) {
    console.error('获取统计失败:', err);
    error(res, '获取统计失败', 500);
  }
});

/**
 * GET /api/statistics/field-values
 * 每个字段的去重值（最多200个），用于搜索表单下拉
 */
router.get('/field-values', async (req, res) => {
  try {
    const { module } = req.query;
    const moduleWhere = module ? 'WHERE module = $1' : '';
    const moduleParams = module ? [module] : [];

    const result = await db.query(
      `SELECT data FROM data_record ${moduleWhere}`, moduleParams
    );

    const valueMap = {};
    for (const row of result.rows) {
      const data = row.data;
      if (data && typeof data === 'object') {
        for (const [key, val] of Object.entries(data)) {
          if (val == null) continue;
          const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
          if (!strVal.trim()) continue;
          if (!valueMap[key]) valueMap[key] = new Set();
          if (valueMap[key].size < 200) valueMap[key].add(strVal);
        }
      }
    }

    const fieldValues = {};
    for (const [key, set] of Object.entries(valueMap)) {
      fieldValues[key] = Array.from(set).sort();
    }

    success(res, fieldValues);
  } catch (err) {
    console.error('获取字段值失败:', err);
    error(res, '获取字段值失败', 500);
  }
});

module.exports = router;
module.exports.buildWhere = buildWhere;
