import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import api from '../api/client';
import { compareImportData } from '../api/compareImport';

const MODULE_TITLES = {
  material: '物料数据管理',
  selection: '物料选型库管理',
  overseas: '海外物料承认管理',
};

const BATCH_SIZE = 50;

export default function ImportPage() {
  const { module } = useParams();
  const navigate = useNavigate();

  const [files, setFiles] = useState([]); // { id, file, status: 'pending'|'parsing'|'parsed'|'error', records: [], error }
  const [textInput, setTextInput] = useState('');
  const [textLoading, setTextLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('file');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [compareResult, setCompareResult] = useState(null); // { totalCount, newCount, identicalCount, differentCount, statusMap }
  const [isComparing, setIsComparing] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importProgress, setImportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const cancelRef = useRef(false);

  const titleLabel = module === 'selection' ? '材质编号' : '物料编号';

  // Parse a file via server
  const parseFile = async (fileItem) => {
    setFiles((prev) => prev.map((f) => f.id === fileItem.id ? { ...f, status: 'parsing' } : f));
    try {
      const formData = new FormData();
      formData.append('file', fileItem.file);
      formData.append('module', module);
      const res = await api.post('/import/parse', formData);
      if (res.success && res.data?.rows?.length > 0) {
        const records = res.data.rows.map((row, i) => ({
          id: `${fileItem.id}-${i}`,
          data: row,
        }));
        setFiles((prev) => prev.map((f) => f.id === fileItem.id ? { ...f, status: 'parsed', records } : f));
        // Auto-select new records
        setSelectedIds((prev) => {
          const next = new Set(prev);
          records.forEach((r) => next.add(r.id));
          return next;
        });
        // 自动跳转预览页
        setActiveTab('preview');
      } else {
        setFiles((prev) => prev.map((f) => f.id === fileItem.id ? { ...f, status: 'error', error: res.message || '解析无数据' } : f));
      }
    } catch (err) {
      setFiles((prev) => prev.map((f) => f.id === fileItem.id ? { ...f, status: 'error', error: err.message || '解析失败' } : f));
    }
  };

  // Process pending files queue
  useEffect(() => {
    const pending = files.filter((f) => f.status === 'pending');
    if (pending.length > 0) {
      pending.forEach((f) => parseFile(f));
    }
  }, [files]);

  // Run compare after all files parsed
  const allParsed = files.length > 0 && files.every((f) => f.status === 'parsed' || f.status === 'error');
  const hasParsed = files.some((f) => f.status === 'parsed');

  const runCompare = useCallback(async () => {
    const allRecords = files.flatMap((f) => f.status === 'parsed' ? f.records : []);
    if (allRecords.length === 0) return;

    setIsComparing(true);
    try {
      const titles = allRecords.map((r) => r.data[titleLabel] || r.data['物料编号'] || '').filter(Boolean);
      const uniqueTitles = [...new Set(titles)];

      if (uniqueTitles.length === 0) {
        setCompareResult({ totalCount: allRecords.length, newCount: allRecords.length, identicalCount: 0, differentCount: 0, statusMap: {} });
        return;
      }

      const res = await compareImportData(uniqueTitles, module);
      if (!res.success) throw new Error(res.message);

      const dbMap = new Map();
      (res.data?.existingRecords || []).forEach((r) => dbMap.set(r.title, r.data));

      let newCount = 0, identicalCount = 0, differentCount = 0;
      const statusMap = {};
      const identicalIds = new Set();

      for (const item of allRecords) {
        const t = item.data[titleLabel] || item.data['物料编号'] || '';
        const dbData = dbMap.get(t);
        if (!dbData) {
          statusMap[item.id] = 'new';
          newCount++;
        } else {
          // Check if identical
          const allKeys = new Set([...Object.keys(dbData), ...Object.keys(item.data)]);
          let isSame = true;
          for (const k of allKeys) {
            if (k === titleLabel || k === '物料编号') continue;
            if (String(dbData[k] ?? '').trim() !== String(item.data[k] ?? '').trim()) {
              isSame = false; break;
            }
          }
          if (isSame) {
            statusMap[item.id] = 'identical';
            identicalCount++;
            identicalIds.add(item.id);
          } else {
            statusMap[item.id] = 'different';
            differentCount++;
          }
        }
      }

      // Deselect identical records
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of identicalIds) next.delete(id);
        return next;
      });

      setCompareResult({ totalCount: allRecords.length, newCount, identicalCount, differentCount, statusMap });
    } catch (err) {
      console.error('数据比对失败:', err);
    } finally {
      setIsComparing(false);
    }
  }, [files, module, titleLabel]);

  useEffect(() => {
    if (allParsed && hasParsed && !compareResult && !isComparing) {
      runCompare();
    }
  }, [allParsed, hasParsed, compareResult, isComparing, runCompare]);

  // Dropzone
  const onDrop = useCallback((accepted) => {
    const newFiles = accepted.map((file) => ({
      file,
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: 'pending',
      records: [],
    }));
    setFiles((prev) => [...prev, ...newFiles]);
    setImportResult(null);
    setCompareResult(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.gif'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
    },
    multiple: true,
  });

  // Text parse
  const handleTextParse = async () => {
    if (!textInput.trim()) return;
    setTextLoading(true);
    try {
      const res = await api.post('/import/parse-text', { text: textInput, module });
      if (res.success && res.data?.rows?.length > 0) {
        const textFileId = `text-${Date.now()}`;
        const records = res.data.rows.map((row, i) => ({ id: `${textFileId}-${i}`, data: row }));
        setFiles((prev) => [...prev, { id: textFileId, file: { name: '文本输入' }, status: 'parsed', records }]);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          records.forEach((r) => next.add(r.id));
          return next;
        });
        setActiveTab('preview');
        setCompareResult(null);
      } else {
        alert(res.message || '解析失败');
      }
    } catch (err) {
      alert(err.message || '文本解析失败');
    } finally {
      setTextLoading(false);
    }
  };

  // Chunked batch import
  const handleImport = async () => {
    const allRecords = files.flatMap((f) => f.status === 'parsed' ? f.records : []);
    const selected = allRecords.filter((r) => selectedIds.has(r.id));
    if (selected.length === 0) { alert('请先选择要导入的记录'); return; }

    setIsImporting(true);
    setImportProgress(0);
    cancelRef.current = false;

    const rows = selected.map((r) => r.data);
    const totalBatches = Math.ceil(rows.length / BATCH_SIZE);
    let created = 0, updated = 0, skipped = 0, failed = 0, cancelled = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      if (cancelRef.current) {
        cancelled += rows.length - i;
        break;
      }
      try {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const res = await api.post('/import/confirm', { rows: batch, module });
        if (res.success) {
          created += res.data?.created || 0;
          updated += res.data?.updated || 0;
          skipped += res.data?.skipped || 0;
        } else {
          failed += batch.length;
        }
      } catch {
        failed += Math.min(BATCH_SIZE, rows.length - i);
      }
      setImportProgress(Math.round(((Math.floor(i / BATCH_SIZE) + 1) / totalBatches) * 100));
    }

    setImportProgress(100);
    setImportResult({
      created, updated, skipped, cancelled, failed,
      message: `导入完成：新增 ${created} 条，更新 ${updated} 条，跳过 ${skipped} 条${cancelled > 0 ? `，取消 ${cancelled} 条` : ''}${failed > 0 ? `，失败 ${failed} 条` : ''}`,
    });

    // Remove imported files
    const importedFileIds = new Set(selected.map((r) => r.id.split('-').slice(0, -1).join('-')));
    setFiles((prev) => prev.filter((f) => !importedFileIds.has(f.id)));
    setSelectedIds(new Set());
    setCompareResult(null);
    setIsImporting(false);
  };

  const removeFile = (id) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const k of Array.from(next)) { if (k.startsWith(`${id}-`)) next.delete(k); }
      return next;
    });
    setCompareResult(null);
  };

  const handleReset = () => {
    setFiles([]); setSelectedIds(new Set()); setCompareResult(null);
    setImportResult(null); setTextInput('');
  };

  const allRecords = files.flatMap((f) => f.status === 'parsed' ? f.records : []);
  const displayRecords = allRecords.filter((r) => compareResult?.statusMap?.[r.id] !== 'identical');
  const fieldKeys = Array.from(new Set(allRecords.flatMap((r) => Object.keys(r.data))));

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === displayRecords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayRecords.map((r) => r.id)));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">{MODULE_TITLES[module]} - 文件导入</h1>
        <button onClick={() => navigate(`/${module}`)} className="px-3 py-1.5 text-sm bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition">
          ← 返回检索
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-lg shadow-sm p-1">
        {[
          { key: 'file', label: '📁 文件上传' },
          { key: 'text', label: '📝 文本粘贴' },
          { key: 'preview', label: `📋 预览导入 ${allRecords.length > 0 ? `(${allRecords.length})` : ''}` },
        ].map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-4 py-2 text-sm rounded-md transition font-medium ${activeTab === tab.key ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* File Upload Tab */}
      {activeTab === 'file' && (
        <div className="space-y-4">
          <div {...getRootProps()}
            className={`bg-white rounded-lg shadow-sm p-8 text-center border-2 border-dashed cursor-pointer transition ${isDragActive ? 'border-primary bg-primary/5' : 'border-slate-300 hover:border-primary/50'}`}>
            <input {...getInputProps()} />
            <div className="text-4xl mb-3">📂</div>
            <p className="text-slate-600">{isDragActive ? '松开鼠标上传文件' : '拖拽文件到此处，或点击选择文件'}</p>
            <p className="text-xs text-slate-400 mt-2">支持 Excel / Word / PDF / 图片格式，可多选</p>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-4 space-y-2">
              {files.map((f) => (
                <div key={f.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm">
                      {f.status === 'parsing' ? '⏳' : f.status === 'parsed' ? '✅' : f.status === 'error' ? '❌' : '📄'}
                    </span>
                    <span className="text-sm text-slate-700 truncate">{f.file.name}</span>
                    {f.status === 'parsed' && <span className="text-xs text-slate-500">({f.records.length} 条)</span>}
                    {f.status === 'error' && <span className="text-xs text-red-500">{f.error}</span>}
                    {f.status === 'parsing' && <span className="text-xs text-primary">解析中...</span>}
                  </div>
                  <button onClick={() => removeFile(f.id)} className="text-slate-400 hover:text-red-500 text-xs">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Text Tab */}
      {activeTab === 'text' && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <textarea value={textInput} onChange={(e) => setTextInput(e.target.value)}
            className="w-full h-64 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none resize-none font-mono"
            placeholder="粘贴 Markdown 表格或文本数据..." />
          <button onClick={handleTextParse} disabled={!textInput.trim() || textLoading}
            className="mt-3 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition">
            {textLoading ? '解析中...' : '解析文本'}
          </button>
        </div>
      )}

      {/* Compare Progress */}
      {isComparing && (
        <div className="bg-white rounded-lg shadow-sm p-4 text-center text-sm text-primary">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary inline-block mr-2"></div>
          正在与数据库比对...
        </div>
      )}

      {/* Compare Summary */}
      {compareResult && !isComparing && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-medium text-slate-700 mb-3">📊 数据比对结果</h3>
          <div className="grid grid-cols-4 gap-3 mb-3">
            <div className="bg-slate-50 rounded-lg p-2 text-center">
              <p className="text-xl font-bold text-slate-700">{compareResult.totalCount}</p>
              <p className="text-xs text-slate-500">总计</p>
            </div>
            <div className="bg-green-50 rounded-lg p-2 text-center">
              <p className="text-xl font-bold text-green-600">{compareResult.newCount}</p>
              <p className="text-xs text-green-600">新增</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-2 text-center">
              <p className="text-xl font-bold text-blue-600">{compareResult.differentCount}</p>
              <p className="text-xs text-blue-600">差异（更新）</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-2 text-center">
              <p className="text-xl font-bold text-slate-400">{compareResult.identicalCount}</p>
              <p className="text-xs text-slate-400">相同（已过滤）</p>
            </div>
          </div>
        </div>
      )}

      {/* Preview Tab */}
      {activeTab === 'preview' && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          {displayRecords.length === 0 ? (
            <p className="text-center text-slate-400 py-8">暂无解析数据，请先上传文件或粘贴文本</p>
          ) : (
            <>
              {/* Toolbar */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={selectedIds.size === displayRecords.length && displayRecords.length > 0}
                      onChange={toggleSelectAll} className="rounded border-slate-300" />
                    全选
                  </label>
                  <span className="text-sm text-slate-500">
                    已选 {selectedIds.size} / {displayRecords.length} 条
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleReset} className="px-3 py-1.5 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition">
                    🔄 重置
                  </button>
                  <button onClick={() => { cancelRef.current = true; }} disabled={!isImporting}
                    className="px-3 py-1.5 text-xs bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200 disabled:opacity-30 transition">
                    ⏹ 取消导入
                  </button>
                  <button onClick={handleImport} disabled={isImporting || selectedIds.size === 0}
                    className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition font-medium">
                    {isImporting ? `导入中 ${importProgress}%` : `✅ 确认导入 (${selectedIds.size})`}
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              {isImporting && (
                <div className="mb-3">
                  <div className="w-full bg-slate-200 rounded-full h-3">
                    <div className="bg-green-500 h-3 rounded-full transition-all" style={{ width: `${importProgress}%` }} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1 text-center">{importProgress}%</p>
                </div>
              )}

              {/* Import result */}
              {importResult && (
                <div className="mb-3 p-3 bg-green-50 rounded-lg text-sm text-green-700">
                  {importResult.message}
                </div>
              )}

              {/* Data table */}
              <div className="overflow-x-auto max-h-96 overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th className="px-2 py-1.5 bg-slate-100 border-b border-slate-200 w-10">
                        <input type="checkbox" checked={selectedIds.size === displayRecords.length && displayRecords.length > 0}
                          onChange={toggleSelectAll} className="rounded border-slate-300" />
                      </th>
                      <th className="px-2 py-1.5 bg-slate-100 border-b border-slate-200 w-16">状态</th>
                      {fieldKeys.map((k) => (
                        <th key={k} className="px-2 py-1.5 bg-slate-100 border-b border-slate-200 whitespace-nowrap">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayRecords.slice(0, 100).map((rec) => {
                      const status = compareResult?.statusMap?.[rec.id];
                      return (
                        <tr key={rec.id} className={`border-b border-slate-100 ${
                          status === 'new' ? 'bg-green-50/50' : status === 'different' ? 'bg-blue-50/50' : 'bg-slate-50/50 opacity-60'
                        }`}>
                          <td className="px-2 py-1.5">
                            <input type="checkbox" checked={selectedIds.has(rec.id)} onChange={() => toggleSelect(rec.id)}
                              className="rounded border-slate-300" />
                          </td>
                          <td className="px-2 py-1.5">
                            <span className={`px-1.5 py-0.5 text-xs rounded border ${
                              status === 'new' ? 'bg-green-100 text-green-700 border-green-200' :
                              status === 'different' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                              'bg-slate-100 text-slate-500 border-slate-200'
                            }`}>
                              {status === 'new' ? '新增' : status === 'different' ? '更新' : status === 'identical' ? '相同' : '-'}
                            </span>
                          </td>
                          {fieldKeys.map((k) => (
                            <td key={k} className="px-2 py-1.5 whitespace-nowrap max-w-[150px] truncate">
                              {rec.data[k] || <span className="text-slate-300">-</span>}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {displayRecords.length > 100 && (
                  <p className="text-xs text-slate-400 text-center py-2">仅预览前 100 条，共 {displayRecords.length} 条</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
