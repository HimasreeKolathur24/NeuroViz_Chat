import React, { useRef, useEffect } from 'react';
import { Message } from '../types';
import { Send, User, Bot, Search } from 'lucide-react';
import { clsx } from 'clsx';

interface ChatPanelProps {
  messages: Message[];
  input: string;
  setInput: (val: string) => void;
  onSend: () => void;
  isSending: boolean;
  onViewReasoning: (traceId: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  input,
  setInput,
  onSend,
  isSending,
  onViewReasoning,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
          NeuroViz Chat
        </h1>
        <p className="text-xs text-slate-500">Explainable AI with 3D Reasoning</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-70">
            <div className="p-4 bg-white rounded-full shadow-sm mb-4">
               <Bot size={32} className="text-blue-500" />
            </div>
            <p>Ask a question to see the reasoning engine in action.</p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={clsx(
              "flex gap-3 max-w-[90%]",
              msg.role === 'user' ? "self-end flex-row-reverse" : "self-start"
            )}
          >
            <div className={clsx(
              "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border",
              msg.role === 'user' ? "bg-indigo-100 border-indigo-200 text-indigo-600" : "bg-white border-slate-200 text-blue-600"
            )}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            
            <div className={clsx(
              "p-3 rounded-2xl shadow-sm text-sm leading-relaxed border",
              msg.role === 'user' 
                ? "bg-indigo-600 text-white border-indigo-600 rounded-tr-none" 
                : "bg-white text-slate-800 border-slate-200 rounded-tl-none"
            )}>
              {msg.isThinking ? (
                 <div className="flex gap-1 items-center h-6">
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                 </div>
              ) : (
                <>
                  <p>{msg.text}</p>
                  {msg.role === 'ai' && msg.traceId && (
                    <button
                      onClick={() => onViewReasoning(msg.traceId!)}
                      className="mt-3 flex items-center gap-2 text-xs bg-slate-50 hover:bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full transition-colors border border-slate-200 hover:border-blue-200 font-medium"
                    >
                      <Search size={12} />
                      <span>See how I answered</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-200">
        <div className="relative flex items-center gap-2">
          <input
            type="text"
            className="w-full bg-slate-100 text-slate-800 placeholder-slate-400 rounded-full py-3 pl-4 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-slate-200 transition-all"
            placeholder="Ask me anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSending}
          />
          <button
            onClick={onSend}
            disabled={!input.trim() || isSending}
            className="absolute right-2 p-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded-full transition-colors shadow-sm"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};