import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api/client';

const MODULE_TITLES = {
  material: '物料数据管理',
  selection: '物料选型库管理',
  overseas: '海外物料承认管理',
};

export default function RecordDetail({ module }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [record, setRecord] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const isGuest = user?.role === 'guest';

  useEffect(() => {
    loadRecord();
    if (module === 'selection') loadAttachments();
  }, [id]);

  const loadRecord = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/records/${id}`);
      if (res.success) setRecord(res.data);
    } catch (err) {
      console.error('加载详情失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAttachments = async () => {
    try {
      const res = await api.get(`/attachments/record/${id}`);
      if (res.success) setAttachments(res.data || []);
    } catch {}
  };

  const handleDelete = async () => {
    if (!confirm('确定删除此记录？')) return;
    try {
      const res = await api.delete(`/records/${id}`);
      if (res.success) {
        alert('删除成功');
        navigate(`/${module}`);
      }
    } catch (err) {
      alert(err.message || '删除失败');
    }
  };

  const handleDownloadAttachment = (att) => {
    const token = localStorage.getItem('token');
    fetch(`/api/attachments/${att.id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = att.file_name;
        a.click();
        window.URL.revokeObjectURL(url);
      })
      .catch(() => alert('下载失败'));
  };

  const handleDeleteAttachment = async (attId) => {
    if (!confirm('确定删除此附件？')) return;
    try {
      const res = await api.delete(`/attachments/${attId}`);
      if (res.success) {
        setAttachments((prev) => prev.filter((a) => a.id !== attId));
      }
    } catch (err) {
      alert(err.message || '删除失败');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
        加载中...
      </div>
    );
  }

  if (!record) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-slate-400">记录不存在</p>
      </div>
    );
  }

  // Check if a value looks like a file path/bucket reference
  const isFilePath = (val) => {
    if (typeof val !== 'string') return false;
    return val.includes('/') && /\.[a-zA-Z0-9]{2,5}$/.test(val);
  };

  const titleField = module === 'selection' ? '材质编号' : '物料编号';
  const dataFields = Object.entries(record.data || {});

  // Find attachment matching a file path
  const findAttachment = (filePath) => {
    return attachments.find((a) => a.file_path === filePath);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-800">
          {MODULE_TITLES[module]} - 详情
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/${module}`)}
            className="px-3 py-1.5 text-sm bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition"
          >
            ← 返回列表
          </button>
          {!isGuest && (
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              🗑️ 删除
            </button>
          )}
        </div>
      </div>

      {/* 基本信息 */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 bg-slate-50 rounded-lg">
            <span className="text-xs text-slate-500">{titleField}</span>
            <p className="text-lg font-bold text-primary">{record.title || '-'}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg">
            <span className="text-xs text-slate-500">来源</span>
            <p className="text-sm">{record.source || '-'}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg">
            <span className="text-xs text-slate-500">创建时间</span>
            <p className="text-sm">{record._created_at ? new Date(record._created_at).toLocaleString() : '-'}</p>
          </div>
          {record._updated_at && record._updated_at !== record._created_at && (
            <div className="p-3 bg-slate-50 rounded-lg">
              <span className="text-xs text-slate-500">更新时间</span>
              <p className="text-sm">{new Date(record._updated_at).toLocaleString()}</p>
            </div>
          )}
        </div>
      </div>

      {/* 数据字段 */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">数据字段</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {dataFields.map(([key, val]) => (
            <div key={key} className="p-2.5 border border-slate-200 rounded-lg">
              <span className="text-xs text-slate-500">{key}</span>
              <p className="text-sm mt-0.5 break-words">
                {isFilePath(val) ? (
                  <a href={`/api/attachments/${findAttachment(val)?.id || ''}/download`}
                    className="text-primary hover:underline flex items-center gap-1"
                    target="_blank" rel="noopener noreferrer">
                    📄 {val.split('/').pop()}
                  </a>
                ) : (
                  val || <span className="text-slate-300">-</span>
                )}
              </p>
            </div>
          ))}
          {dataFields.length === 0 && (
            <p className="text-sm text-slate-400 col-span-full">暂无数据字段</p>
          )}
        </div>
      </div>

      {/* 附件列表（选型模块） */}
      {module === 'selection' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            📎 附件 ({attachments.length})
          </h3>
          {attachments.length === 0 ? (
            <p className="text-sm text-slate-400">暂无附件</p>
          ) : (
            <div className="space-y-2">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center justify-between p-3 border border-slate-200 rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium">{att.file_name}</p>
                    <p className="text-xs text-slate-400">
                      {(att.file_size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDownloadAttachment(att)}
                      className="text-xs text-primary hover:underline"
                    >
                      下载
                    </button>
                    {!isGuest && (
                      <button
                        onClick={() => handleDeleteAttachment(att.id)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        删除
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
