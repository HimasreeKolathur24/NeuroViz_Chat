import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Canvas } from '@react-three/fiber';
import { Message, HistoryItem, AppMode, ExplainTrace } from './types';
import { ChatPanel } from './components/ChatPanel';
import { ReasoningGraph } from './components/ReasoningGraph';
import { ReasoningGallery } from './components/ReasoningGallery';
import { ReasoningOverlay } from './components/ReasoningOverlay';
import { sendMessage } from "./services/api";
import { Layout, BrainCircuit, Activity, Database } from 'lucide-react';
import { clsx } from 'clsx';

const STORAGE_KEY = 'neuroviz_history';

// fallback trace to prevent crashes
const getDefaultExplainTrace = (): ExplainTrace => ({
  stages: [],
  nodes: [],
  edges: [],
  key_factors: [],
  confidence: "low",
  timestamp: new Date().toISOString(),
  steps: [],
});

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeHistoryItem, setActiveHistoryItem] = useState<HistoryItem | null>(null);

  const [vizMode, setVizMode] = useState<AppMode>(AppMode.IDLE);
  const [vizData, setVizData] = useState<ExplainTrace | null>(null);

  const [activeTab, setActiveTab] = useState<'trace' | 'history'>('trace');
  const [currentVizId, setCurrentVizId] = useState<string | null>(null);

  const emptyTraceFallback = useMemo(() => getDefaultExplainTrace(), []);

  // Load history from local storage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch (err) {
        console.error("Failed to parse history", err);
      }
    }
  }, []);

  // Persist history
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  // Handle sending chat message
  const handleSendMessage = async () => {
    if (!input.trim() || isSending) return;

    const question = input.trim();
    const userMsgId = uuidv4();
    const aiMsgId = uuidv4();

    const userMsg: Message = {
      id: userMsgId,
      role: 'user',
      text: question,
      timestamp: new Date().toISOString()
    };

    const thinkingMsg: Message = {
      id: aiMsgId,
      role: 'ai',
      text: "Thinking...",
      isThinking: true,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg, thinkingMsg]);
    setInput('');
    setIsSending(true);
    setVizMode(AppMode.THINKING);
    setVizData(null);
    setActiveHistoryItem(null);
    setCurrentVizId(null);
    setActiveTab('trace');

    try {
      const response = await sendMessage(question);

      const newHistoryId = uuidv4();
      const newItem: HistoryItem = {
        id: newHistoryId,
        question,
        answer: response.answer,
        explain_trace: response.explain_trace || emptyTraceFallback,
        timestamp: new Date().toISOString()
      };

      setMessages(prev =>
        prev.map(m => m.id === aiMsgId ?
          { ...m, text: response.answer, isThinking: false, traceId: newItem.id } :
          m
        )
      );

      setHistory(prev => [...prev, newItem]);

      setVizData(response.explain_trace || emptyTraceFallback);
      setVizMode(AppMode.VISUALIZING);
      setCurrentVizId(newHistoryId);

    } catch (err) {
      console.error(err);
      setMessages(prev =>
        prev.map(m => m.id === aiMsgId
          ? { ...m, text: "Sorry, something went wrong.", isThinking: false }
          : m
        )
      );
      setVizMode(AppMode.IDLE);
    } finally {
      setIsSending(false);
    }
  };

  const handleViewReasoning = (traceId: string) => {
    const item = history.find(h => h.id === traceId);
    if (item) {
      setActiveHistoryItem(item);
      setVizData(item.explain_trace || emptyTraceFallback);
      setVizMode(AppMode.VISUALIZING);
      setCurrentVizId(null);
      setActiveTab('trace');
    }
  };

  const handleSelectHistoryItem = (item: HistoryItem) => {
    setActiveHistoryItem(item);
    setVizData(item.explain_trace || emptyTraceFallback);
    setVizMode(AppMode.VISUALIZING);
    setCurrentVizId(null);
    setActiveTab('trace');
  };

  const handleThumbnailCapture = useCallback((dataUrl: string) => {
    setCurrentVizId(prevId => {
      if (prevId) {
        setHistory(prev =>
          prev.map(item =>
            item.id === prevId ? { ...item, thumbnail: dataUrl } : item
          )
        );
        return null;
      }
      return prevId;
    });
  }, []);

  return (
    <div className="flex flex-col md:flex-row w-full h-full bg-white text-slate-800 overflow-hidden font-sans">

      {/* LEFT: Chat Panel */}
      <div className="flex-1 h-[50vh] md:h-full min-w-0 bg-white border-b md:border-b-0 md:border-r border-slate-200 z-10">
        <ChatPanel
          messages={messages}
          input={input}
          setInput={setInput}
          onSend={handleSendMessage}
          isSending={isSending}
          onViewReasoning={handleViewReasoning}
        />
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-1 flex flex-col h-[50vh] md:h-full bg-white min-w-0 relative">

        {/* Graph */}
        <div className="flex-1 relative bg-white min-h-[35vh] max-h-[50vh] md:max-h-none overflow-hidden">
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-white/90 backdrop-blur border border-slate-200 px-3 py-1.5 rounded-full shadow-sm">
            {vizMode === AppMode.THINKING ? (
              <>
                <BrainCircuit size={14} className="text-blue-500 animate-pulse" />
                <span className="text-xs font-bold">Neural Processing</span>
              </>
            ) : vizMode === AppMode.VISUALIZING ? (
              <>
                <Activity size={14} className="text-indigo-500" />
                <span className="text-xs font-bold">Reasoning Graph</span>
              </>
            ) : (
              <>
                <Layout size={14} className="text-slate-400" />
                <span className="text-xs font-bold text-slate-400">Idle System</span>
              </>
            )}
          </div>

          <Canvas camera={{ position: [0, 0, 15], fov: 50 }} gl={{ preserveDrawingBuffer: true }}>
            <ReasoningGraph
              mode={vizMode}
              data={vizData || emptyTraceFallback}
              onCapture={currentVizId ? handleThumbnailCapture : undefined}
            />
          </Canvas>
        </div>

        {/* Tabs + Trace/History Section */}
        <div className="h-[45vh] md:h-[40%] flex flex-col bg-white border-t border-slate-200 overflow-y-auto">

          {/* Tab buttons */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab('trace')}
              className={clsx(
                "flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2",
                activeTab === 'trace'
                  ? "bg-slate-50 text-blue-600 border-b-2 border-blue-500"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Activity size={14} />
              Reasoning Trace
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={clsx(
                "flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2",
                activeTab === 'history'
                  ? "bg-slate-50 text-blue-600 border-b-2 border-blue-500"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Database size={14} />
              History
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto relative">
            {activeTab === 'trace' ? (
              <ReasoningOverlay data={vizData || emptyTraceFallback} />
            ) : (
              <ReasoningGallery
                history={history}
                activeItemId={activeHistoryItem?.id || null}
                onSelectHistory={handleSelectHistoryItem}
              />
            )}
          </div>

        </div>

      </div>

    </div>
  );
}

export default App;
