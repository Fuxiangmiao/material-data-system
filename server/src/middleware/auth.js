const jwt = require('jsonwebtoken');
const config = require('../config');
const { error } = require('../utils/response');

/**
 * JWT 认证中间件
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, '未登录，请先登录', 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    return error(res, '登录已过期，请重新登录', 401);
  }
}

module.exports = { authenticate };
