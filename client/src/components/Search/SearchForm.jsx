import { useState, useCallback, useEffect } from 'react';
import { getFieldValues } from '../../api/statistics';

const DEFAULT_FIELDS = {
  material: ['物料编号', '物料名称', '分类', '供应商简称', '尺寸（长×宽×高）', '描述'],
  selection: ['分类', '供应商简称'],
  overseas: ['物料编号'],
};

export default function SearchForm({
  module,
  moduleLabel,
  loading,
  hasSearched,
  initialKeyword = '',
  initialFieldFilters = {},
  onSearch,
  onReset,
}) {
  const [keyword, setKeyword] = useState(initialKeyword);
  const [fieldFilters, setFieldFilters] = useState(initialFieldFilters);
  const [fieldValues, setFieldValues] = useState({});
  const [showMoreFields, setShowMoreFields] = useState(false);

  useEffect(() => {
    getFieldValues(module).then((res) => {
      if (res.success) setFieldValues(res.data || {});
    }).catch(() => {});
  }, [module]);

  useEffect(() => {
    setFieldFilters({});
    setShowMoreFields(false);
  }, [module]);

  const handleFieldChange = useCallback((key, value) => {
    setFieldFilters((prev) => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      // 所有输入为空时自动重置（优化项 19）
      if (!keyword.trim() && !Object.values(next).some((v) => v && v.trim()) && hasSearched) {
        setTimeout(() => onReset(), 0);
      }
      return next;
    });
  }, [keyword, hasSearched, onReset]);

  const triggerSearch = useCallback((filters, kw) => {
    const trimmedKw = kw.trim();
    const activeFilters = {};
    for (const [k, v] of Object.entries(filters)) {
      if (v.trim()) activeFilters[k] = v.trim();
    }
    onSearch(trimmedKw, activeFilters);
  }, [onSearch]);

  const handleKeywordChange = useCallback((value) => {
    setKeyword(value);
    // 所有输入为空时自动重置（优化项 19）
    if (!value.trim() && !Object.values(fieldFilters).some((v) => v && v.trim()) && hasSearched) {
      setTimeout(() => onReset(), 0);
    }
  }, [fieldFilters, hasSearched, onReset]);

  const hasInput = keyword.trim() || Object.values(fieldFilters).some((v) => v && v.trim());

  const handleSearch = useCallback(() => {
    if (!keyword.trim() && !Object.values(fieldFilters).some((v) => v && v.trim())) {
      alert('请输入关键词或填写筛选字段');
      return;
    }
    triggerSearch(fieldFilters, keyword);
  }, [keyword, fieldFilters, triggerSearch]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') handleSearch();
  }, [handleSearch]);

  const handleReset = useCallback(() => {
    setKeyword('');
    setFieldFilters({});
    setShowMoreFields(false);
    onReset();
  }, [onReset]);

  const defaultFieldsConfig = DEFAULT_FIELDS[module] || DEFAULT_FIELDS.material;
  const allDbFields = Object.keys(fieldValues);
  const defaultFields = defaultFieldsConfig.filter((f) => allDbFields.includes(f));
  const extraFields = allDbFields.filter((k) => !defaultFieldsConfig.includes(k)).sort();
  const visibleFields = showMoreFields ? [...defaultFields, ...extraFields] : defaultFields;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
      <p className="text-xs text-slate-500 mb-3">{moduleLabel} · 搜索查询</p>

      {/* 全局关键词 */}
      <div className="flex gap-3 mb-4">
        <input
          value={keyword}
          onChange={(e) => handleKeywordChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="全局关键词，空格分隔（且关系）..."
          className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
        />
        <button
          onClick={handleSearch}
          disabled={loading || !hasInput}
          className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition"
        >
          {loading ? '搜索中...' : '🔍 搜索'}
        </button>
        {hasInput && (
          <button
            onClick={handleReset}
            className="px-3 py-2 text-sm bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition"
          >
            ↻ 重置
          </button>
        )}
      </div>

      {/* 字段过滤器 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {visibleFields.map((fieldName) => (
          <div key={fieldName}>
            <label className="text-xs text-slate-500 font-medium block mb-1">{fieldName}</label>
            <input
              value={fieldFilters[fieldName] || ''}
              onChange={(e) => handleFieldChange(fieldName, e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`输入${fieldName}筛选...`}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-primary/30 outline-none"
            />
          </div>
        ))}
      </div>

      {/* 展开更多字段 */}
      {extraFields.length > 0 && (
        <button
          onClick={() => setShowMoreFields((prev) => !prev)}
          className="flex items-center gap-1 mt-3 text-xs text-primary hover:underline"
        >
          {showMoreFields ? '▲ 收起更多字段' : `▼ 展开更多字段（${extraFields.length}个）`}
        </button>
      )}
    </div>
  );
}
