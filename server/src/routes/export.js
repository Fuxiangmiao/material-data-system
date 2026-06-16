const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { error } = require('../utils/response');

router.use(authenticate);

/**
 * GET /api/export
 * 导出 Excel
 */
router.get('/', async (req, res) => {
  try {
    const { module, ids } = req.query;
    if (!module) {
      return error(res, '缺少 module 参数');
    }

    let query, params;
    if (ids) {
      const idList = ids.split(',');
      query = 'SELECT * FROM data_record WHERE module = $1 AND id = ANY($2) ORDER BY _created_at';
      params = [module, idList];
    } else {
      query = 'SELECT * FROM data_record WHERE module = $1 ORDER BY _created_at';
      params = [module];
    }

    const result = await db.query(query, params);
    const records = result.rows;

    if (records.length === 0) {
      return error(res, '没有可导出的数据');
    }

    // 构建导出数据
    let columns = [];
    const rows = records.map((r) => {
      const rowData = { ...r.data };
      // 确保 title 在第一列
      const titleKey = module === 'selection' ? '材质编号' : '物料编号';
      const row = { [titleKey]: r.title };

      // 收集所有列名
      Object.keys(rowData).forEach((key) => {
        if (!columns.includes(key)) {
          columns.push(key);
        }
        row[key] = rowData[key];
      });

      return row;
    });

    // 海外模块特殊处理：仅导出承认进度相关字段
    if (module === 'overseas') {
      const exportFields = ['物料编号', '描述', '是否完成承认', '承认进度', '承认工厂'];
      const filteredRows = rows.map((row) => {
        const filtered = {};
        exportFields.forEach((field) => {
          if (row[field] !== undefined) {
            filtered[field] = row[field];
          }
        });
        return filtered;
      });
      columns = exportFields.filter((f) =>
        rows.some((r) => r[f] !== undefined)
      );
      return exportExcel(res, filteredRows, columns, module);
    }

    // 各模块固定列顺序
    const fixedKeys = getFixedKeys(module);
    const orderedColumns = [
      ...fixedKeys.filter((k) => columns.includes(k)),
      ...columns.filter((c) => !fixedKeys.includes(c)),
    ];

    exportExcel(res, rows, orderedColumns, module);
  } catch (err) {
    console.error('导出失败:', err);
    error(res, '导出失败', 500);
  }
});

function getFixedKeys(module) {
  const map = {
    material: ['物料编号', '物料名称', '单颗物料净重(g)'],
    selection: ['物料分类', '材质名称', '应用场景'],
    overseas: ['物料编号', '描述', '承认工厂&供应商'],
  };
  return map[module] || [];
}

function exportExcel(res, rows, columns, module) {
  const moduleName = {
    material: '物料数据',
    selection: '选型库',
    overseas: '海外承认',
  }[module] || '数据';

  const ws = XLSX.utils.json_to_sheet(rows, { header: columns });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, moduleName);

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader(
    'Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(moduleName + '_导出_' + new Date().toISOString().slice(0, 10))}.xlsx`
  );
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.send(buffer);
}

module.exports = router;
