const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { sha256 } = require('../utils/hash');
const { authenticate } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');
const { success, error } = require('../utils/response');

router.use(authenticate);
router.use(roleGuard('admin'));

/**
 * GET /api/users
 * 用户列表
 */
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, username, display_name, role, initial_password, password_hash, _created_at FROM app_account ORDER BY _created_at'
    );
    // 标记密码是否已修改（对比初始密码的 hash）
    const users = result.rows.map((u) => ({
      ...u,
      passwordChanged: u.password_hash !== sha256(u.initial_password || '123456'),
      password_hash: undefined, // 不暴露 hash
    }));
    success(res, users);
  } catch (err) {
    console.error('获取用户列表失败:', err);
    error(res, '服务器错误', 500);
  }
});

/**
 * POST /api/users
 * 新增用户
 */
router.post('/', async (req, res) => {
  try {
    const { username, displayName, role, initialPassword = '123456' } = req.body;
    if (!username || !role) return error(res, '用户名和角色为必填项');

    // 检查用户名是否已存在
    const existing = await db.query('SELECT id FROM app_account WHERE username = $1', [username]);
    if (existing.rows.length > 0) return error(res, '用户名已存在');

    const passwordHash = sha256(initialPassword);
    const id = uuidv4();

    const result = await db.query(
      `INSERT INTO app_account (id, username, password_hash, initial_password, display_name, role, _created_at, _created_by)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
       RETURNING id, username, display_name, role`,
      [id, username, passwordHash, initialPassword, displayName || username, role, req.user.username]
    );

    success(res, result.rows[0], '用户创建成功');
  } catch (err) {
    console.error('创建用户失败:', err);
    error(res, '创建失败', 500);
  }
});

/**
 * PUT /api/users/:id
 * 更新用户
 */
router.put('/:id', async (req, res) => {
  try {
    const { displayName, role } = req.body;
    const result = await db.query(
      `UPDATE app_account SET display_name = COALESCE($1, display_name), role = COALESCE($2, role)
       WHERE id = $3 RETURNING id, username, display_name, role`,
      [displayName, role, req.params.id]
    );
    if (result.rows.length === 0) return error(res, '用户不存在', 404);
    success(res, result.rows[0], '更新成功');
  } catch (err) {
    console.error('更新用户失败:', err);
    error(res, '更新失败', 500);
  }
});

/**
 * DELETE /api/users/:id
 * 删除用户
 */
router.delete('/:id', async (req, res) => {
  try {
    if (req.params.id === req.user.id) return error(res, '不能删除自己');
    const result = await db.query('DELETE FROM app_account WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return error(res, '用户不存在', 404);
    success(res, null, '删除成功');
  } catch (err) {
    console.error('删除用户失败:', err);
    error(res, '删除失败', 500);
  }
});

/**
 * POST /api/users/:id/reset-password
 * 重置用户密码
 */
router.post('/:id/reset-password', async (req, res) => {
  try {
    const user = await db.query('SELECT initial_password FROM app_account WHERE id = $1', [req.params.id]);
    if (user.rows.length === 0) return error(res, '用户不存在', 404);

    const initialPassword = user.rows[0].initial_password || '123456';
    const passwordHash = sha256(initialPassword);

    await db.query('UPDATE app_account SET password_hash = $1 WHERE id = $2', [passwordHash, req.params.id]);
    success(res, null, '密码已重置');
  } catch (err) {
    console.error('重置密码失败:', err);
    error(res, '操作失败', 500);
  }
});

module.exports = router;
