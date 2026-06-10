const { error } = require('../utils/response');

/**
 * 角色权限拦截中间件
 * @param  {...string} allowedRoles - 允许的角色列表
 */
function roleGuard(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return error(res, '未登录', 401);
    }
    if (!allowedRoles.includes(req.user.role)) {
      return error(res, '权限不足，无法执行此操作', 403);
    }
    next();
  };
}

module.exports = { roleGuard };
