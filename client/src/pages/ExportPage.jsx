import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as XLSX from 'xlsx';
import api, { getAllForExport } from '../api/client';
import { matchAndFillRecords } from '../api/compareImport';

const MODULE_TITLES = {
  material: '物料数据管理',
  selection: '物料选型库管理',
  overseas: '海外物料承认管理',
};

function SortableTh({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <th ref={setNodeRef} style={style}
      className="px-2 py-1.5 bg-slate-100 border-b border-slate-200 whitespace-nowrap cursor-grab select-none text-left text-xs font-semibold text-slate-600">
      <span {...attributes} {...listeners}>{children}</span>
    </th>
  );
}

export default function ExportPage() {
  const { module } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('matchFill');
  const [loading, setLoading] = useState(false);

  // Match & Fill state
  const [mfFileName, setMfFileName] = useState(null);
  const [mfOriginalColumns, setMfOriginalColumns] = useState([]);
  const [mfRecords, setMfRecords] = useState(null);

  // Filter Export state
  const [filterKeyword, setFilterKeyword] = useState('');
  const [filterRecords, setFilterRecords] = useState(null);
  const [filterSelectedIds, setFilterSelectedIds] = useState(new Set());
  const [filterColumnOrder, setFilterColumnOrder] = useState(null);

  // === Match & Fill ===
  const handleMfReset = () => {
    setMfFileName(null);
    setMfRecords(null);
    setMfOriginalColumns([]);
    // Reset file input
    const input = document.getElementById('mf-file-input');
    if (input) input.value = '';
  };

  const handleMfUpload = async (file) => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('module', module);
      const res = await api.post('/import/parse', formData);
      if (res.success && res.data?.rows?.length > 0) {
        setMfFileName(file.name);
        setMfOriginalColumns(res.data.columns || Object.keys(res.data.rows[0]));
        setMfRecords(null);
        const matchRes = await matchAndFillRecords(res.data.rows, module);
        if (matchRes.success) {
          setMfRecords(matchRes.data);
        } else {
          setMfRecords({ matchedCount: 0, unmatchedCount: res.data.rows.length, records: res.data.rows });
        }
      } else {
        alert(res.message || '文件解析失败');
      }
    } catch (err) {
      alert(err.message || '文件处理失败');
    } finally {
      setLoading(false);
    }
  };

  const handleMfDownload = () => {
    if (!mfRecords?.records?.length) return;
    // 只保留上传文件中原始列（不添加 DB 新增列）
    const cols = mfOriginalColumns.length > 0 ? mfOriginalColumns : Object.keys(mfRecords.records[0]);
    const records = mfRecords.records;
    const ws = XLSX.utils.aoa_to_sheet([cols, ...records.map((r) => cols.map((k) => r[k] || ''))]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '匹配填充结果');
    XLSX.writeFile(wb, `匹配填充_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // === Filter Export ===
  const handleFilterReset = () => {
    setFilterKeyword('');
    setFilterRecords(null);
    setFilterSelectedIds(new Set());
    setFilterColumnOrder(null);
  };

  const handleFilterSearch = async () => {
    if (!filterKeyword.trim()) return;
    setLoading(true);
    try {
      const res = await getAllForExport(module, filterKeyword);
      if (res.success) {
        setFilterRecords(res.data || []);
        setFilterSelectedIds(new Set());
        setFilterColumnOrder(null);
      }
    } catch (err) {
      alert(err.message || '搜索失败');
    } finally {
      setLoading(false);
    }
  };

  const filterKeys = useMemo(() => {
    if (!filterRecords?.length) return [];
    return Array.from(new Set(filterRecords.flatMap((r) => Object.keys(r.data || {})))).sort();
  }, [filterRecords]);

  const filterDisplayColumns = useMemo(() => {
    const base = ['物料编号', '类型', '来源', ...filterKeys];
    if (filterColumnOrder && filterColumnOrder.length > 0) {
      // Use saved order, add any missing
      const ordered = filterColumnOrder.filter((c) => base.includes(c));
      const missing = base.filter((c) => !filterColumnOrder.includes(c));
      return [...ordered, ...missing];
    }
    return base;
  }, [filterKeys, filterColumnOrder]);

  const toggleFilterSelect = (id) => {
    setFilterSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleFilterSelectAll = () => {
    if (!filterRecords) return;
    if (filterSelectedIds.size === filterRecords.length) {
      setFilterSelectedIds(new Set());
    } else {
      setFilterSelectedIds(new Set(filterRecords.map((r) => r.id)));
    }
  };

  const handleFilterDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setFilterColumnOrder((prev) => {
        const current = prev || filterDisplayColumns;
        const oldIndex = current.indexOf(active.id);
        const newIndex = current.indexOf(over.id);
        return arrayMove(current, oldIndex, newIndex);
      });
    }
  };

  const getCellValue = (record, col) => {
    if (col === '物料编号') return record.title || '';
    if (col === '类型') return record.type || '';
    if (col === '来源') return record.source || '';
    const v = record.data?.[col];
    return typeof v === 'object' && v !== null ? JSON.stringify(v) : v != null ? String(v) : '';
  };

  const handleFilterDownload = () => {
    if (!filterRecords?.length) return;
    const exportRecords = filterSelectedIds.size > 0
      ? filterRecords.filter((r) => filterSelectedIds.has(r.id))
      : filterRecords;

    const cols = filterDisplayColumns;
    const headers = cols;
    const rows = exportRecords.map((item) => cols.map((k) => getCellValue(item, k)));
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '过滤导出');
    XLSX.writeFile(wb, `过滤导出_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">{MODULE_TITLES[module]} - 文件导出</h1>
        <button onClick={() => navigate(`/${module}`)} className="px-3 py-1.5 text-sm bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition">
          ← 返回检索
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-lg shadow-sm p-1">
        <button onClick={() => setActiveTab('matchFill')}
          className={`flex-1 px-4 py-2 text-sm rounded-md transition font-medium ${activeTab === 'matchFill' ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
          🔄 匹配填充
        </button>
        <button onClick={() => setActiveTab('filterExport')}
          className={`flex-1 px-4 py-2 text-sm rounded-md transition font-medium ${activeTab === 'filterExport' ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
          🔍 过滤导出
        </button>
      </div>

      {/* === Match & Fill === */}
      {activeTab === 'matchFill' && (
        <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
          <p className="text-sm text-slate-600">上传 Excel/CSV 文件，系统自动匹配数据库中的记录并填充空值单元格（仅填充文件中已有的列），然后下载补充完整后的文件。</p>

          <div className="flex items-center gap-3">
            <label className="inline-block px-4 py-2 bg-primary text-white rounded-lg cursor-pointer hover:bg-primary/90 transition">
              选择 Excel / CSV 文件
              <input id="mf-file-input" type="file" className="hidden" accept=".xlsx,.xls,.csv"
                onChange={(e) => handleMfUpload(e.target.files[0])} />
            </label>
            {mfFileName && (
              <button onClick={handleMfReset}
                className="px-3 py-2 text-sm bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition">
                ↻ 重置
              </button>
            )}
          </div>
          {mfFileName && <p className="text-xs text-slate-500">当前文件：{mfFileName}</p>}

          {loading && (
            <div className="text-center text-sm text-primary py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary inline-block mr-2"></div>
              处理中...
            </div>
          )}

          {mfRecords && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-slate-700">{mfRecords.records.length}</p>
                  <p className="text-xs text-slate-500">总计</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-green-600">{mfRecords.matchedCount}</p>
                  <p className="text-xs text-green-600">已匹配填充</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-slate-400">{mfRecords.unmatchedCount}</p>
                  <p className="text-xs text-slate-400">未匹配</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={handleMfDownload}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium">
                  📥 下载填充结果
                </button>
                <button onClick={handleMfReset}
                  className="px-4 py-2 text-sm bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition">
                  ↻ 重置
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* === Filter Export === */}
      {activeTab === 'filterExport' && (
        <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
          <p className="text-sm text-slate-600">输入关键词搜索记录，预览匹配结果后支持单选/多选导出为 Excel。可拖拽列名调整顺序。</p>

          <div className="flex gap-3">
            <input value={filterKeyword} onChange={(e) => setFilterKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFilterSearch()}
              placeholder="输入搜索关键词..."
              className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none" />
            <button onClick={handleFilterSearch} disabled={loading || !filterKeyword.trim()}
              className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition">
              {loading ? '搜索中...' : '🔍 搜索'}
            </button>
            {filterRecords && (
              <button onClick={handleFilterReset}
                className="px-4 py-2 text-sm bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition">
                ↻ 重置
              </button>
            )}
          </div>

          {filterRecords && (
            <>
              {/* Toolbar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-600">
                    找到 <strong>{filterRecords.length}</strong> 条记录
                    {filterSelectedIds.size > 0 && <span className="text-primary ml-2">已选 {filterSelectedIds.size} 条</span>}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleFilterDownload} disabled={filterRecords.length === 0}
                    className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition font-medium">
                    📥 {filterSelectedIds.size > 0 ? `导出选中(${filterSelectedIds.size})` : '导出全部'}
                  </button>
                  <button onClick={handleFilterReset}
                    className="px-4 py-2 text-sm bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition">
                    ↻ 重置
                  </button>
                </div>
              </div>

              {/* Data table with DnD columns, checkboxes, full attributes, scrollbars */}
              <div className="overflow-auto max-h-[500px] border border-slate-200 rounded-lg">
                <DndContext collisionDetection={closestCenter} onDragEnd={handleFilterDragEnd}>
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 z-10">
                      <tr>
                        <th className="px-2 py-1.5 bg-slate-100 border-b border-slate-200 w-10 sticky left-0 z-20">
                          <input type="checkbox"
                            checked={filterRecords.length > 0 && filterSelectedIds.size === filterRecords.length}
                            onChange={toggleFilterSelectAll} className="rounded border-slate-300" />
                        </th>
                        <SortableContext items={filterDisplayColumns} strategy={horizontalListSortingStrategy}>
                          {filterDisplayColumns.map((col) => (
                            <SortableTh key={col} id={col}>{col}</SortableTh>
                          ))}
                        </SortableContext>
                      </tr>
                    </thead>
                    <tbody>
                      {filterRecords.map((r) => (
                        <tr key={r.id} className={`border-b border-slate-100 ${filterSelectedIds.has(r.id) ? 'bg-primary/5' : 'hover:bg-blue-50/50'}`}>
                          <td className="px-2 py-1.5 sticky left-0 bg-white z-10">
                            <input type="checkbox" checked={filterSelectedIds.has(r.id)}
                              onChange={() => toggleFilterSelect(r.id)} className="rounded border-slate-300" />
                          </td>
                          {filterDisplayColumns.map((col) => (
                            <td key={col} className="px-2 py-1.5 whitespace-nowrap max-w-[200px] truncate">
                              {getCellValue(r, col) || <span className="text-slate-300">-</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DndContext>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
