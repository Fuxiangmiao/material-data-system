/**
 * 统一响应格式
 */

function success(res, data = null, message = '操作成功') {
  return res.json({ success: true, message, data });
}

function error(res, message = '操作失败', statusCode = 400) {
  return res.status(statusCode).json({ success: false, message });
}

function paginated(res, data, total, page, pageSize) {
  return res.json({
    success: true,
    data,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}

module.exports = { success, error, paginated };
