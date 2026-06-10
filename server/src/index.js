const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('./config');

const app = express();

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 确保 uploads 目录存在
if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

// 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/records', require('./routes/records'));
app.use('/api/import', require('./routes/import'));
app.use('/api/export', require('./routes/export'));
app.use('/api/compare', require('./routes/compare'));
app.use('/api/attachments', require('./routes/attachments'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/users', require('./routes/users'));
app.use('/api/statistics', require('./routes/statistics'));
app.use('/api/compare-import', require('./routes/compare-import'));

// 生产模式：托管前端构建产物
const clientDist = path.join(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // SPA fallback：所有非 /api 路由返回 index.html
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(clientDist, 'index.html'));
    }
  });
  console.log('📦 前端静态文件已启用: client/dist');
}

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ success: false, message: '服务器内部错误' });
});

app.listen(config.port, '0.0.0.0', () => {
  console.log(`🚀 物料数据管理系统后端已启动: http://localhost:${config.port}`);
  console.log(`📋 API 文档: http://localhost:${config.port}/api/health`);
});
