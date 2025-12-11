import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Canvas } from '@react-three/fiber';
import { Message, HistoryItem, AppMode, ExplainTrace } from './types';
import { ChatPanel } from './components/ChatPanel';
import { ReasoningGraph } from './components/ReasoningGraph';
import { ReasoningGallery } from './components/ReasoningGallery';
import { ReasoningOverlay } from './components/ReasoningOverlay';
import { fetchGeminiResponse } from './services/geminiService';
import { Layout, BrainCircuit, Activity, Database } from 'lucide-react';
import { clsx } from 'clsx';

const STORAGE_KEY = 'neuroviz_history';

function App() {
  // -- State --
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  // History / Gallery
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeHistoryItem, setActiveHistoryItem] = useState<HistoryItem | null>(null);

  // Visualization State
  const [vizMode, setVizMode] = useState<AppMode>(AppMode.IDLE);
  const [vizData, setVizData] = useState<ExplainTrace | null>(null);
  
  // Bottom Right Tabs (formerly Left)
  const [activeTab, setActiveTab] = useState<'trace' | 'history'>('trace');

  // Track which history item is currently being visualized for thumbnail capture
  const [currentVizId, setCurrentVizId] = useState<string | null>(null);

  // -- Effects --

  // Load history on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // Persist history
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  // -- Handlers --

  const handleSendMessage = async () => {
    if (!input.trim() || isSending) return;

    const question = input.trim();
    const userMsgId = uuidv4();
    const aiMsgId = uuidv4();

    // 1. Add User Message
    const userMsg: Message = {
      id: userMsgId,
      role: 'user',
      text: question,
      timestamp: new Date().toISOString()
    };

    // 2. Add Thinking Placeholder
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
    
    // Switch to Thinking Mode & Show Trace Tab
    setVizMode(AppMode.THINKING);
    setVizData(null); 
    setActiveHistoryItem(null);
    setCurrentVizId(null);
    setActiveTab('trace');

    try {
      // 3. Call API
      const response = await fetchGeminiResponse(question);
      
      const newHistoryId = uuidv4();
      const newItem: HistoryItem = {
        id: newHistoryId,
        question,
        answer: response.answer,
        explain_trace: response.explain_trace,
        timestamp: new Date().toISOString()
      };

      // 4. Update Chat with Result
      setMessages(prev => prev.map(m => 
        m.id === aiMsgId 
          ? { ...m, text: response.answer, isThinking: false, traceId: newItem.id }
          : m
      ));

      // 5. Update History
      setHistory(prev => [...prev, newItem]);

      // 6. Update Visualization to Result
      setVizData(response.explain_trace);
      setVizMode(AppMode.VISUALIZING);
      setCurrentVizId(newHistoryId); // Trigger thumbnail capture

    } catch (error) {
      console.error(error);
      setMessages(prev => prev.map(m => 
        m.id === aiMsgId 
          ? { ...m, text: "Sorry, I encountered an error while analyzing that.", isThinking: false }
          : m
      ));
      setVizMode(AppMode.IDLE);
    } finally {
      setIsSending(false);
    }
  };

  const handleViewReasoning = (traceId: string) => {
    const item = history.find(h => h.id === traceId);
    if (item) {
      setActiveHistoryItem(item);
      setVizData(item.explain_trace);
      setVizMode(AppMode.VISUALIZING);
      setCurrentVizId(null);
      setActiveTab('trace');
    }
  };

  const handleSelectHistoryItem = (item: HistoryItem) => {
    setActiveHistoryItem(item);
    setVizData(item.explain_trace);
    setVizMode(AppMode.VISUALIZING);
    setCurrentVizId(null); 
    setActiveTab('trace'); // Switch to trace view to see the selected item details
  };

  // Memoized callback to prevent graph re-renders
  const handleThumbnailCapture = useCallback((dataUrl: string) => {
    setCurrentVizId(prevId => {
        // Only update history if we have a valid currentVizId that matches
        if (prevId) {
             setHistory(prevHist => prevHist.map(item => 
                item.id === prevId ? { ...item, thumbnail: dataUrl } : item
            ));
            return null; // Reset currentVizId after capture
        }
        return prevId;
    });
  }, []);

  return (
    <div className="flex flex-col md:flex-row w-full h-full bg-white text-slate-800 overflow-hidden font-sans">
      
      {/* LEFT PANEL: Chat Interface */}
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

      {/* RIGHT PANEL: Reasoning Visualization + Info Tabs */}
      <div className="flex-1 flex flex-col h-[50vh] md:h-full bg-white min-w-0 relative">
        
        {/* Top Section: 3D Visualization */}
        <div className="flex-1 relative bg-white">
           {/* Label Tag */}
           <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-white/90 backdrop-blur border border-slate-200 px-3 py-1.5 rounded-full shadow-sm">
              {vizMode === AppMode.THINKING ? (
                 <>
                   <BrainCircuit size={14} className="text-blue-500 animate-pulse" />
                   <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Neural Processing</span>
                 </>
              ) : vizMode === AppMode.VISUALIZING ? (
                 <>
                   <Activity size={14} className="text-indigo-500" />
                   <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Reasoning Graph</span>
                 </>
              ) : (
                <>
                   <Layout size={14} className="text-slate-400" />
                   <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Idle System</span>
                </>
              )}
           </div>

           <Canvas 
              camera={{ position: [0, 0, 15], fov: 50 }} 
              gl={{ preserveDrawingBuffer: true }}
            >
             <ReasoningGraph 
                mode={vizMode} 
                data={vizData} 
                onCapture={currentVizId ? handleThumbnailCapture : undefined}
             />
           </Canvas>
        </div>

        {/* Bottom Section: Info Tabs (Trace / History) */}
        <div className="h-[40%] flex flex-col bg-white border-t border-slate-200">
           {/* Tab Header */}
           <div className="flex border-b border-slate-200">
              <button 
                onClick={() => setActiveTab('trace')}
                className={clsx(
                  "flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors",
                  activeTab === 'trace' 
                    ? "bg-slate-50 text-blue-600 border-b-2 border-blue-500" 
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                )}
              >
                <Activity size={14} />
                Reasoning Trace
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={clsx(
                  "flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors",
                  activeTab === 'history' 
                    ? "bg-slate-50 text-blue-600 border-b-2 border-blue-500" 
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                )}
              >
                <Database size={14} />
                History
              </button>
           </div>
           
           {/* Tab Content */}
           <div className="flex-1 overflow-hidden relative">
              {activeTab === 'trace' ? (
                <ReasoningOverlay data={vizData} />
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