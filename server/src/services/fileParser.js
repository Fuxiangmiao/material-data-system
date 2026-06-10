const XLSX = require('xlsx');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');

/**
 * 解析 Excel 文件
 */
async function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (jsonData.length === 0) {
    return { columns: [], rows: [] };
  }

  const columns = Object.keys(jsonData[0]);
  const rows = jsonData.map((row) => {
    const cleanRow = {};
    columns.forEach((col) => {
      cleanRow[col] = row[col] !== undefined && row[col] !== null ? String(row[col]) : '';
    });
    return cleanRow;
  });

  return { columns, rows };
}

/**
 * 解析 CSV 文件（使用 xlsx 库）
 */
function parseCSV(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (jsonData.length === 0) {
    return { columns: [], rows: [] };
  }

  const columns = Object.keys(jsonData[0]);
  const rows = jsonData.map((row) => {
    const cleanRow = {};
    columns.forEach((col) => {
      cleanRow[col] = row[col] !== undefined && row[col] !== null ? String(row[col]) : '';
    });
    return cleanRow;
  });

  return { columns, rows };
}

/**
 * 解析 Word 文件（转为文本）
 */
async function parseWord(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/**
 * 解析 PDF 文件（转为文本）
 */
async function parsePDF(buffer) {
  const result = await pdfParse(buffer);
  return result.text;
}

/**
 * 解析 Markdown 表格（本地解析，无需 AI）
 */
function parseMarkdownTable(text) {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // 找到表格起始
  const tableLines = lines.filter(
    (l) => l.startsWith('|') || (l.match(/[-:]+/) && l.includes('|'))
  );

  if (tableLines.length < 3) {
    throw new Error('未检测到有效的 Markdown 表格');
  }

  // 解析表头
  const headerLine = tableLines[0];
  const columns = headerLine
    .split('|')
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  // 跳过分隔行
  const dataLines = tableLines.slice(2);
  const rows = dataLines
    .map((line) => {
      const cells = line
        .split('|')
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      if (cells.length === 0) return null;

      const row = {};
      columns.forEach((col, idx) => {
        row[col] = cells[idx] || '';
      });
      return row;
    })
    .filter(Boolean);

  return { columns, rows };
}

/**
 * 解析 TSV（Tab 分隔值）数据，适用于从 Excel 粘贴的数据
 */
function parseTSV(text) {
  const lines = text.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('数据至少需要表头和一行数据');
  }

  const columns = lines[0].split('\t').map((c) => c.trim());
  if (columns.length < 2) {
    throw new Error('未检测到 Tab 分隔的数据列');
  }

  const rows = lines.slice(1).map((line) => {
    const cells = line.split('\t');
    const row = {};
    columns.forEach((col, idx) => {
      row[col] = (cells[idx] || '').trim();
    });
    return row;
  }).filter((row) => Object.values(row).some((v) => v !== ''));

  if (rows.length === 0) {
    throw new Error('未检测到有效数据行');
  }

  return { columns, rows };
}

/**
 * 自动检测文本格式并解析为结构化数据
 * 支持：Markdown 表格、TSV（Tab 分隔）、CSV
 */
function parseTextAuto(text) {
  // 1. Markdown 表格：含 | 分隔符
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const pipeLines = lines.filter((l) => l.includes('|'));
  if (pipeLines.length >= 2) {
    try { return parseMarkdownTable(text); } catch { /* fall through */ }
  }

  // 2. TSV：含 Tab 分隔符（从 Excel 粘贴）
  if (lines.some((l) => l.includes('\t'))) {
    return parseTSV(text);
  }

  // 3. CSV：含逗号分隔且列数一致
  const csvLines = lines.map((l) => l.split(',')).filter((cells) => cells.length >= 2);
  if (csvLines.length >= 2) {
    const headerCols = csvLines[0].length;
    const consistent = csvLines.filter((cells) => cells.length === headerCols).length;
    if (consistent >= csvLines.length * 0.7) {
      const columns = csvLines[0].map((c) => c.trim());
      const rows = csvLines.slice(1).map((cells) => {
        const row = {};
        columns.forEach((col, idx) => { row[col] = (cells[idx] || '').trim(); });
        return row;
      }).filter((row) => Object.values(row).some((v) => v !== ''));
      if (rows.length > 0) return { columns, rows };
    }
  }

  throw new Error('无法自动识别数据格式，请使用 Markdown 表格、Tab 分隔（从 Excel 粘贴）或 CSV 格式');
}

/**
 * 将通用编号别名（如"编号"）规范化为"物料编号"
 * 编号 === 物料编号，视为同一字段
 * 材质编号是独立字段，不参与映射
 */
function normalizeTitleField(result) {
  if (!result?.rows?.length) return result;

  // 如果"物料编号"已存在，无需处理
  if (result.columns.includes('物料编号')) return result;

  // "编号"是"物料编号"的别名
  const sourceField = '编号';
  if (!result.columns.includes(sourceField)) return result;

  // 替换 columns 中的字段名
  result.columns = result.columns.map((c) => (c === sourceField ? '物料编号' : c));

  // 替换每行中的字段名
  result.rows = result.rows.map((row) => {
    const newRow = {};
    for (const [key, val] of Object.entries(row)) {
      newRow[key === sourceField ? '物料编号' : key] = val;
    }
    return newRow;
  });

  return result;
}

module.exports = { parseExcel, parseCSV, parseWord, parsePDF, parseMarkdownTable, parseTSV, parseTextAuto, normalizeTitleField };
