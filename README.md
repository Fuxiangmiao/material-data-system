# 器件部物料数据智能管理系统

物料数据的智能检索、录入、导入、比对、导出全流程管理系统。

## 技术栈

- **前端**: React 18 + Vite + Tailwind CSS + React Router v6
- **后端**: Node.js + Express + PostgreSQL
- **AI**: OpenAI API (GPT-4o) 用于图片/文档/文本结构化解析

## 快速启动

### 1. 环境准备

- Node.js 18+
- PostgreSQL 14+
- 确保 PostgreSQL 服务已启动

### 2. 数据库初始化

```bash
# 创建数据库
createdb material_data

# 执行初始化脚本
psql material_data < database/init.sql
```

### 3. 安装依赖

```bash
npm run install:all
```

### 4. 配置环境变量

编辑 `server/.env` 文件，配置数据库连接和 AI API Key：

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=material_data
DB_USER=postgres
DB_PASSWORD=postgres
OPENAI_API_KEY=your-api-key
```

### 5. 启动开发环境

```bash
npm run dev
```

- 前端: http://localhost:5173
- 后端: http://localhost:3001

## 默认账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | 管理员（全功能） |
| operator1 | admin123 | 操作员（读写） |
| operator2 | admin123 | 操作员（读写） |
| guest | guest123 | 访客（只读） |

## 功能模块

### 物料数据管理 (material)
- 数据检索、录入、文件导入、差异性比对

### 物料选型库管理 (selection)
- 数据检索、录入、文件导入、差异性比对、附件管理、批量附件上传

### 海外物料承认管理 (overseas)
- 数据检索、录入、文件导入、承认进度反馈导出

### 系统管理（仅管理员）
- 数据初始化、用户管理

## 项目结构

```
material-data-system/
├── server/          # 后端 Express 服务
│   ├── src/
│   │   ├── routes/       # API 路由
│   │   ├── services/     # AI 解析、文件解析、导入服务
│   │   ├── middleware/   # 认证、权限中间件
│   │   └── utils/        # 工具函数
│   └── uploads/          # 文件存储
├── client/          # 前端 React 应用
│   └── src/
│       ├── components/   # UI 组件
│       ├── pages/        # 页面组件
│       ├── contexts/     # React Context
│       ├── hooks/        # 自定义 Hooks
│       └── api/          # API 客户端
├── database/        # 数据库脚本
└── README.md
```
