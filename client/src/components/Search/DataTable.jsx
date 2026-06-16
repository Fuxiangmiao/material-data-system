import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// 各模块固定列顺序
const FIXED_KEYS_MAP = {
  material: ['物料编号', '物料名称', '单颗物料净重(g)'],
  selection: ['物料分类', '材质名称', '应用场景'],
  overseas: ['物料编号', '描述', '承认工厂&供应商'],
};

// 各模块默认隐藏列
const HIDDEN_KEYS_MAP = {
  overseas: ['分类', '物料小分类', '物料分类', '单颗物料净重(g)'],
};

function SortableHeader({ id, children, onSort, sortDir }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <th
      ref={setNodeRef}
      style={style}
      className="px-3 py-2 text-left text-xs font-semibold text-slate-600 bg-slate-50 border-b border-slate-200 whitespace-nowrap cursor-grab select-none"
    >
      <div className="flex items-center gap-1" {...attributes} {...listeners}>
        <span onClick={() => onSort(id)} className="hover:text-primary cursor-pointer">
          {children}
        </span>
        {sortDir === id && (
          <span className="text-primary">↑</span>
        )}
        {sortDir === id + '-desc' && (
          <span className="text-primary">↓</span>
        )}
      </div>
    </th>
  );
}

export default function DataTable({
  records,
  module,
  selectedIds,
  onSelectChange,
  loading,
  titleField = '物料编号',
  hiddenColumns = [],
}) {
  const navigate = useNavigate();
  const [sortState, setSortState] = useState({ field: null, dir: null });
  const [columnFilters, setColumnFilters] = useState({});
  const [columnOrder, setColumnOrder] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50); // 默认每页50条

  // 提取所有字段并排序
  const allColumns = useMemo(() => {
    const fieldSet = new Set();
    records.forEach((r) => {
      fieldSet.add('title');
      if (r.data) Object.keys(r.data).forEach((k) => fieldSet.add(k));
    });

    const allKeys = Array.from(fieldSet);
    const fixedKeys = FIXED_KEYS_MAP[module] || [];
    const defaultHidden = HIDDEN_KEYS_MAP[module] || [];

    // 过滤隐藏列
    const visible = allKeys.filter((k) => !defaultHidden.includes(k) && !hiddenColumns.includes(k));

    // 固定列在前
    const ordered = [
      ...fixedKeys.filter((k) => visible.includes(k)),
      ...visible.filter((k) => !fixedKeys.includes(k)),
    ];

    return columnOrder || ordered;
  }, [records, module, columnOrder, hiddenColumns]);

  // 排序
  const sortedRecords = useMemo(() => {
    if (!sortState.field) return records;
    const sorted = [...records];
    const { field, dir } = sortState;
    sorted.sort((a, b) => {
      const aVal = field === 'title' ? a.title : (a.data?.[field] ?? '');
      const bVal = field === 'title' ? b.title : (b.data?.[field] ?? '');
      const cmp = String(aVal).localeCompare(String(bVal), 'zh');
      return dir === 'desc' ? -cmp : cmp;
    });
    return sorted;
  }, [records, sortState]);

  // 列筛选
  const filteredRecords = useMemo(() => {
    const activeFilters = Object.entries(columnFilters).filter(([, v]) => v.trim());
    if (activeFilters.length === 0) return sortedRecords;

    return sortedRecords.filter((r) =>
      activeFilters.every(([field, keyword]) => {
        const val = field === 'title' ? r.title : (r.data?.[field] ?? '');
        return String(val).toLowerCase().includes(keyword.toLowerCase());
      })
    );
  }, [sortedRecords, columnFilters]);

  // 分页计算
  const totalPages = Math.ceil(filteredRecords.length / pageSize);
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // 当筛选条件变化时重置到第一页
  const handleFilterChange = (col, value) => {
    setColumnFilters((prev) => ({ ...prev, [col]: value }));
    setCurrentPage(1);
  };

  const handleSort = (field) => {
    setSortState((prev) => {
      if (prev.field !== field) return { field, dir: 'asc' };
      if (prev.dir === 'asc') return { field, dir: 'desc' };
      return { field: null, dir: null };
    });
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setColumnOrder((prev) => {
        const oldIndex = allColumns.indexOf(active.id);
        const newIndex = allColumns.indexOf(over.id);
        return arrayMove(allColumns, oldIndex, newIndex);
      });
    }
  };

  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectChange(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRecords.length) {
      onSelectChange(new Set());
    } else {
      onSelectChange(new Set(filteredRecords.map((r) => r.id)));
    }
  };

  const getColumnLabel = (col) => {
    if (col === 'title') {
      return module === 'selection' ? '材质编号' : '物料编号';
    }
    return col;
  };

  // 页面大小切换
  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
        加载中...
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        暂无数据，请先搜索或导入数据
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {/* 表格容器 - 支持水平和垂直滚动 */}
      <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr>
                <th className="px-3 py-2 bg-slate-50 border-b border-slate-200 w-10 sticky left-0 z-20">
                  <input
                    type="checkbox"
                    checked={filteredRecords.length > 0 && selectedIds.size === filteredRecords.length}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300"
                  />
                </th>
                <SortableContext items={allColumns} strategy={horizontalListSortingStrategy}>
                  {allColumns.map((col) => (
                    <SortableHeader
                      key={col}
                      id={col}
                      onSort={handleSort}
                      sortDir={sortState.field === col ? (sortState.dir === 'desc' ? col + '-desc' : col) : null}
                    >
                      {getColumnLabel(col)}
                    </SortableHeader>
                  ))}
                </SortableContext>
              </tr>
              {/* 列筛选行 */}
              <tr>
                <th className="px-3 py-1 bg-slate-50 border-b border-slate-200 sticky left-0 z-20" />
                {allColumns.map((col) => (
                  <th key={col} className="px-1 py-1 bg-slate-50 border-b border-slate-200">
                    <input
                      type="text"
                      value={columnFilters[col] || ''}
                      onChange={(e) => handleFilterChange(col, e.target.value)}
                      className="w-full px-1.5 py-0.5 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-primary outline-none"
                      placeholder="筛选..."
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedRecords.map((record, idx) => (
                <tr
                  key={record.id}
                  className={`border-b border-slate-100 hover:bg-blue-50/50 transition ${
                    selectedIds.has(record.id) ? 'bg-primary/5' : ''
                  }`}
                >
                  <td className="px-3 py-2 sticky left-0 bg-white z-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(record.id)}
                      onChange={() => toggleSelect(record.id)}
                      className="rounded border-slate-300"
                    />
                  </td>
                  {allColumns.map((col) => {
                    const val = col === 'title' ? record.title : (record.data?.[col] ?? '');
                    return (
                      <td key={col} className="px-3 py-2 whitespace-nowrap max-w-[200px] truncate">
                        {col === 'title' ? (
                          <button
                            onClick={() => navigate(`/${module}/${record.id}`)}
                            className="text-primary hover:underline font-medium"
                          >
                            {val || '-'}
                          </button>
                        ) : (
                          <span title={val}>{val || '-'}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </DndContext>
      </div>

      {/* 分页控制栏 */}
      <div className="px-4 py-2 bg-slate-50 text-xs text-slate-500 border-t border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span>共 {filteredRecords.length} 条记录</span>
          {selectedIds.size > 0 && <span className="text-primary">已选 {selectedIds.size} 条</span>}

          {/* 每页显示数量选择 */}
          <div className="flex items-center gap-1">
            <span>每页显示：</span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="px-2 py-1 border border-slate-300 rounded text-xs"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
            <span>条</span>
          </div>
        </div>

        {/* 分页导航 */}
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <span>第 {currentPage} / {totalPages} 页</span>
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-2 py-1 border border-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100"
            >
              首页
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2 py-1 border border-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100"
            >
              上一页
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2 py-1 border border-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100"
            >
              下一页
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-2 py-1 border border-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100"
            >
              末页
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
