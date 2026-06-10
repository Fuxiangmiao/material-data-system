import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import api from '../api/client';

const MODULE_TITLES = {
  material: '物料数据管理',
  selection: '物料选型库管理',
  overseas: '海外物料承认管理',
};

const MAX_COMPARE = 5;

export default function ComparePage() {
  const { module } = useParams();
  const navigate = useNavigate();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [records, setRecords] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [comparison, setComparison] = useState(null); // { commonKeys, differences, records }
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchKeyword.trim()) return;
    setLoading(true);
    try {
      const res = await api.get('/records', {
        params: { module, search: searchKeyword, pageSize: 100 },
      });
      if (res.success) setRecords(res.data || []);
    } catch (err) {
      alert(err.message || '搜索失败');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_COMPARE) {
        next.add(id);
      }
      return next;
    });
  };

  const handleCompare = async () => {
    if (selectedIds.size < 2) { alert('请至少选择2条记录'); return; }
    setLoading(true);
    try {
      const res = await api.post('/compare', { ids: Array.from(selectedIds), module });
      if (res.success) setComparison(res.data);
    } catch (err) {
      alert(err.message || '比对失败');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSearchKeyword('');
    setRecords([]);
    setSelectedIds(new Set());
    setComparison(null);
  };

  // Export comparison as Excel
  const handleExport = () => {
    if (!comparison) return;
    const { commonKeys, differences, records: compRecords } = comparison;
    const allKeys = [...commonKeys];
    const titles = compRecords.map((r) => r.title);

    // Build values map for all keys
    const valuesMap = {};
    for (const key of commonKeys) {
      valuesMap[key] = {};
      for (const r of compRecords) {
        valuesMap[key][r.id] = r.data?.[key] !== undefined ? String(r.data[key]) : '';
      }
    }
    for (const diff of differences) {
      if (!valuesMap[diff.key]) {
        valuesMap[diff.key] = diff.values;
      }
    }

    const headers = ['字段', ...titles];
    const rows = allKeys.map((key) => [
      key,
      ...compRecords.map((r) => valuesMap[key]?.[r.id] || ''),
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '对比结果');
    XLSX.writeFile(wb, `对比结果_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Combine commonKeys + differences for display
  const diffKeySet = new Set((comparison?.differences || []).map((d) => d.key));
  const allKeys = comparison?.commonKeys || [];
  const displayKeys = onlyDiff ? allKeys.filter((k) => diffKeySet.has(k)) : allKeys;
  const diffMap = new Map((comparison?.differences || []).map((d) => [d.key, d.values]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">{MODULE_TITLES[module]} - 差异性比对</h1>
        <button onClick={() => navigate(`/${module}`)} className="px-3 py-1.5 text-sm bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition">
          ← 返回检索
        </button>
      </div>

      {/* Search & Select */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex gap-2 mb-3">
          <input type="text" value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
            placeholder="输入关键词搜索记录..." />
          <button onClick={handleSearch} disabled={loading}
            className="px-4 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition">
            搜索
          </button>
        </div>

        {records.length > 0 && !comparison && (
          <>
            <p className="text-xs text-slate-500 mb-2">选择 2-{MAX_COMPARE} 条记录进行比对（已选 {selectedIds.size} 条）</p>
            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg">
              {records.map((r) => (
                <label key={r.id}
                  className={`flex items-center gap-2 px-3 py-2 border-b border-slate-100 last:border-0 ${
                    selectedIds.has(r.id) ? 'bg-primary/5' : selectedIds.size >= MAX_COMPARE ? 'opacity-40' : 'hover:bg-blue-50 cursor-pointer'
                  }`}>
                  <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)}
                    disabled={!selectedIds.has(r.id) && selectedIds.size >= MAX_COMPARE}
                    className="rounded border-slate-300" />
                  <span className="font-medium text-primary text-sm">{r.title}</span>
                  <span className="text-xs text-slate-400">{Object.values(r.data || {}).slice(0, 3).join(' | ')}</span>
                </label>
              ))}
            </div>
          </>
        )}

        {/* Selected badges */}
        {selectedIds.size > 0 && !comparison && (
          <div className="flex flex-wrap gap-2 mt-3">
            {Array.from(selectedIds).map((id) => {
              const rec = records.find((r) => r.id === id);
              return (
                <span key={id} className="px-2 py-1 text-xs bg-primary/10 text-primary rounded flex items-center gap-1">
                  {rec?.title || id}
                  <button onClick={() => toggleSelect(id)} className="hover:text-red-500">✕</button>
                </span>
              );
            })}
          </div>
        )}

        <div className="flex gap-2 mt-3">
          <button onClick={handleCompare} disabled={selectedIds.size < 2 || loading}
            className="px-4 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition">
            {loading ? '比对中...' : `📊 开始比对 (${selectedIds.size} 条)`}
          </button>
          <button onClick={handleReset} className="px-4 py-1.5 text-sm bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition">
            重置
          </button>
        </div>
      </div>

      {/* Comparison Result */}
      {comparison && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-slate-700">比对结果</h3>
              <span className="text-xs text-slate-500">
                {comparison.commonKeys?.length || 0} 个字段 · {comparison.differences?.length || 0} 个差异
              </span>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)}
                  className="rounded border-slate-300" />
                仅显示差异
              </label>
              <button onClick={handleExport}
                className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
                📥 导出 Excel
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 whitespace-nowrap">
                    字段
                  </th>
                  {comparison.records?.map((r) => (
                    <th key={r.id} className="px-3 py-2 text-left bg-slate-50 border-b border-slate-200 font-semibold text-primary whitespace-nowrap">
                      {r.title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayKeys.map((key) => {
                  const isDiff = diffKeySet.has(key);
                  return (
                    <tr key={key} className={`border-b border-slate-100 ${isDiff ? 'bg-amber-50' : 'bg-green-50/30'}`}>
                      <td className="px-3 py-2 font-medium text-slate-700 whitespace-nowrap">
                        {key}
                        {isDiff && <span className="ml-1 text-xs text-amber-600">⚠</span>}
                      </td>
                      {comparison.records?.map((r) => {
                        const val = isDiff ? (diffMap.get(key)?.[r.id] || '') : (r.data?.[key] !== undefined ? String(r.data[key]) : '');
                        return (
                          <td key={r.id} className="px-3 py-2 whitespace-nowrap max-w-[200px] truncate">
                            {val || <span className="text-slate-300">-</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
