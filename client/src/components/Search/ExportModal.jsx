import { useState } from 'react';

const MODULE_NAMES = {
  material: '物料数据',
  selection: '选型库',
  overseas: '海外承认',
};

export default function ExportModal({ module, records, selectedIds, onExport, onClose }) {
  const [exportSelected, setExportSelected] = useState(selectedIds.size > 0);
  const [exporting, setExporting] = useState(false);

  const exportRecords = exportSelected
    ? records.filter((r) => selectedIds.has(r.id))
    : records;

  const titleField = module === 'selection' ? '材质编号' : '物料编号';

  // 收集所有列
  const allColumns = [];
  exportRecords.forEach((r) => {
    if (!allColumns.includes('title')) allColumns.push('title');
    if (r.data) Object.keys(r.data).forEach((k) => {
      if (!allColumns.includes(k)) allColumns.push(k);
    });
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      await onExport({ exportSelected });
    } catch {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* 头部 */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">📤 文件导出</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {MODULE_NAMES[module]} 数据导出预览
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
        </div>

        {/* 导出范围选择 */}
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">导出范围</h3>
          <div className="grid grid-cols-2 gap-3">
            {selectedIds.size > 0 && (
              <label
                className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition ${
                  exportSelected ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  checked={exportSelected}
                  onChange={() => setExportSelected(true)}
                  className="text-primary"
                />
                <div>
                  <p className="text-sm font-medium text-slate-800">导出选中</p>
                  <p className="text-xs text-slate-500">{selectedIds.size} 条记录</p>
                </div>
              </label>
            )}
            <label
              className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition ${
                !exportSelected ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                checked={!exportSelected}
                onChange={() => setExportSelected(false)}
                className="text-primary"
              />
              <div>
                <p className="text-sm font-medium text-slate-800">导出全部</p>
                <p className="text-xs text-slate-500">{records.length} 条记录</p>
              </div>
            </label>
          </div>
        </div>

        {/* 导出信息 */}
        <div className="px-6 py-3 border-b border-slate-100">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-slate-50 rounded-lg p-2">
              <p className="text-lg font-bold text-slate-700">{exportRecords.length}</p>
              <p className="text-xs text-slate-500">导出记录数</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-2">
              <p className="text-lg font-bold text-slate-700">{allColumns.length}</p>
              <p className="text-xs text-slate-500">字段数</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-2">
              <p className="text-lg font-bold text-slate-700">.xlsx</p>
              <p className="text-xs text-slate-500">导出格式</p>
            </div>
          </div>
        </div>

        {/* 数据预览 */}
        <div className="flex-1 overflow-auto px-6 py-3">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">数据预览（前 10 条）</h3>
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  {allColumns.slice(0, 8).map((col) => (
                    <th key={col} className="px-2 py-1.5 text-left bg-slate-50 border-b border-slate-200 whitespace-nowrap">
                      {col === 'title' ? titleField : col}
                    </th>
                  ))}
                  {allColumns.length > 8 && (
                    <th className="px-2 py-1.5 text-left bg-slate-50 border-b border-slate-200 text-slate-400">
                      +{allColumns.length - 8} 列
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {exportRecords.slice(0, 10).map((r, idx) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    {allColumns.slice(0, 8).map((col) => (
                      <td key={col} className="px-2 py-1 whitespace-nowrap max-w-[120px] truncate">
                        {col === 'title' ? r.title : (r.data?.[col] || <span className="text-slate-300">-</span>)}
                      </td>
                    ))}
                    {allColumns.length > 8 && <td className="px-2 py-1 text-slate-400">...</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {exportRecords.length > 10 && (
            <p className="text-xs text-slate-400 text-center mt-1">
              仅预览前 10 条，共 {exportRecords.length} 条
            </p>
          )}
        </div>

        {/* 海外模块提示 */}
        {module === 'overseas' && (
          <div className="px-6 py-2">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-blue-700">
              ℹ️ 海外模块导出将仅包含：物料编号、描述、是否完成承认、承认进度、承认工厂
            </div>
          </div>
        )}

        {/* 底部操作 */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition"
          >
            取消
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-6 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition font-medium flex items-center gap-2"
          >
            {exporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                导出中...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                确认导出 Excel
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
