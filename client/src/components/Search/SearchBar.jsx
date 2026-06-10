import { useState, useCallback } from 'react';

// 各模块默认搜索字段
const MODULE_FIELDS = {
  material: ['物料编号', '物料名称', '分类', '供应商简称', '尺寸（长×宽×高）', '描述'],
  selection: ['分类', '供应商简称'],
  overseas: ['物料编号'],
};

export default function SearchBar({ module, onSearch, loading }) {
  const fields = MODULE_FIELDS[module] || ['物料编号'];
  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.map((f) => [f, '']))
  );

  const isEmpty = Object.values(values).every((v) => !v.trim());

  const handleChange = (field, val) => {
    setValues((prev) => ({ ...prev, [field]: val }));
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (isEmpty) return;
    // 合并非空字段为一个搜索关键词
    const keywords = Object.entries(values)
      .filter(([, v]) => v.trim())
      .map(([k, v]) => `${k}:${v.trim()}`)
      .join(' ');
    onSearch(keywords, values);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  const handleReset = () => {
    setValues(Object.fromEntries(fields.map((f) => [f, ''])));
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-4 mb-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
        {fields.map((field) => (
          <div key={field}>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {field}
            </label>
            <input
              type="text"
              value={values[field] || ''}
              onChange={(e) => handleChange(field, e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
              placeholder={`输入${field}`}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isEmpty || loading}
          className="px-4 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
        >
          {loading ? '搜索中...' : '🔍 搜索'}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="px-4 py-1.5 text-sm bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition"
        >
          重置
        </button>
      </div>
    </form>
  );
}
