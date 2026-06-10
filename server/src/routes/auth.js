const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const db = require('../db');
const config = require('../config');
const { sha256, verifyPassword } = require('../utils/hash');
const { success, error } = require('../utils/response');

/**
 * POST /api/auth/login
 * 用户登录
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return error(res, '请输入用户名和密码');
    }

    const result = await db.query(
      'SELECT * FROM app_account WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return error(res, '用户名或密码错误');
    }

    const user = result.rows[0];
    if (!verifyPassword(password, user.password_hash)) {
      return error(res, '用户名或密码错误');
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: user.role,
      },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    success(res, {
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('登录失败:', err);
    error(res, '服务器错误', 500);
  }
});

/**
 * POST /api/auth/reset-password
 * 重置密码为初始密码
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return error(res, '请输入用户名');
    }

    const result = await db.query(
      'SELECT * FROM app_account WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return error(res, '用户不存在');
    }

    const user = result.rows[0];
    const initialPassword = user.initial_password || '123456';
    const passwordHash = sha256(initialPassword);

    await db.query(
      'UPDATE app_account SET password_hash = $1 WHERE id = $2',
      [passwordHash, user.id]
    );

    success(res, null, '密码已重置为初始密码');
  } catch (err) {
    console.error('重置密码失败:', err);
    error(res, '服务器错误', 500);
  }
});

/**
 * GET /api/auth/me
 * 获取当前用户信息（验证 token）
 */
router.get('/me', require('../middleware/auth').authenticate, async (req, res) => {
  success(res, req.user);
});

/**
 * POST /api/auth/verify-password
 * 验证密码（用于敏感操作前的二次确认）
 */
router.post('/verify-password', require('../middleware/auth').authenticate, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return error(res, '请输入密码');
    }

    const result = await db.query(
      'SELECT password_hash FROM app_account WHERE username = $1',
      [req.user.username]
    );

    if (result.rows.length === 0) {
      return error(res, '用户不存在');
    }

    if (!verifyPassword(password, result.rows[0].password_hash)) {
      return error(res, '密码错误');
    }

    success(res, null, '密码验证通过');
  } catch (err) {
    console.error('密码验证失败:', err);
    error(res, '服务器错误', 500);
  }
});

/**
 * POST /api/auth/change-password
 * 修改密码
 */
router.post('/change-password', require('../middleware/auth').authenticate, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return error(res, '请输入旧密码和新密码');
    }
    if (newPassword.length < 4) {
      return error(res, '新密码至少4位');
    }

    const result = await db.query(
      'SELECT password_hash FROM app_account WHERE username = $1',
      [req.user.username]
    );

    if (result.rows.length === 0) {
      return error(res, '用户不存在');
    }

    if (!verifyPassword(oldPassword, result.rows[0].password_hash)) {
      return error(res, '旧密码错误');
    }

    const newHash = sha256(newPassword);
    await db.query(
      'UPDATE app_account SET password_hash = $1 WHERE username = $2',
      [newHash, req.user.username]
    );

    success(res, null, '密码修改成功');
  } catch (err) {
    console.error('修改密码失败:', err);
    error(res, '服务器错误', 500);
  }
});

module.exports = router;
