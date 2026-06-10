const express = require('express');
const router = express.Router();
const db = require('../db');
const { success, error } = require('../utils/response');
const { authenticate } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');

router.use(authenticate);

/**
 * POST /api/compare-import
 * 批量检查 titles 是否已存在于 DB（导入前对比）
 */
router.post('/', roleGuard('admin', 'user'), async (req, res) => {
  try {
    const { titles, module } = req.body;
    if (!titles || !Array.isArray(titles) || titles.length === 0) {
      return error(res, '缺少 titles 参数');
    }

    const uniqueTitles = [...new Set(titles.filter(Boolean))];
    if (uniqueTitles.length === 0) {
      return success(res, { existingRecords: [] });
    }

    let query = 'SELECT title, data FROM data_record WHERE title = ANY($1)';
    const params = [uniqueTitles];
    if (module) {
      query += ' AND module = $2';
      params.push(module);
    }

    const result = await db.query(query, params);
    const existingRecords = result.rows.map((r) => ({
      title: r.title,
      data: r.data || {},
    }));

    success(res, { existingRecords });
  } catch (err) {
    console.error('导入对比失败:', err);
    error(res, '导入对比失败', 500);
  }
});

/**
 * POST /api/compare-import/match-and-fill
 * 匹配上传行与 DB 记录，填充空单元格
 */
router.post('/match-and-fill', roleGuard('admin', 'user'), async (req, res) => {
  try {
    const { records, module } = req.body;
    if (!records || !Array.isArray(records) || records.length === 0) {
      return success(res, { matchedCount: 0, unmatchedCount: 0, records: [] });
    }

    // 提取所有物料编号
    const titles = records
      .map((r) => r['物料编号'])
      .filter(Boolean);

    if (titles.length === 0) {
      return success(res, { matchedCount: 0, unmatchedCount: records.length, records });
    }

    let query = 'SELECT title, data FROM data_record WHERE title = ANY($1)';
    const params = [titles];
    if (module) {
      query += ' AND module = $2';
      params.push(module);
    }

    const result = await db.query(query, params);
    const dbMap = new Map();
    result.rows.forEach((r) => dbMap.set(r.title, r.data || {}));

    let matchedCount = 0;
    const filledRecords = records.map((row) => {
      const code = row['物料编号'];
      if (!code) return row;

      const dbData = dbMap.get(code);
      if (!dbData) return row;

      const filled = { ...row };
      let hasFill = false;
      // 仅填充上传文件中已有的空列，不添加新列
      for (const key of Object.keys(filled)) {
        const currentVal = filled[key] || '';
        const dbVal = dbData[key];
        if ((!currentVal || String(currentVal).trim() === '') && dbVal && String(dbVal).trim() !== '') {
          filled[key] = String(dbVal);
          hasFill = true;
        }
      }
      if (hasFill) matchedCount++;
      return filled;
    });

    success(res, {
      matchedCount,
      unmatchedCount: records.length - matchedCount,
      records: filledRecords,
    });
  } catch (err) {
    console.error('匹配填充失败:', err);
    error(res, '匹配填充失败', 500);
  }
});

module.exports = router;
