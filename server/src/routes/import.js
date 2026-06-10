const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const config = require('../config');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');
const { success, error } = require('../utils/response');
const fileParser = require('../services/fileParser');
const aiParser = require('../services/aiParser');
const importService = require('../services/importService');

router.use(authenticate);

// 文件上传配置
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

/**
 * POST /api/import/parse
 * 解析上传文件
 */
router.post('/parse', roleGuard('admin', 'user'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return error(res, '请上传文件');
    }

    const { parseType } = req.body;
    const file = req.file;
    const ext = path.extname(file.originalname).toLowerCase();
    let result;

    if (ext === '.xlsx' || ext === '.xls') {
      result = await fileParser.parseExcel(file.buffer);
    } else if (ext === '.csv') {
      result = fileParser.parseCSV(file.buffer);
    } else if (ext === '.docx' || ext === '.doc') {
      const text = await fileParser.parseWord(file.buffer);
      result = await aiParser.parseDocument(text);
    } else if (ext === '.pdf') {
      const text = await fileParser.parsePDF(file.buffer);
      result = await aiParser.parseDocument(text);
    } else if (ext.match(/\.(png|jpg|jpeg|bmp|tiff|gif)/i)) {
      result = await aiParser.parseImage(file.buffer, file.mimetype);
    } else {
      return error(res, '不支持的文件格式');
    }

    // 将"编号"规范化为"物料编号"（编号 === 物料编号）
    result = fileParser.normalizeTitleField(result);

    success(res, result, '文件解析成功');
  } catch (err) {
    console.error('文件解析失败:', err);
    error(res, `文件解析失败: ${err.message}`, 500);
  }
});

/**
 * POST /api/import/parse-text
 * 解析文本（自动检测 Markdown/TSV/CSV，AI 兜底）
 */
router.post('/parse-text', roleGuard('admin', 'user'), async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return error(res, '请输入文本');
    }

    let result;
    // 优先本地解析（Markdown / TSV / CSV）
    try {
      result = fileParser.parseTextAuto(text);
    } catch (localErr) {
      // 本地解析失败，尝试 AI 解析
      try {
        result = await aiParser.parseText(text);
      } catch (aiErr) {
        return error(res, `文本解析失败：${localErr.message}。AI 解析也失败：${aiErr.message}`);
      }
    }

    // 将"编号"规范化为"物料编号"（编号 === 物料编号）
    result = fileParser.normalizeTitleField(result);

    success(res, result, '文本解析成功');
  } catch (err) {
    console.error('文本解析失败:', err);
    error(res, `文本解析失败: ${err.message}`, 500);
  }
});

/**
 * POST /api/import/check-match
 * 检查导入数据匹配状态（预览新增/更新/跳过）
 */
router.post('/check-match', roleGuard('admin', 'user'), async (req, res) => {
  try {
    const { rows, module } = req.body;
    if (!rows || !module) return error(res, '缺少参数');

    const titleField = module === 'selection' ? '材质编号' : '物料编号';
    const results = [];
    let newCount = 0, updateCount = 0, skipCount = 0;

    for (const row of rows) {
      const title = row[titleField] || '';
      if (!title) {
        results.push({ ...row, _matchStatus: 'skip', _matchNote: '缺少编号' });
        skipCount++;
        continue;
      }

      const existing = await db.query(
        'SELECT id, data FROM data_record WHERE module = $1 AND title = $2 LIMIT 1',
        [module, title]
      );

      if (existing.rows.length > 0) {
        // 检查是否有空值字段可填充
        const existingData = existing.rows[0].data || {};
        let fillableFields = [];
        for (const [key, val] of Object.entries(row)) {
          if (key === titleField) continue;
          if (val && val !== '' && (!existingData[key] || existingData[key] === '')) {
            fillableFields.push(key);
          }
        }
        if (fillableFields.length > 0) {
          results.push({ ...row, _matchStatus: 'update', _matchNote: `填充 ${fillableFields.length} 个字段: ${fillableFields.join(', ')}` });
          updateCount++;
        } else {
          results.push({ ...row, _matchStatus: 'skip', _matchNote: '无新数据可填充' });
          skipCount++;
        }
      } else {
        results.push({ ...row, _matchStatus: 'new', _matchNote: '新增记录' });
        newCount++;
      }
    }

    success(res, { rows: results, stats: { new: newCount, update: updateCount, skip: skipCount, total: rows.length } });
  } catch (err) {
    console.error('匹配检查失败:', err);
    error(res, '匹配检查失败', 500);
  }
});

/**
 * POST /api/import/confirm
 * 确认导入（执行匹配策略）
 */
router.post('/confirm', roleGuard('admin', 'user'), async (req, res) => {
  try {
    const { rows, module } = req.body;
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return error(res, '没有可导入的数据');
    }
    if (!module) {
      return error(res, '缺少 module 参数');
    }

    const result = await importService.importData(rows, module, req.user.username);
    success(res, result, `导入完成：新增 ${result.created} 条，更新 ${result.updated} 条`);
  } catch (err) {
    console.error('导入失败:', err);
    error(res, `导入失败: ${err.message}`, 500);
  }
});

module.exports = router;
