const express = require('express');
const router = express.Router();
const db = require('../db');
const { success, error, paginated } = require('../utils/response');
const { authenticate } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');
const { sha256, verifyPassword } = require('../utils/hash');
const { v4: uuidv4 } = require('uuid');

// 所有接口需要登录
router.use(authenticate);

/**
 * GET /api/records
 * 分页搜索数据记录（支持多关键词 AND + 字段级过滤）
 */
router.get('/', async (req, res) => {
  try {
    const {
      module,
      search,
      sortField,
      sortOrder = 'asc',
      page = 1,
      pageSize = 50,
      fieldFilters: ffStr,
    } = req.query;

    if (!module) {
      return error(res, '缺少 module 参数');
    }

    let fieldFilters;
    if (ffStr) {
      try { fieldFilters = JSON.parse(ffStr); } catch { fieldFilters = {}; }
    }

    let conditions = ['module = $1'];
    let params = [module];
    let paramIndex = 2;

    // 多关键词 AND 搜索
    if (search && search.trim()) {
      const keywords = search.trim().split(/\s+/).filter(Boolean);
      for (const kw of keywords) {
        conditions.push(
          `(title ILIKE $${paramIndex} OR type ILIKE $${paramIndex} OR source ILIKE $${paramIndex} OR data::text ILIKE $${paramIndex})`
        );
        params.push(`%${kw}%`);
        paramIndex++;
      }
    }

    // 字段级过滤
    if (fieldFilters && typeof fieldFilters === 'object') {
      for (const [key, val] of Object.entries(fieldFilters)) {
        if (val && val.trim()) {
          conditions.push(`data->>'${key.replace(/'/g, "''")}' ILIKE $${paramIndex}`);
          params.push(`%${val.trim()}%`);
          paramIndex++;
        }
      }
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    let orderBy = 'ORDER BY _created_at DESC';
    if (sortField) {
      if (sortField === 'title') {
        orderBy = `ORDER BY title ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
      } else {
        orderBy = `ORDER BY data->>'${sortField.replace(/'/g, "''")}' ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
      }
    }

    const countResult = await db.query(
      `SELECT COUNT(*) FROM data_record ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    const dataParams = [...params, parseInt(pageSize), offset];
    const dataResult = await db.query(
      `SELECT * FROM data_record ${whereClause} ${orderBy} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      dataParams
    );

    paginated(res, dataResult.rows, total, parseInt(page), parseInt(pageSize));
  } catch (err) {
    console.error('查询记录失败:', err);
    error(res, '查询失败', 500);
  }
});

/**
 * GET /api/records/fields/:module
 * 获取模块所有字段名（从 jsonb 动态提取）
 * ⚠️ 必须在 /:id 之前定义
 */
router.get('/fields/:module', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT DISTINCT jsonb_object_keys(data) as field
       FROM data_record
       WHERE module = $1
       ORDER BY field`,
      [req.params.module]
    );
    const fields = result.rows.map((r) => r.field);
    success(res, fields);
  } catch (err) {
    console.error('获取字段失败:', err);
    error(res, '服务器错误', 500);
  }
});

/**
 * GET /api/records/search-ref
 * 搜索引用接口（用于录入时引用已有数据）
 * ⚠️ 必须在 /:id 之前定义
 */
router.get('/search-ref', async (req, res) => {
  try {
    const { module, keyword } = req.query;
    if (!module || !keyword) {
      return error(res, '缺少参数');
    }

    const result = await db.query(
      `SELECT id, title, data FROM data_record
       WHERE module = $1 AND (title ILIKE $2 OR data::text ILIKE $2)
       ORDER BY _updated_at DESC
       LIMIT 20`,
      [module, `%${keyword}%`]
    );

    success(res, result.rows);
  } catch (err) {
    console.error('搜索引用失败:', err);
    error(res, '服务器错误', 500);
  }
});

/**
 * POST /api/records/batch-delete
 * 批量删除（需密码验证）
 * ⚠️ 必须在 /:id 之前定义
 */
router.post('/batch-delete', roleGuard('admin', 'user'), async (req, res) => {
  try {
    const { ids, password } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return error(res, '请选择要删除的记录');
    }

    // 密码验证
    if (password) {
      const userResult = await db.query(
        'SELECT password_hash FROM app_account WHERE username = $1',
        [req.user.username]
      );
      if (userResult.rows.length === 0 || !verifyPassword(password, userResult.rows[0].password_hash)) {
        return error(res, '密码验证失败', 403);
      }
    }

    // 先删除关联附件
    await db.query(
      'DELETE FROM record_attachment WHERE record_id = ANY($1)',
      [ids]
    );

    const result = await db.query(
      `DELETE FROM data_record WHERE id = ANY($1) RETURNING id`,
      [ids]
    );

    success(res, { deleted: result.rows.length }, `成功删除 ${result.rows.length} 条记录`);
  } catch (err) {
    console.error('批量删除失败:', err);
    error(res, '删除失败', 500);
  }
});

/**
 * GET /api/records/all-for-export
 * 无分页导出全部匹配记录
 */
router.get('/all-for-export', async (req, res) => {
  try {
    const { module, search } = req.query;

    let conditions = [];
    let params = [];
    let paramIndex = 1;

    if (module) {
      conditions.push(`module = $${paramIndex}`);
      params.push(module);
      paramIndex++;
    }

    if (search && search.trim()) {
      const keywords = search.trim().split(/\s+/).filter(Boolean);
      for (const kw of keywords) {
        conditions.push(
          `(title ILIKE $${paramIndex} OR type ILIKE $${paramIndex} OR source ILIKE $${paramIndex} OR data::text ILIKE $${paramIndex})`
        );
        params.push(`%${kw}%`);
        paramIndex++;
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await db.query(
      `SELECT id, title, type, data, source, module, _created_at FROM data_record ${whereClause} ORDER BY _created_at DESC`,
      params
    );

    success(res, result.rows);
  } catch (err) {
    console.error('导出查询失败:', err);
    error(res, '导出查询失败', 500);
  }
});

/**
 * POST /api/records/delete-by-filter
 * 按 type/source/keyword 条件批量删除
 */
router.post('/delete-by-filter', roleGuard('admin'), async (req, res) => {
  try {
    const { module, type, source, keyword } = req.body;
    if (!module) return error(res, '缺少 module 参数');

    let conditions = ['module = $1'];
    let params = [module];
    let paramIndex = 2;

    if (type) {
      conditions.push(`type = $${paramIndex}`);
      params.push(type);
      paramIndex++;
    }
    if (source) {
      conditions.push(`source = $${paramIndex}`);
      params.push(source);
      paramIndex++;
    }
    if (keyword && keyword.trim()) {
      const keywords = keyword.trim().split(/\s+/).filter(Boolean);
      for (const kw of keywords) {
        conditions.push(
          `(title ILIKE $${paramIndex} OR data::text ILIKE $${paramIndex})`
        );
        params.push(`%${kw}%`);
        paramIndex++;
      }
    }

    if (conditions.length <= 1) {
      return error(res, '请至少指定一个筛选条件');
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // 先获取要删除的 ID
    const idsResult = await db.query(
      `SELECT id FROM data_record ${whereClause}`, params
    );
    const recordIds = idsResult.rows.map((r) => r.id);

    if (recordIds.length === 0) {
      return success(res, { deleted: 0 }, '无匹配记录');
    }

    // 清理关联附件
    await db.query(
      'DELETE FROM record_attachment WHERE record_id = ANY($1)',
      [recordIds]
    );

    const result = await db.query(
      `DELETE FROM data_record WHERE id = ANY($1)`,
      [recordIds]
    );

    success(res, { deleted: recordIds.length }, `成功删除 ${recordIds.length} 条记录`);
  } catch (err) {
    console.error('条件删除失败:', err);
    error(res, '条件删除失败', 500);
  }
});

/**
 * GET /api/records/:id
 * 获取单条记录详情
 * ⚠️ 动态路由放在所有静态路由之后
 */
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM data_record WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return error(res, '记录不存在', 404);
    }
    success(res, result.rows[0]);
  } catch (err) {
    console.error('获取详情失败:', err);
    error(res, '服务器错误', 500);
  }
});

/**
 * POST /api/records
 * 新增/更新记录（同 title 时 upsert 合并数据）
 */
router.post('/', roleGuard('admin', 'user'), async (req, res) => {
  try {
    const { title, type, data, source, module } = req.body;

    if (!module) {
      return error(res, '缺少 module 参数');
    }

    // 检查是否已有相同 title 的记录 → upsert
    const existing = await db.query(
      'SELECT id, data FROM data_record WHERE title = $1 AND module = $2 LIMIT 1',
      [title || '', module]
    );

    if (existing.rows.length > 0) {
      const existingRow = existing.rows[0];
      const existingData = existingRow.data || {};
      const newData = data || {};

      // 检查数据是否完全相同
      const allKeys = new Set([...Object.keys(existingData), ...Object.keys(newData)]);
      let isIdentical = true;
      for (const key of allKeys) {
        const existingVal = String(existingData[key] ?? '').trim();
        const newVal = String(newData[key] ?? '').trim();
        if (existingVal !== newVal) { isIdentical = false; break; }
      }

      if (isIdentical) {
        return success(res, { id: existingRow.id }, '数据完全相同，已跳过');
      }

      // 合并数据
      const mergedData = { ...existingData, ...newData };
      const contentHash = sha256(JSON.stringify({ title, data: mergedData }));

      const result = await db.query(
        `UPDATE data_record
         SET data = $1, content_hash = $2, type = COALESCE($3, type), source = COALESCE($4, source),
             _updated_at = NOW(), _updated_by = $5
         WHERE id = $6
         RETURNING *`,
        [JSON.stringify(mergedData), contentHash, type, source, req.user.username, existingRow.id]
      );

      return success(res, result.rows[0], '数据已更新，相同物料编号数据已合并');
    }

    // 新增
    const id = uuidv4();
    const contentHash = sha256(JSON.stringify({ title, data }));

    const result = await db.query(
      `INSERT INTO data_record (id, title, type, data, content_hash, source, module, _created_at, _created_by, _updated_at, _updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, NOW(), $8)
       RETURNING *`,
      [id, title || '', type || '', JSON.stringify(data || {}), contentHash, source || 'manual', module, req.user.username]
    );

    success(res, result.rows[0], '创建成功');
  } catch (err) {
    console.error('创建记录失败:', err);
    error(res, '创建失败', 500);
  }
});

/**
 * PUT /api/records/:id
 * 更新记录
 */
router.put('/:id', roleGuard('admin', 'user'), async (req, res) => {
  try {
    const { title, type, data, source } = req.body;
    const contentHash = sha256(
      JSON.stringify({ title, data })
    );

    const result = await db.query(
      `UPDATE data_record
       SET title = COALESCE($1, title),
           type = COALESCE($2, type),
           data = COALESCE($3, data),
           content_hash = $4,
           source = COALESCE($5, source),
           _updated_at = NOW(),
           _updated_by = $6
       WHERE id = $7
       RETURNING *`,
      [title, type, JSON.stringify(data), contentHash, source, req.user.username, req.params.id]
    );

    if (result.rows.length === 0) {
      return error(res, '记录不存在', 404);
    }

    success(res, result.rows[0], '更新成功');
  } catch (err) {
    console.error('更新记录失败:', err);
    error(res, '更新失败', 500);
  }
});

/**
 * DELETE /api/records/:id
 * 删除单条记录
 */
router.delete('/:id', roleGuard('admin', 'user'), async (req, res) => {
  try {
    // 先清理关联附件
    await db.query(
      'DELETE FROM record_attachment WHERE record_id = $1',
      [req.params.id]
    );

    const result = await db.query(
      'DELETE FROM data_record WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return error(res, '记录不存在', 404);
    }

    success(res, null, '删除成功');
  } catch (err) {
    console.error('删除记录失败:', err);
    error(res, '删除失败', 500);
  }
});

module.exports = router;
