const OpenAI = require('openai');
const config = require('../config');

let client = null;

function getClient() {
  if (!client) {
    client = new OpenAI({
      apiKey: config.openai.apiKey,
      baseURL: config.openai.baseURL,
    });
  }
  return client;
}

const STRUCTURED_PROMPT = `你是一个电子元器件数据结构化专家。请分析提供的内容，提取所有物料相关数据，输出严格的 JSON 格式：
{
  "columns": ["列名1", "列名2", ...],
  "rows": [
    {"列名1": "值1", "列名2": "值2", ...},
    ...
  ]
}
要求：
- 保留原始列名（中文）
- 每行数据对应一条物料记录
- 如果存在物料编号字段，列名使用"物料编号"
- 无法识别的字段设为 null
- 只输出 JSON，不要其他文字`;

/**
 * 解析图片为结构化 JSON
 */
async function parseImage(buffer, mimeType = 'image/png') {
  const openai = getClient();
  const base64 = buffer.toString('base64');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: STRUCTURED_PROMPT },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64}` },
          },
        ],
      },
    ],
    max_tokens: 4096,
  });

  return parseAiResponse(response.choices[0].message.content);
}

/**
 * 解析文档文本为结构化 JSON
 */
async function parseDocument(text) {
  const openai = getClient();

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: STRUCTURED_PROMPT },
      { role: 'user', content: `请解析以下文档内容：\n\n${text}` },
    ],
    max_tokens: 4096,
  });

  return parseAiResponse(response.choices[0].message.content);
}

/**
 * 解析自由文本为结构化 JSON
 */
async function parseText(rawText) {
  const openai = getClient();

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: STRUCTURED_PROMPT },
      { role: 'user', content: `请将以下文本转为结构化数据：\n\n${rawText}` },
    ],
    max_tokens: 4096,
  });

  return parseAiResponse(response.choices[0].message.content);
}

function parseAiResponse(content) {
  // 尝试从 AI 回复中提取 JSON
  let jsonStr = content.trim();

  // 去掉 markdown 代码块
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed.columns || !parsed.rows) {
      throw new Error('返回格式不正确，缺少 columns 或 rows');
    }
    return parsed;
  } catch (e) {
    throw new Error(`AI 返回内容解析失败: ${e.message}\n原始内容: ${content.slice(0, 200)}`);
  }
}

module.exports = { parseImage, parseDocument, parseText };
