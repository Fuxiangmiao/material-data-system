const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');
const { success, error } = require('../utils/response');

router.use(authenticate);

/**
 * POST /api/compare
 * 多记录横向对比（返回 commonKeys + differences）
 */
router.post('/', roleGuard('admin', 'user'), async (req, res) => {
  try {
    const { ids, module } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length < 2) {
      return error(res, '请至少选择2条记录进行比对');
    }

    let query = 'SELECT id, title, type, data, source, module FROM data_record WHERE id = ANY($1)';
    const params = [ids];
    if (module) {
      query += ' AND module = $2';
      params.push(module);
    }

    const result = await db.query(query, params);

    if (result.rows.length < 2) {
      return error(res, '有效记录不足2条');
    }

    const records = result.rows.map((r) => ({
      id: r.id,
      title: r.title,
      type: r.type,
      data: r.data || {},
      source: r.source,
      module: r.module || 'material',
      createdAt: r._created_at?.toISOString?.() || r._created_at,
    }));

    // 找出所有记录的公共字段
    const dataKeySets = result.rows.map((r) => {
      const d = r.data || {};
      return Object.keys(d);
    });
    const commonKeys = dataKeySets.reduce(
      (acc, keys) => acc.filter((k) => keys.includes(k)),
      dataKeySets[0] || []
    ).sort();

    // 比较每个公共字段的值
    const differences = [];
    for (const key of commonKeys) {
      const values = {};
      for (const row of result.rows) {
        const d = row.data || {};
        values[row.id] = d[key] !== undefined ? String(d[key]) : '';
      }
      const uniqueVals = new Set(Object.values(values));
      if (uniqueVals.size > 1) {
        differences.push({ key, values });
      }
    }

    success(res, { commonKeys, differences, records });
  } catch (err) {
    console.error('比对失败:', err);
    error(res, '比对失败', 500);
  }
});

module.exports = router;
