import { useState } from 'react';

export default function StatisticsPanel({ stats }) {
  const [view, setView] = useState('summary');

  if (!stats) return null;

  const { totalCount, typeDistribution, sourceDistribution, updatedCount } = stats;
  const typeEntries = Object.entries(typeDistribution || {}).sort((a, b) => b[1] - a[1]);
  const sourceEntries = Object.entries(sourceDistribution || {}).sort((a, b) => b[1] - a[1]);
  const maxTypeCount = typeEntries.length > 0 ? typeEntries[0][1] : 1;
  const maxSourceCount = sourceEntries.length > 0 ? sourceEntries[0][1] : 1;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
      {/* 视图切换 */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-700">📊 数据统计</h3>
        <div className="flex gap-1 bg-slate-100 rounded-md p-0.5">
          <button
            onClick={() => setView('summary')}
            className={`px-2.5 py-1 text-xs rounded transition ${view === 'summary' ? 'bg-white shadow-sm text-primary font-medium' : 'text-slate-500'}`}
          >
            摘要
          </button>
          <button
            onClick={() => setView('detail')}
            className={`px-2.5 py-1 text-xs rounded transition ${view === 'detail' ? 'bg-white shadow-sm text-primary font-medium' : 'text-slate-500'}`}
          >
            详情
          </button>
        </div>
      </div>

      {view === 'summary' ? (
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-slate-700">{totalCount}</p>
            <p className="text-xs text-slate-500">总记录</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{updatedCount}</p>
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
      ) : (
        <div className="space-y-4">
          {/* 类型分布 */}
          <div>
            <h4 className="text-xs font-medium text-slate-600 mb-2">类型分布</h4>
            {typeEntries.length === 0 ? (
              <p className="text-xs text-slate-400">暂无数据</p>
            ) : (
              <div className="space-y-1.5">
                {typeEntries.map(([type, count]) => (
                  <div key={type} className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 w-24 truncate">{type || '(空)'}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${(count / maxTypeCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 w-12 text-right">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 来源分布 */}
          <div>
            <h4 className="text-xs font-medium text-slate-600 mb-2">来源分布</h4>
            {sourceEntries.length === 0 ? (
              <p className="text-xs text-slate-400">暂无数据</p>
            ) : (
              <div className="space-y-1.5">
                {sourceEntries.map(([source, count]) => (
                  <div key={source} className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 w-24 truncate">{source || '(空)'}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full transition-all"
                        style={{ width: `${(count / maxSourceCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 w-12 text-right">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
