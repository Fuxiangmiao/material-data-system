const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');
const { success, error } = require('../utils/response');

router.use(authenticate);
router.use(roleGuard('admin'));

/**
 * DELETE /api/admin/init/:module
 * 清除模块全部数据（含关联附件）
 */
router.delete('/init/:module', async (req, res) => {
  try {
    const { module } = req.params;
    const validModules = ['material', 'selection', 'overseas'];
    if (!validModules.includes(module)) {
      return error(res, '无效的模块标识');
    }

    // 先获取所有记录 ID，清理关联附件
    const idsResult = await db.query(
      'SELECT id FROM data_record WHERE module = $1', [module]
    );
    const recordIds = idsResult.rows.map((r) => r.id);
    if (recordIds.length > 0) {
      await db.query(
        'DELETE FROM record_attachment WHERE record_id = ANY($1)',
        [recordIds]
      );
    }

    const result = await db.query(
      'DELETE FROM data_record WHERE module = $1',
      [module]
    );

    success(res, { deleted: result.rowCount }, `已清除 ${module} 模块全部数据（${result.rowCount} 条）`);
  } catch (err) {
    console.error('数据初始化失败:', err);
    error(res, '操作失败', 500);
  }
});

/**
 * POST /api/admin/init-database
 * 清除模块数据（POST 版本，兼容前端 JSON body）
 */
router.post('/init-database', async (req, res) => {
  try {
    const { module } = req.body;
    const validModules = ['material', 'selection', 'overseas'];
    if (!module || !validModules.includes(module)) {
      return error(res, '无效的模块标识');
    }

    const idsResult = await db.query(
      'SELECT id FROM data_record WHERE module = $1', [module]
    );
    const recordIds = idsResult.rows.map((r) => r.id);
    if (recordIds.length > 0) {
      await db.query(
        'DELETE FROM record_attachment WHERE record_id = ANY($1)',
        [recordIds]
      );
    }

    const result = await db.query(
      'DELETE FROM data_record WHERE module = $1',
      [module]
    );

    success(res, {
      deletedCount: result.rowCount,
    }, `数据库已初始化，共清除 ${result.rowCount} 条记录`);
  } catch (err) {
    console.error('数据初始化失败:', err);
    error(res, '操作失败', 500);
  }
});

/**
 * DELETE /api/admin/conditional-delete
 * 按条件批量删除
 */
router.delete('/conditional-delete', async (req, res) => {
  try {
    const { module, conditions } = req.body;
    if (!module) return error(res, '缺少 module 参数');
    if (!conditions || typeof conditions !== 'object') return error(res, '缺少筛选条件');

    let whereClauses = ['module = $1'];
    let params = [module];
    let paramIndex = 2;

    for (const [key, value] of Object.entries(conditions)) {
      if (value && value.trim()) {
        if (key === 'title') {
          whereClauses.push(`title ILIKE $${paramIndex}`);
        } else {
          whereClauses.push(`data->>'${key.replace(/'/g, "''")}' ILIKE $${paramIndex}`);
        }
        params.push(`%${value.trim()}%`);
        paramIndex++;
      }
    }

    // 先获取要删除的记录 ID
    const idsResult = await db.query(
      `SELECT id FROM data_record WHERE ${whereClauses.join(' AND ')}`,
      params
    );
    const recordIds = idsResult.rows.map((r) => r.id);

    if (recordIds.length > 0) {
      await db.query(
        'DELETE FROM record_attachment WHERE record_id = ANY($1)',
        [recordIds]
      );
    }

    const result = await db.query(
      `DELETE FROM data_record WHERE ${whereClauses.join(' AND ')}`,
      params
    );

    success(res, { deleted: result.rowCount }, `条件删除完成（${result.rowCount} 条）`);
  } catch (err) {
    console.error('条件删除失败:', err);
    error(res, '操作失败', 500);
  }
});

module.exports = router;
