const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const config = require('../config');
const { authenticate } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');
const { success, error } = require('../utils/response');

router.use(authenticate);

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = config.uploadDir;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

/**
 * POST /api/attachments/upload
 * 单条记录附件上传
 */
router.post('/upload', roleGuard('admin', 'user'), upload.single('file'), async (req, res) => {
  try {
    const { recordId } = req.body;
    if (!req.file) return error(res, '请选择文件');
    if (!recordId) return error(res, '缺少 recordId');

    const attachId = uuidv4();
    await db.query(
      `INSERT INTO attachment (id, file_name, file_type, file_size, file_path, _created_at, _created_by)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
      [attachId, req.file.originalname, req.file.mimetype, req.file.size, req.file.filename, req.user.username]
    );

    const linkId = uuidv4();
    await db.query(
      `INSERT INTO record_attachment (id, record_id, attachment_id, _created_at, _created_by)
       VALUES ($1, $2, $3, NOW(), $4)`,
      [linkId, recordId, attachId, req.user.username]
    );

    success(res, { id: attachId, fileName: req.file.originalname }, '上传成功');
  } catch (err) {
    console.error('上传附件失败:', err);
    error(res, '上传失败', 500);
  }
});

/**
 * POST /api/attachments/batch-upload
 * 批量附件上传（按物料编号匹配）
 */
router.post('/batch-upload', roleGuard('admin', 'user'), upload.array('files', 50), async (req, res) => {
  try {
    const { module } = req.body;
    if (!req.files || req.files.length === 0) return error(res, '请选择文件');
    if (!module) return error(res, '缺少 module 参数');

    let matched = 0, unmatched = 0;
    const errors = [];

    for (const file of req.files) {
      // 按文件名（去掉扩展名）匹配物料编号
      const title = path.basename(file.originalname, path.extname(file.originalname));
      const record = await db.query(
        'SELECT id FROM data_record WHERE module = $1 AND title = $2 LIMIT 1',
        [module, title]
      );

      if (record.rows.length === 0) {
        unmatched++;
        errors.push(`${title}: 未找到匹配记录`);
        continue;
      }

      const attachId = uuidv4();
      await db.query(
        `INSERT INTO attachment (id, file_name, file_type, file_size, file_path, _created_at, _created_by)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
        [attachId, file.originalname, file.mimetype, file.size, file.filename, req.user.username]
      );

      const linkId = uuidv4();
      await db.query(
        `INSERT INTO record_attachment (id, record_id, attachment_id, _created_at, _created_by)
         VALUES ($1, $2, $3, NOW(), $4)`,
        [linkId, record.rows[0].id, attachId, req.user.username]
      );
      matched++;
    }

    success(res, { matched, unmatched, errors },
      `批量上传完成：匹配 ${matched} 个，未匹配 ${unmatched} 个`);
  } catch (err) {
    console.error('批量上传失败:', err);
    error(res, '批量上传失败', 500);
  }
});

/**
 * POST /api/attachments/upload-multi
 * 上传附件并关联到多条记录
 */
router.post('/upload-multi', roleGuard('admin', 'user'), upload.single('file'), async (req, res) => {
  try {
    const { recordIds } = req.body; // JSON array string
    if (!req.file) return error(res, '请选择文件');
    if (!recordIds) return error(res, '缺少 recordIds');

    const ids = typeof recordIds === 'string' ? JSON.parse(recordIds) : recordIds;
    if (!Array.isArray(ids) || ids.length === 0) return error(res, 'recordIds 不能为空');

    // 创建附件记录（只创建一次）
    const attachId = uuidv4();
    await db.query(
      `INSERT INTO attachment (id, file_name, file_type, file_size, file_path, _created_at, _created_by)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
      [attachId, req.file.originalname, req.file.mimetype, req.file.size, req.file.filename, req.user.username]
    );

    // 关联到每条记录
    for (const recordId of ids) {
      const linkId = uuidv4();
      // 检查是否已关联
      const exists = await db.query(
        'SELECT 1 FROM record_attachment WHERE record_id = $1 AND attachment_id = $2',
        [recordId, attachId]
      );
      if (exists.rows.length === 0) {
        await db.query(
          `INSERT INTO record_attachment (id, record_id, attachment_id, _created_at, _created_by)
           VALUES ($1, $2, $3, NOW(), $4)`,
          [linkId, recordId, attachId, req.user.username]
        );
      }
    }

    success(res, { id: attachId, fileName: req.file.originalname, linkedCount: ids.length }, '上传并关联成功');
  } catch (err) {
    console.error('多记录附件上传失败:', err);
    error(res, '上传失败', 500);
  }
});

/**
 * POST /api/attachments/link-multi
 * 将已有附件关联到多条记录
 */
router.post('/link-multi', roleGuard('admin', 'user'), async (req, res) => {
  try {
    const { attachmentId, recordIds } = req.body;
    if (!attachmentId || !recordIds?.length) return error(res, '缺少参数');

    let linked = 0;
    for (const recordId of recordIds) {
      try {
        const exists = await db.query(
          'SELECT 1 FROM record_attachment WHERE record_id = $1 AND attachment_id = $2',
          [recordId, attachmentId]
        );
        if (exists.rows.length === 0) {
          const linkId = uuidv4();
          await db.query(
            `INSERT INTO record_attachment (id, record_id, attachment_id, _created_at, _created_by)
             VALUES ($1, $2, $3, NOW(), $4)`,
            [linkId, recordId, attachmentId, req.user.username]
          );
          linked++;
        }
      } catch {}
    }

    success(res, { linkedCount: linked }, `成功关联 ${linked} 条记录`);
  } catch (err) {
    console.error('关联附件失败:', err);
    error(res, '关联失败', 500);
  }
});

/**
 * GET /api/attachments/record/:recordId
 * 获取记录的附件列表
 */
router.get('/record/:recordId', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.* FROM attachment a
       JOIN record_attachment ra ON a.id = ra.attachment_id
       WHERE ra.record_id = $1
       ORDER BY a._created_at DESC`,
      [req.params.recordId]
    );
    success(res, result.rows);
  } catch (err) {
    console.error('获取附件列表失败:', err);
    error(res, '服务器错误', 500);
  }
});

/**
 * GET /api/attachments/:id/download
 * 下载附件
 */
router.get('/:id/download', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM attachment WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return error(res, '附件不存在', 404);

    const att = result.rows[0];
    const filePath = path.join(config.uploadDir, att.file_path);
    if (!fs.existsSync(filePath)) return error(res, '文件不存在', 404);

    res.download(filePath, att.file_name);
  } catch (err) {
    console.error('下载附件失败:', err);
    error(res, '下载失败', 500);
  }
});

/**
 * DELETE /api/attachments/:id
 * 删除附件
 */
router.delete('/:id', roleGuard('admin', 'user'), async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM attachment WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return error(res, '附件不存在', 404);

    const att = result.rows[0];
    const filePath = path.join(config.uploadDir, att.file_path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await db.query('DELETE FROM record_attachment WHERE attachment_id = $1', [req.params.id]);
    await db.query('DELETE FROM attachment WHERE id = $1', [req.params.id]);

    success(res, null, '删除成功');
  } catch (err) {
    console.error('删除附件失败:', err);
    error(res, '删除失败', 500);
  }
});

module.exports = router;
