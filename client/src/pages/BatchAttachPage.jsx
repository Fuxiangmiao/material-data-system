import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

export default function BatchAttachPage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...selected]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files || []);
    setFiles((prev) => [...prev, ...dropped]);
  };

  const removeFile = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleBatchUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));
      formData.append('module', 'selection');

      const res = await api.post('/attachments/batch-upload', formData);

      if (res.success) {
        setResult(res.data);
        setFiles([]);
      }
    } catch (err) {
      alert(err.message || '批量上传失败');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-800">物料选型库 - 批量附件上传</h1>
        <button
          onClick={() => navigate('/selection')}
          className="px-3 py-1.5 text-sm bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition"
        >
          ← 返回检索
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="mb-4">
          <p className="text-sm text-slate-600">
            按物料编号匹配上传附件。文件名（不含扩展名）将与材质编号进行匹配。
          </p>
          <p className="text-xs text-slate-400 mt-1">
            例如：文件名为 "CAP-001.pdf" 将匹配材质编号为 "CAP-001" 的记录。
          </p>
        </div>

        {/* 拖拽区 */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition mb-4 ${
            dragOver ? 'border-primary bg-primary/5' : 'border-slate-300'
          }`}
        >
          <div className="text-3xl mb-2">📦</div>
          <p className="text-slate-600 text-sm mb-2">拖拽文件到此处，或点击选择</p>
          <label className="inline-block px-4 py-2 bg-primary text-white rounded-lg cursor-pointer hover:bg-primary-600 transition text-sm">
            选择文件（可多选）
            <input
              type="file"
              className="hidden"
              multiple
              onChange={handleFileSelect}
            />
          </label>
        </div>

        {/* 文件列表 */}
        {files.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-2">
              已选文件 ({files.length})
            </h4>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {files.map((f, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-3 py-1.5 bg-slate-50 rounded text-sm"
                >
                  <span className="truncate">{f.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">
                      {(f.size / 1024).toFixed(1)} KB
                    </span>
                    <button
                      onClick={() => removeFile(idx)}
                      className="text-red-400 hover:text-red-600 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={handleBatchUpload}
              disabled={uploading}
              className="mt-3 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 transition text-sm font-medium"
            >
              {uploading ? '上传中...' : `🚀 批量上传 (${files.length} 个文件)`}
            </button>
          </div>
        )}

        {/* 上传结果 */}
        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-green-800 mb-2">上传结果</h4>
            <p className="text-sm text-green-700">
              ✅ 匹配成功：{result.matched} 个
            </p>
            <p className="text-sm text-green-700">
              ❌ 未匹配：{result.unmatched} 个
            </p>
            {result.errors?.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-medium text-slate-600">未匹配详情：</p>
                <ul className="text-xs text-slate-500 mt-1 space-y-0.5">
                  {result.errors.map((e, i) => (
                    <li key={i}>• {e}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
