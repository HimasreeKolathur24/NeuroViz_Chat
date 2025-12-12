import React from 'react';
import { ExplainTrace } from '../types';
import { Box, CheckCircle, Zap } from 'lucide-react';
import { clsx } from 'clsx';

interface ReasoningOverlayProps {
  data: ExplainTrace | null;
}

export const ReasoningOverlay: React.FC<ReasoningOverlayProps> = ({ data }) => {
  if (!data) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center bg-white">
            <Zap size={32} className="mb-3 opacity-20 text-slate-600" />
            <p className="text-sm text-slate-600">No reasoning trace available.</p>
            <p className="text-xs text-slate-400 mt-1">Ask a question to generate a reasoning graph.</p>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white w-full overflow-hidden">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
        
        {/* Confidence Badge */}
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 flex items-center justify-between shadow-sm">
            <span className="text-xs text-slate-500 font-medium">Confidence Score</span>
            <span className={clsx(
                "px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider border",
                data.confidence === 'high' ? "bg-green-100 text-green-700 border-green-200" :
                data.confidence === 'medium' ? "bg-yellow-100 text-yellow-700 border-yellow-200" :
                "bg-red-100 text-red-700 border-red-200"
            )}>
                {data.confidence}
            </span>
        </div>

        {/* Steps Timeline */}
        <div>
            <h4 className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wider flex items-center gap-2">
                <Box size={12} className="text-blue-500" /> Cognitive Steps
            </h4>
            <div className="relative pl-3 ml-1 border-l border-slate-200 space-y-4">
                {data.steps.map((step, idx) => (
                    <div key={idx} className="relative group">
                        <span className="absolute -left-[17px] top-1.5 w-2 h-2 bg-white border-2 border-blue-500 rounded-full group-hover:bg-blue-500 transition-colors"></span>
                        <p className="text-xs text-slate-600 leading-relaxed hover:text-slate-900 transition-colors">
                          {step}
                        </p>
                    </div>
                ))}
            </div>
        </div>

        {/* Key Factors */}
        <div>
            <h4 className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wider flex items-center gap-2">
                <CheckCircle size={12} className="text-blue-500" /> Key Basis
            </h4>
            <div className="space-y-2">
                {data.key_factors.map((factor, idx) => (
                    <div key={idx} className="bg-slate-50 p-2.5 rounded border border-slate-200 hover:border-slate-300 transition-colors">
                        <p className="text-xs text-slate-600 italic">"{factor}"</p>
                    </div>
                ))}
            </div>
        </div>

        {/* Graph Stats */}
        <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-100 opacity-80">
            <div className="text-center">
                <div className="text-base font-bold text-slate-800">{data.stages.length}</div>
                <div className="text-[9px] uppercase text-slate-400 tracking-wide">Stages</div>
            </div>
            <div className="text-center">
                <div className="text-base font-bold text-slate-800">{data.nodes.length}</div>
                <div className="text-[9px] uppercase text-slate-400 tracking-wide">Nodes</div>
            </div>
            <div className="text-center">
                <div className="text-base font-bold text-slate-800">{data.edges.length}</div>
                <div className="text-[9px] uppercase text-slate-400 tracking-wide">Links</div>
            </div>
        </div>

      </div>
    </div>
  );
};