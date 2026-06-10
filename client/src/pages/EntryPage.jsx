import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';

const MODULE_TITLES = {
  material: '物料数据管理',
  selection: '物料选型库管理',
  overseas: '海外物料承认管理',
};

const DEFAULT_VISIBLE_COUNT = 2; // 搜索为空时默认显示的字段数（不含 title 字段）

export default function EntryPage() {
  const { module } = useParams();
  const navigate = useNavigate();
  const [fields, setFields] = useState([]);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showAllFields, setShowAllFields] = useState(false);

  const titleField = module === 'selection' ? '材质编号' : '物料编号';

  useEffect(() => {
    loadFields();
  }, [module]);

  const loadFields = async () => {
    try {
      const res = await api.get(`/records/fields/${module}`);
      if (res.success && res.data.length > 0) {
        setFields(res.data);
        setForm(Object.fromEntries(res.data.map((f) => [f, ''])));
      }
    } catch {}
  };

  const handleChange = (field, val) => {
    setForm((prev) => ({ ...prev, [field]: val }));
  };

  const resetForm = () => {
    setForm(Object.fromEntries(fields.map((f) => [f, ''])));
    setSearchKeyword('');
    setSearchResults([]);
    setShowSearch(false);
    setShowAllFields(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const title = form[titleField] || form['物料编号'] || '';
    if (!title) {
      alert(`请填写${titleField}`);
      return;
    }

    setLoading(true);
    try {
      const data = { ...form };
      delete data[titleField];
      if (titleField !== '物料编号') delete data['物料编号'];

      const res = await api.post('/records', {
        title,
        data,
        module,
        source: 'manual',
      });

      if (res.success) {
        alert('录入成功');
        resetForm();
      }
    } catch (err) {
      alert(err.message || '录入失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchRef = async () => {
    if (!searchKeyword.trim()) return;
    try {
      const res = await api.get('/records/search-ref', {
        params: { module, keyword: searchKeyword },
      });
      if (res.success) {
        setSearchResults(res.data || []);
        setShowSearch(true);
      }
    } catch (err) {
      alert(err.message || '搜索失败');
    }
  };

  const handleRefSelect = (record) => {
    const newForm = { ...form };
    newForm[titleField] = record.title;
    if (record.data) {
      Object.entries(record.data).forEach(([k, v]) => {
        if (fields.includes(k)) newForm[k] = v || '';
      });
    }
    setForm(newForm);
    setShowSearch(false);
    setSearchResults([]);
  };

  // 过滤字段：排除 title 字段
  const dataFields = fields.filter((f) => f !== titleField && f !== '物料编号');
  // 搜索框为空时默认折叠，有搜索值时展开
  const isSearching = searchKeyword.trim().length > 0;
  const shouldCollapse = !isSearching && !showAllFields;
  const visibleDataFields = shouldCollapse ? dataFields.slice(0, DEFAULT_VISIBLE_COUNT) : dataFields;
  const hiddenCount = dataFields.length - DEFAULT_VISIBLE_COUNT;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-800">
          {MODULE_TITLES[module]} - 数据录入
        </h1>
        <button
          onClick={() => navigate(`/${module}`)}
          className="px-3 py-1.5 text-sm bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition"
        >
          ← 返回检索
        </button>
      </div>

      {/* 搜索引用 */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">搜索引用已有数据</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearchRef()}
            className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
            placeholder="输入关键词搜索已有数据..."
          />
          <button
            onClick={handleSearchRef}
            className="px-3 py-1.5 text-sm bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition"
          >
            搜索引用
          </button>
        </div>

        {showSearch && searchResults.length > 0 && (
          <div className="mt-2 border border-slate-200 rounded-lg max-h-40 overflow-y-auto">
            {searchResults.map((r) => (
              <button
                key={r.id}
                onClick={() => handleRefSelect(r)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-slate-100 last:border-0 transition"
              >
                <span className="font-medium text-primary">{r.title}</span>
                <span className="text-slate-400 ml-2">
                  {Object.values(r.data || {}).slice(0, 3).join(' | ')}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 录入表单 */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* title 字段 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {titleField} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form[titleField] || ''}
              onChange={(e) => handleChange(titleField, e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
              placeholder={`输入${titleField}`}
              required
            />
          </div>

          {/* 动态字段 */}
          {visibleDataFields.map((field) => (
            <div key={field}>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {field}
              </label>
              <input
                type="text"
                value={form[field] || ''}
                onChange={(e) => handleChange(field, e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                placeholder={`输入${field}`}
              />
            </div>
          ))}
        </div>

        {/* 展开/收起更多字段 */}
        {hiddenCount > 0 && !isSearching && (
          <button
            type="button"
            onClick={() => setShowAllFields((prev) => !prev)}
            className="mt-3 text-xs text-primary hover:underline"
          >
            {showAllFields ? `▲ 收起字段` : `▼ 展开更多字段（${hiddenCount} 个）`}
          </button>
        )}

        <div className="mt-6 flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 transition font-medium"
          >
            {loading ? '提交中...' : '提交录入'}
          </button>
          <button
            type="button"
            onClick={resetForm}
            className="px-6 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition"
          >
            重置表单
          </button>
        </div>
      </form>
    </div>
  );
}
