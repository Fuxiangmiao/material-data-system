const crypto = require('crypto');

/**
 * SHA-256 哈希
 */
function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * 验证密码
 */
function verifyPassword(password, hash) {
  return sha256(password) === hash;
}

module.exports = { sha256, verifyPassword };
