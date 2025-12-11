import React from 'react';
import { HistoryItem } from '../types';
import { Clock, Activity, ArrowRight, Database } from 'lucide-react';
import { clsx } from 'clsx';

interface ReasoningGalleryProps {
  history: HistoryItem[];
  activeItemId: string | null;
  onSelectHistory: (item: HistoryItem) => void;
}

export const ReasoningGallery: React.FC<ReasoningGalleryProps> = ({
  history,
  activeItemId,
  onSelectHistory,
}) => {

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200 w-full overflow-hidden">
      
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
        <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2 uppercase tracking-wider">
          <Database size={14} className="text-blue-500" />
          Reasoning History
        </h2>
        <span className="text-xs text-slate-500">{history.length} Records</span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
          <div className="divide-y divide-slate-100">
              {history.length === 0 && (
                  <div className="p-8 text-center text-slate-400 text-xs">
                      No history yet. Ask a question to start building the reasoning gallery.
                  </div>
              )}
              {history.slice().reverse().map((item) => (
                  <button
                      key={item.id}
                      onClick={() => onSelectHistory(item)}
                      className={clsx(
                        "w-full text-left p-4 transition-all group flex gap-3 items-start border-l-2",
                        activeItemId === item.id 
                          ? "bg-blue-50 border-blue-500" 
                          : "hover:bg-slate-50 border-transparent hover:border-slate-300"
                      )}
                  >
                      {/* Thumbnail Image - WIDE LANDSCAPE */}
                      <div className="w-32 h-16 rounded bg-slate-100 border border-slate-200 overflow-hidden shrink-0 mt-0.5 relative group-hover:border-slate-300 transition-colors shadow-sm">
                        {item.thumbnail ? (
                          <img src={item.thumbnail} alt="Graph" className="w-full h-full object-cover mix-blend-multiply opacity-90 group-hover:opacity-100 transition-opacity" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-50">
                            <Activity size={16} />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col justify-center h-16">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                                <Clock size={10} />
                                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {activeItemId === item.id && (
                              <span className="text-[10px] text-blue-600 font-bold px-1.5 py-0.5 bg-blue-100 rounded">ACTIVE</span>
                            )}
                        </div>
                        <h4 className={clsx(
                          "text-sm font-medium line-clamp-1 mb-0.5 transition-colors",
                          activeItemId === item.id ? "text-blue-600" : "text-slate-700 group-hover:text-slate-900"
                        )}>
                            {item.question}
                        </h4>
                        <p className="text-xs text-slate-500 line-clamp-1 opacity-80">
                            {item.answer}
                        </p>
                      </div>
                      
                      <div className="self-center pl-2">
                        <ArrowRight size={14} className={clsx(
                          "transition-all",
                          activeItemId === item.id ? "text-blue-500 opacity-100" : "text-slate-400 opacity-0 group-hover:opacity-100"
                        )} />
                      </div>
                  </button>
              ))}
          </div>
      </div>
    </div>
  );
};