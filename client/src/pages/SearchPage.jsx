import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api, { verifyPassword, getAllForExport } from '../api/client';
import { getStatistics } from '../api/statistics';
import SearchForm from '../components/Search/SearchForm';
import StatisticsPanel from '../components/Search/StatisticsPanel';
import DataTable from '../components/Search/DataTable';
import DeleteConfirmDialog from '../components/DeleteConfirmDialog';
import * as XLSX from 'xlsx';

const PAGE_SIZE = 20;
const MODULE_LABELS = { material: '物料数据', selection: '选型库', overseas: '海外承认' };

export default function SearchPage({ module, title }) {
  const { user } = useAuth();
  const storagePrefix = `search_${module}`;
  const isGuest = user?.role === 'guest';

  // 从 sessionStorage 恢复状态（从详情页返回时不丢失搜索结果）
  const savedState = useMemo(() => {
    try {
      const saved = sessionStorage.getItem(storagePrefix);
      if (!saved) return null;
      return JSON.parse(saved);
    } catch { return null; }
  }, [storagePrefix]);

  const [records, setRecords] = useState(savedState?.items || []);
  const [total, setTotal] = useState(savedState?.total || 0);
  const [page, setPage] = useState(savedState?.page || 1);
  const [loading, setLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState(savedState?.searchKeyword || '');
  const [currentFieldFilters, setCurrentFieldFilters] = useState(savedState?.currentFieldFilters || {});
  const [stats, setStats] = useState(savedState?.stats || null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [hasSearched, setHasSearched] = useState(savedState?.hasSearched || false);
  const [tableView, setTableView] = useState('table');
  const [expandedId, setExpandedId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Save state to sessionStorage
  const saveState = useCallback(() => {
    try {
      sessionStorage.setItem(storagePrefix, JSON.stringify({
        searchKeyword, items: records, total, page, stats, hasSearched, currentFieldFilters,
      }));
    } catch {}
  }, [storagePrefix, searchKeyword, records, total, page, stats, hasSearched, currentFieldFilters]);

  useEffect(() => {
    if (hasSearched && (records.length > 0 || total > 0)) saveState();
  }, [records, total, hasSearched, saveState]);

  // Fetch results from server
  const fetchResults = useCallback(async (kw, p, fieldFilters) => {
    setLoading(true);
    try {
      const activeFilters = {};
      for (const [k, v] of Object.entries(fieldFilters || {})) {
        if (v && v.trim()) activeFilters[k] = v.trim();
      }
      const params = {
        module, search: kw, page: p, pageSize: PAGE_SIZE,
        ...(Object.keys(activeFilters).length > 0 ? { fieldFilters: JSON.stringify(activeFilters) } : {}),
      };
      const res = await api.get('/records', { params });
      if (res.success) {
        setRecords(res.data || []);
        setTotal(res.pagination?.total || 0);
        setExpandedId(null);
      }
    } catch (err) {
      console.error('搜索失败:', err);
    } finally {
      setLoading(false);
    }
  }, [module]);

  // Fetch statistics
  const fetchStats = useCallback(async (kw, fieldFilters) => {
    try {
      const res = await getStatistics(module, kw, fieldFilters);
      if (res.success) setStats(res.data);
    } catch {}
  }, [module]);

  // Search handler
  const handleSearch = useCallback((kw, fieldFilters) => {
    setSearchKeyword(kw);
    setCurrentFieldFilters(fieldFilters);
    setPage(1);
    setSelectedIds(new Set());
    setHasSearched(true);
    fetchResults(kw, 1, fieldFilters);
    if (kw || Object.values(fieldFilters).some((v) => v && v.trim())) {
      fetchStats(kw, fieldFilters);
    } else {
      setStats(null); setRecords([]); setTotal(0);
    }
  }, [fetchResults, fetchStats]);

  // Reset handler
  const handleReset = useCallback(() => {
    setSearchKeyword(''); setRecords([]); setTotal(0); setStats(null);
    setPage(1); setSelectedIds(new Set()); setHasSearched(false);
    setCurrentFieldFilters({});
    try { sessionStorage.removeItem(storagePrefix); } catch {}
  }, [storagePrefix]);

  // Page change
  const handlePageChange = useCallback((newPage) => {
    setPage(newPage);
    fetchResults(searchKeyword, newPage, currentFieldFilters);
  }, [searchKeyword, currentFieldFilters, fetchResults]);

  // Export to Excel (client-side using xlsx)
  const handleExport = useCallback(async () => {
    if (!hasSearched) return;
    setExporting(true);
    try {
      let exportItems;
      if (selectedIds.size > 0) {
        exportItems = records.filter((r) => selectedIds.has(r.id));
      } else {
        const res = await getAllForExport(module, searchKeyword);
        exportItems = res.success ? res.data : [];
      }

      const keys = Array.from(new Set(exportItems.flatMap((i) => Object.keys(i.data || {})))).sort();
      const headers = ['物料编号', '类型', '来源', ...keys];
      const rows = exportItems.map((item) => [
        item.title, item.type || '', item.source || '',
        ...keys.map((k) => {
          const v = item.data?.[k];
          return typeof v === 'object' && v !== null ? JSON.stringify(v) : v != null ? String(v) : '';
        }),
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, MODULE_LABELS[module] || module);
      XLSX.writeFile(wb, `${MODULE_LABELS[module] || module}_导出_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      alert(err.message || '导出失败');
    } finally {
      setExporting(false);
    }
  }, [searchKeyword, module, hasSearched, selectedIds, records]);

  // Batch delete with password verification
  const handleDeleteClick = () => {
    if (selectedIds.size === 0) return;
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async (password) => {
    const verifyRes = await verifyPassword(password);
    if (!verifyRes.success) throw new Error(verifyRes.message || '密码验证失败');

    setDeleting(true);
    try {
      const res = await api.post('/records/batch-delete', { ids: Array.from(selectedIds), password });
      if (res.success) {
        alert(res.message);
        setSelectedIds(new Set());
        setDeleteConfirmOpen(false);
        fetchResults(searchKeyword, page, currentFieldFilters);
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">{title || '数据检索'}</h1>
      </div>

      {/* Search Form */}
      <SearchForm
        module={module}
        moduleLabel={title || '数据检索'}
        loading={loading}
        hasSearched={hasSearched}
        initialKeyword={searchKeyword}
        initialFieldFilters={currentFieldFilters}
        onSearch={handleSearch}
        onReset={handleReset}
      />

      {/* Statistics */}
      {total > 0 && stats && <StatisticsPanel stats={stats} />}

      {/* Results toolbar */}
      {hasSearched && (
        <div className="bg-white rounded-lg shadow-sm px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>共 <strong className="text-slate-800">{total}</strong> 条记录</span>
            {selectedIds.size > 0 && (
              <span className="text-primary">已选 <strong>{selectedIds.size}</strong> 条</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex gap-1 bg-slate-100 rounded-md p-0.5">
              <button
                onClick={() => setTableView('table')}
                className={`px-2.5 py-1 text-xs rounded transition ${tableView === 'table' ? 'bg-white shadow-sm text-primary font-medium' : 'text-slate-500'}`}
              >
                📋 表格
              </button>
              <button
                onClick={() => setTableView('card')}
                className={`px-2.5 py-1 text-xs rounded transition ${tableView === 'card' ? 'bg-white shadow-sm text-primary font-medium' : 'text-slate-500'}`}
              >
                📄 卡片
              </button>
            </div>
            {selectedIds.size > 0 && !isGuest && (
              <button onClick={handleDeleteClick} disabled={deleting}
                className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition">
                🗑️ 删除选中 ({selectedIds.size})
              </button>
            )}
            <button onClick={handleExport} disabled={exporting || !hasSearched}
              className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition font-medium">
              {exporting ? '导出中...' : selectedIds.size > 0 ? `📤 导出选中(${selectedIds.size})` : '📤 导出全部'}
            </button>
          </div>
        </div>
      )}

      {/* Table View */}
      {tableView === 'table' ? (
        <DataTable
          records={records}
          module={module}
          selectedIds={selectedIds}
          onSelectChange={setSelectedIds}
          loading={loading}
        />
      ) : (
        /* Card View */
        <div className="space-y-2">
          {!loading && records.length === 0 && hasSearched && (
            <div className="text-center py-16 text-slate-400">未找到记录</div>
          )}
          {records.map((item) => (
            <div key={item.id} className="bg-white rounded-lg shadow-sm border border-slate-200 hover:border-primary/40 transition">
              <div className="p-3 flex items-center gap-3">
                {!isGuest && (
                  <input type="checkbox" checked={selectedIds.has(item.id)}
                    onChange={() => {
                      const next = new Set(selectedIds);
                      if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                      setSelectedIds(next);
                    }}
                    className="rounded border-slate-300 shrink-0" />
                )}
                <button
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  className="text-slate-400 hover:text-slate-600 shrink-0"
                >
                  {expandedId === item.id ? '▲' : '▼'}
                </button>
                <div className="flex-1 min-w-0">
                  <a href={`/${module}/${item.id}`}
                    className="text-sm font-medium text-primary hover:underline truncate block">
                    {item.title}
                  </a>
                  <div className="flex flex-wrap gap-2 mt-1 text-xs text-slate-500">
                    {item.type && <span className="px-1.5 py-0.5 bg-slate-100 rounded">{item.type}</span>}
                    <span>来源：{item.source || '-'}</span>
                    <span>{item._created_at ? new Date(item._created_at).toLocaleString() : ''}</span>
                  </div>
                </div>
              </div>
              {expandedId === item.id && (
                <div className="px-3 pb-3 pt-0 border-t border-slate-100">
                  <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    {Object.entries(item.data || {}).map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <span className="text-slate-500 shrink-0">{key}：</span>
                        <span className="text-slate-700 break-all">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-lg shadow-sm px-4 py-3">
          <span className="text-xs text-slate-500">第 {page} / {totalPages} 页</span>
          <div className="flex gap-1">
            <button onClick={() => handlePageChange(page - 1)} disabled={page <= 1}
              className="px-2.5 py-1 text-xs bg-slate-100 text-slate-600 rounded hover:bg-slate-200 disabled:opacity-30 transition">
              上一页
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i;
              return (
                <button key={p} onClick={() => handlePageChange(p)}
                  className={`w-7 h-7 text-xs rounded transition ${p === page ? 'bg-primary text-white font-medium' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {p}
                </button>
              );
            })}
            <button onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages}
              className="px-2.5 py-1 text-xs bg-slate-100 text-slate-600 rounded hover:bg-slate-200 disabled:opacity-30 transition">
              下一页
            </button>
          </div>
        </div>
      )}

      <DeleteConfirmDialog
        open={deleteConfirmOpen}
        count={selectedIds.size}
        username={user?.username || ''}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  );
}
