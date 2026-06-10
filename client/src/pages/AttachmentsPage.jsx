import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

export default function AttachmentsPage() {
  const navigate = useNavigate();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [records, setRecords] = useState([]);
  const [selectedRecordIds, setSelectedRecordIds] = useState(new Set());
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleSearch = async () => {
    if (!searchKeyword.trim()) return;
    setLoading(true);
    try {
      const res = await api.get('/records', {
        params: { module: 'selection', search: searchKeyword, pageSize: 50 },
      });
      if (res.success) setRecords(res.data || []);
    } catch (err) {
      alert(err.message || '搜索失败');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id) => {
    setSelectedRecordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedRecordIds.size === records.length) {
      setSelectedRecordIds(new Set());
    } else {
      setSelectedRecordIds(new Set(records.map((r) => r.id)));
    }
  };

  // 点击某个记录时加载其附件
  const handleLoadAttachments = async () => {
    if (selectedRecordIds.size === 0) return;
    // 加载第一个选中记录的附件
    const firstId = Array.from(selectedRecordIds)[0];
    try {
      const res = await api.get(`/attachments/record/${firstId}`);
      if (res.success) setAttachments(res.data || []);
    } catch {
      setAttachments([]);
    }
  };

  // 上传附件并关联到所有选中的记录
  const handleUploadMulti = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (selectedRecordIds.size === 0) {
      alert('请先选择至少一条物料记录');
      e.target.value = '';
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('recordIds', JSON.stringify(Array.from(selectedRecordIds)));

    try {
      const res = await api.post('/attachments/upload-multi', formData);
      if (res.success) {
        alert(`上传成功，已关联 ${res.data.linkedCount} 条记录`);
        handleLoadAttachments();
      }
    } catch (err) {
      alert(err.message || '上传失败');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDownload = (att) => {
    const token = localStorage.getItem('token');
    fetch(`/api/attachments/${att.id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = att.file_name;
        link.click();
        window.URL.revokeObjectURL(url);
      })
      .catch(() => alert('下载失败'));
  };

  const handleDelete = async (id) => {
    if (!confirm('确定删除此附件？')) return;
    try {
      const res = await api.delete(`/attachments/${id}`);
      if (res.success) {
        setAttachments((prev) => prev.filter((a) => a.id !== id));
      }
    } catch (err) {
      alert(err.message || '删除失败');
    }
  };

  const selectedCount = selectedRecordIds.size;
  const selectedTitles = records.filter((r) => selectedRecordIds.has(r.id)).map((r) => r.title);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-800">物料选型库 - 附件管理</h1>
        <button onClick={() => navigate('/selection')}
          className="px-3 py-1.5 text-sm bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition">
          ← 返回检索
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 左侧：搜索和多选记录 */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">选择物料记录（可多选）</h3>
          <div className="flex gap-2 mb-3">
            <input type="text" value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
              placeholder="搜索材质编号..." />
            <button onClick={handleSearch} disabled={loading}
              className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition">
              搜索
            </button>
          </div>

          {records.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                  <input type="checkbox" checked={records.length > 0 && selectedRecordIds.size === records.length}
                    onChange={toggleSelectAll} className="rounded border-slate-300" />
                  全选
                </label>
                {selectedCount > 0 && (
                  <span className="text-xs text-primary font-medium">已选 {selectedCount} 条</span>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto space-y-1">
                {records.map((r) => (
                  <label key={r.id}
                    className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg cursor-pointer transition ${
                      selectedRecordIds.has(r.id)
                        ? 'bg-primary/10 border border-primary/30'
                        : 'hover:bg-slate-50 border border-transparent'
                    }`}>
                    <input type="checkbox" checked={selectedRecordIds.has(r.id)}
                      onChange={() => toggleSelect(r.id)} className="rounded border-slate-300" />
                    <span className="font-medium">{r.title}</span>
                    <span className="text-slate-400 text-xs ml-auto">
                      {r.data?.['材质名称'] || r.data?.['物料分类'] || ''}
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}

          {selectedCount > 0 && (
            <button onClick={handleLoadAttachments}
              className="mt-3 w-full px-3 py-2 text-sm bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition">
              📎 查看第一条记录的附件
            </button>
          )}
        </div>

        {/* 右侧：附件列表 + 上传 */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">附件列表</h3>
              {selectedCount > 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  已选：{selectedTitles.slice(0, 3).join('、')}{selectedTitles.length > 3 ? ` 等${selectedCount}条` : ''}
                </p>
              )}
            </div>
            <label className={`px-3 py-1.5 text-sm bg-primary text-white rounded-lg cursor-pointer transition ${
              uploading ? 'opacity-50' : 'hover:bg-primary/90'
            }`}>
              {uploading ? '上传中...' : `📎 上传并关联 (${selectedCount})`}
              <input type="file" className="hidden" onChange={handleUploadMulti} disabled={uploading || selectedCount === 0} />
            </label>
          </div>

          {selectedCount === 0 ? (
            <p className="text-center text-slate-400 py-8">请先在左侧选择一条或多条物料记录</p>
          ) : attachments.length === 0 ? (
            <p className="text-center text-slate-400 py-8">暂无附件，点击上方按钮上传</p>
          ) : (
            <div className="space-y-2">
              {attachments.map((att) => (
                <div key={att.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📄</span>
                    <div>
                      <p className="text-sm font-medium text-slate-700">{att.file_name}</p>
                      <p className="text-xs text-slate-400">
                        {(att.file_size / 1024).toFixed(1)} KB · {att._created_at?.slice(0, 10)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleDownload(att)} className="text-xs text-primary hover:underline">下载</button>
                    <button onClick={() => handleDelete(att.id)} className="text-xs text-red-500 hover:underline">删除</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
