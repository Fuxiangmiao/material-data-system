import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api, { deleteByFilter, initDatabase } from '../api/client';
import { getStatistics } from '../api/statistics';

const MODULE_TITLES = {
  material: '物料数据管理',
  selection: '物料选型库管理',
  overseas: '海外物料承认管理',
};

const MODULE_OPTIONS = [
  { value: 'material', label: '📦 物料数据管理' },
  { value: 'selection', label: '🧩 物料选型库管理' },
  { value: 'overseas', label: '🌏 海外物料承认管理' },
];

export default function DataInitPage() {
  const { module: urlModule } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [filterType, setFilterType] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterKeyword, setFilterKeyword] = useState('');
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [showConfirmFilter, setShowConfirmFilter] = useState(false);
  const [selectedModule, setSelectedModule] = useState(urlModule || 'material');

  // 条件删除预览
  const [previewRecords, setPreviewRecords] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [matchedTotal, setMatchedTotal] = useState(0); // 匹配的记录总数

  // Fetch stats on mount or module change
  useEffect(() => {
    getStatistics(selectedModule, '', {}).then((res) => {
      if (res.success) setStats(res.data);
    }).catch(() => {});
    // 切换模块时重置筛选条件
    setFilterType('');
    setFilterSource('');
    setFilterKeyword('');
    setPreviewRecords([]);
    setSelectedIds(new Set());
    setMatchedTotal(0);
  }, [selectedModule]);

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="text-4xl mb-3">🔒</div>
          <p className="text-slate-600">权限不足，仅管理员可访问</p>
        </div>
      </div>
    );
  }

  const refreshStats = () => {
    getStatistics(selectedModule, '', {}).then((res) => {
      if (res.success) setStats(res.data);
    }).catch(() => {});
  };

  const handleClearAll = async () => {
    setShowConfirmClear(false);
    setLoading(true);
    try {
      const res = await initDatabase(selectedModule);
      if (res.success) alert(res.message);
      refreshStats();
    } catch (err) {
      alert(err.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterDelete = async () => {
    setShowConfirmFilter(false);
    setLoading(true);
    try {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) {
        alert('请选择要删除的记录');
        return;
      }
      const res = await api.post('/records/batch-delete', { ids });
      if (res.success) {
        alert(res.message);
        setPreviewRecords([]);
        setSelectedIds(new Set());
        setMatchedTotal(0);
        refreshStats();
      }
    } catch (err) {
      alert(err.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  // 预览搜索结果
  const handlePreview = async () => {
    if (!filterType && !filterSource && !filterKeyword.trim()) {
      alert('请至少指定一个筛选条件');
      return;
    }
    setPreviewLoading(true);
    setSelectedIds(new Set());
    try {
      // 获取总数
      const countParams = { module: selectedModule, pageSize: 1, page: 1 };
      if (filterKeyword.trim()) countParams.search = filterKeyword.trim();
      if (filterType) countParams.type = filterType;
      if (filterSource) countParams.source = filterSource;

      const countRes = await api.get('/records', { params: countParams });
      if (countRes.success) {
        setMatchedTotal(countRes.pagination?.total || 0);

        // 获取预览数据（最多500条）
        const params = { ...countParams, pageSize: 500 };
        const res = await api.get('/records', { params });
        if (res.success) {
          setPreviewRecords(res.data || []);
        }
      }
    } catch (err) {
      alert(err.message || '搜索失败');
    } finally {
      setPreviewLoading(false);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = async () => {
    if (selectedIds.size === matchedTotal && matchedTotal > 0) {
      // 取消全选
      setSelectedIds(new Set());
    } else {
      // 全选：通过 API 获取所有匹配的 ID
      setPreviewLoading(true);
      try {
        const params = {
          module: selectedModule,
          pageSize: 1000,
          page: 1,
          search: filterKeyword.trim() || undefined,
          type: filterType || undefined,
          source: filterSource || undefined,
        };

        const res = await api.get('/records', { params });
        if (res.success) {
          const allIds = (res.data || []).map((r) => r.id);
          setSelectedIds(new Set(allIds));
        }
      } catch (err) {
        alert(err.message || '获取全部记录失败');
      } finally {
        setPreviewLoading(false);
      }
    }
  };

  const typeEntries = Object.entries(stats?.typeDistribution || {}).sort((a, b) => b[1] - a[1]);
  const sourceEntries = Object.entries(stats?.sourceDistribution || {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">数据初始化</h1>
        <button onClick={() => navigate(`/${selectedModule}`)} className="px-3 py-1.5 text-sm bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition">
          ← 返回检索
        </button>
      </div>

      {/* Module Selector */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <label className="block text-sm font-medium text-slate-700 mb-2">选择物料数据库</label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {MODULE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSelectedModule(opt.value)}
              className={`px-4 py-3 text-sm rounded-lg border-2 transition text-left ${
                selectedModule === opt.value
                  ? 'border-primary bg-primary/5 text-primary font-medium'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Statistics Overview */}
      {stats && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-medium text-slate-700 mb-3">📊 {MODULE_TITLES[selectedModule]} - 数据概览</h3>
          <div className="grid grid-cols-4 gap-3 mb-3">
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-slate-700">{stats.totalCount}</p>
              <p className="text-xs text-slate-500">总记录</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{stats.updatedCount}</p>
              <p className="text-xs text-green-600">已更新</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{typeEntries.length}</p>
              <p className="text-xs text-blue-600">类型数</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-purple-600">{sourceEntries.length}</p>
              <p className="text-xs text-purple-600">来源数</p>
            </div>
          </div>
          {typeEntries.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {typeEntries.map(([type, count]) => (
                <span key={type} className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded">
                  {type || '(空)'}: {count}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Clear All */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-red-600 mb-3">⚠️ 一键清除</h3>
          <p className="text-sm text-slate-600 mb-4">
            清除「{MODULE_TITLES[selectedModule]}」模块的全部 {stats?.totalCount || 0} 条数据。此操作不可恢复。
          </p>
          <button onClick={() => setShowConfirmClear(true)} disabled={loading || (stats?.totalCount || 0) === 0}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition font-medium">
            {loading ? '处理中...' : '🗑️ 清除全部数据'}
          </button>
        </div>
      </div>

      {/* Filter Delete - full width with preview */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-orange-600 mb-3">🔍 条件批量删除</h3>        <p className="text-sm text-slate-600 mb-4">设置筛选条件后预览匹配记录，勾选后删除。</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">类型</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none">
              <option value="">全部类型</option>
              {typeEntries.map(([type]) => (
                <option key={type} value={type}>{type || '(空)'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">来源</label>
            <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none">
              <option value="">全部来源</option>
              {sourceEntries.map(([source]) => (
                <option key={source} value={source}>{source || '(空)'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">关键词</label>
            <input type="text" value={filterKeyword} onChange={(e) => setFilterKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePreview()}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
              placeholder="输入编号或名称关键词" />
          </div>
          <div className="flex items-end">
            <button onClick={handlePreview}
              disabled={previewLoading || (!filterType && !filterSource && !filterKeyword.trim())}
              className="w-full px-4 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition">
              {previewLoading ? '搜索中...' : '🔍 预览结果'}
            </button>
          </div>
        </div>

        {/* Preview results */}
        {previewRecords.length > 0 && (
          <div className="border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                  <input type="checkbox" checked={selectedIds.size === matchedTotal && matchedTotal > 0}
                    onChange={toggleSelectAll} className="rounded border-slate-300" />
                  全选
                </label>
                <span className="text-xs text-slate-500">
                  筛选结果：共 {matchedTotal} 条，预览 {previewRecords.length} 条
                  {selectedIds.size > 0 && <span className="text-orange-600 font-medium ml-1">（已选 {selectedIds.size} 条）</span>}
                </span>
              </div>
              <button onClick={() => setShowConfirmFilter(true)}
                disabled={loading || selectedIds.size === 0}
                className="px-4 py-1.5 text-xs bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition font-medium">
                {loading ? '处理中...' : `🗑️ 删除选中 (${selectedIds.size}) 条`}
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {previewRecords.map((r) => (
                <label key={r.id}
                  className={`flex items-center gap-2 px-3 py-2 text-sm border-b border-slate-100 last:border-0 cursor-pointer transition ${
                    selectedIds.has(r.id) ? 'bg-orange-50' : 'hover:bg-slate-50'
                  }`}>
                  <input type="checkbox" checked={selectedIds.has(r.id)}
                    onChange={() => toggleSelect(r.id)} className="rounded border-slate-300" />
                  <span className="font-medium text-primary">{r.title}</span>
                  <span className="text-xs text-slate-400 ml-2">{r.type || '-'}</span>
                  <span className="text-xs text-slate-400">{r.source || '-'}</span>
                  <span className="text-xs text-slate-400 ml-auto truncate max-w-[200px]">
                    {Object.values(r.data || {}).slice(0, 2).join(' | ')}
                  </span>
                </label>
              ))}
              {previewRecords.length === 0 && (
                <p className="text-center text-slate-400 py-4 text-sm">无匹配记录</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Confirm dialogs */}
      {showConfirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowConfirmClear(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="text-3xl mb-2">⚠️</div>
              <h3 className="text-sm font-semibold text-slate-800 mb-2">确认清除全部数据？</h3>
              <p className="text-xs text-slate-500 mb-4">将删除 {stats?.totalCount || 0} 条记录，此操作不可恢复。</p>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowConfirmClear(false)} className="px-3 py-1.5 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">取消</button>
              <button onClick={handleClearAll} className="px-4 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">确认清除</button>
            </div>
          </div>
        </div>
      )}

      {showConfirmFilter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowConfirmFilter(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="text-3xl mb-2"></div>
              <h3 className="text-sm font-semibold text-slate-800 mb-2">确认删除选中记录？</h3>
              <p className="text-xs text-slate-500 mb-4">
                将删除选中的 {selectedIds.size} 条记录，此操作不可恢复。
              </p>
              <div className="text-xs text-slate-600 bg-slate-50 rounded p-2 mb-4 text-left">
                {filterType && <div>类型：{filterType}</div>}
                {filterSource && <div>来源：{filterSource}</div>}
                {filterKeyword && <div>关键词：{filterKeyword}</div>}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowConfirmFilter(false)} className="px-3 py-1.5 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">取消</button>
              <button onClick={handleFilterDelete} className="px-4 py-1.5 text-xs bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium">
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
