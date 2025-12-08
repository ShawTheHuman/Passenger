import React, { useEffect, useRef } from 'react';
import { Message } from '../types';

interface ChatInterfaceProps {
  messages: Message[];
  isLoading: boolean;
  loadingMessage?: string;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, isLoading, loadingMessage }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, loadingMessage]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6 relative">
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#050505] via-transparent to-transparent h-20 bottom-0 z-10" />
      
      {messages.map((msg, idx) => (
        <div 
          key={idx} 
          className={`flex flex-col max-w-[90%] md:max-w-[80%] ${
            msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
          }`}
        >
          <div className={`
            px-4 py-3 rounded-lg text-sm md:text-base leading-relaxed
            ${msg.role === 'user' 
              ? 'bg-gray-800 text-gray-100 rounded-tr-none border border-gray-700' 
              : msg.type === 'intuition'
                ? 'bg-transparent text-emerald-500 italic font-mono text-xs border-l-2 border-emerald-500/50 pl-3'
                : 'bg-[#0a0a0a] text-gray-300 rounded-tl-none border border-gray-800 shadow-lg'
            }
          `}>
            {msg.type === 'narration' && (
              <span className="block text-gray-500 text-xs uppercase font-bold mb-1 tracking-wider">
                Action
              </span>
            )}
            {msg.content}
          </div>
          <span className="text-[10px] text-gray-600 mt-1 font-mono">
            {msg.role === 'user' ? 'YOU' : msg.type === 'intuition' ? 'INNER VOICE' : 'STRANGER'}
          </span>
        </div>
      ))}

      {isLoading && (
        <div className="mr-auto flex items-start max-w-[80%] animate-pulse">
           <div className="px-4 py-3 rounded-lg bg-[#0a0a0a] border border-gray-800 text-gray-400 text-xs font-mono flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              {loadingMessage || "Thinking..."}
           </div>
        </div>
      )}
      <div ref={bottomRef} className="h-4" />
    </div>
  );
};