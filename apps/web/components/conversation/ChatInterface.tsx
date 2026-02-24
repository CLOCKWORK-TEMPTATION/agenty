'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Send, 
  Paperclip, 
  Bot, 
  User, 
  Sparkles, 
  MoreVertical,
  Copy,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Loader2,
  Check,
  X
} from 'lucide-react';

export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant' | 'system';
  timestamp: Date;
  status?: 'sending' | 'sent' | 'error';
  metadata?: {
    model?: string;
    tokens?: number;
    latency?: number;
    toolsUsed?: string[];
  };
  attachments?: Array<{
    name: string;
    type: string;
    size: number;
  }>;
}

interface ChatInterfaceProps {
  messages?: Message[];
  onSendMessage?: (content: string, attachments?: File[]) => void;
  onRegenerate?: (messageId: string) => void;
  onFeedback?: (messageId: string, feedback: 'positive' | 'negative') => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  threadName?: string;
}

const MessageBubble = ({ 
  message, 
  onRegenerate, 
  onFeedback 
}: { 
  message: Message; 
  onRegenerate?: (messageId: string) => void;
  onFeedback?: (messageId: string, feedback: 'positive' | 'negative') => void;
}) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.sender === 'user';
  const isAssistant = message.sender === 'assistant';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser ? 'bg-blue-600' : isAssistant ? 'bg-green-600' : 'bg-gray-600'
      }`}>
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : isAssistant ? (
          <Bot className="w-4 h-4 text-white" />
        ) : (
          <Sparkles className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Message Content */}
      <div className={`flex-1 max-w-[80%] ${isUser ? 'text-right' : ''}`}>
        <div className={`inline-block rounded-2xl px-4 py-2.5 ${
          isUser 
            ? 'bg-blue-600 text-white' 
            : 'bg-gray-700 text-gray-100'
        }`}>
          {message.status === 'sending' && (
            <div className="flex items-center gap-2 mb-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-xs opacity-70">جاري الإرسال...</span>
            </div>
          )}
          
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {message.content}
          </div>

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 space-y-1">
              {message.attachments.map((att, i) => (
                <div key={i} className="flex items-center gap-2 text-xs bg-black/20 rounded px-2 py-1">
                  <Paperclip className="w-3 h-3" />
                  <span>{att.name}</span>
                  <span className="opacity-70">({(att.size / 1024).toFixed(1)} KB)</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Message Meta */}
        <div className={`flex items-center gap-2 mt-1 text-xs text-gray-500 ${
          isUser ? 'justify-end' : ''
        }`}>
          <span>{message.timestamp.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
          
          {message.metadata?.model && (
            <span className="bg-gray-800 px-1.5 py-0.5 rounded">
              {message.metadata.model}
            </span>
          )}

          {message.status === 'error' && (
            <span className="text-red-400 flex items-center gap-1">
              <X className="w-3 h-3" />
              فشل الإرسال
            </span>
          )}
        </div>

        {/* Assistant Actions */}
        {isAssistant && (
          <div className={`flex items-center gap-1 mt-1 ${isUser ? 'justify-end' : ''}`}>
            <button
              onClick={handleCopy}
              className="p-1 text-gray-500 hover:text-white hover:bg-gray-700 rounded transition-colors"
              title="نسخ"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            
            {onRegenerate && (
              <button
                onClick={() => onRegenerate(message.id)}
                className="p-1 text-gray-500 hover:text-white hover:bg-gray-700 rounded transition-colors"
                title="إعادة توليد"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
            
            {onFeedback && (
              <>
                <button
                  onClick={() => onFeedback(message.id, 'positive')}
                  className="p-1 text-gray-500 hover:text-green-400 hover:bg-gray-700 rounded transition-colors"
                  title="رد إيجابي"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onFeedback(message.id, 'negative')}
                  className="p-1 text-gray-500 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
                  title="رد سلبي"
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        )}

        {/* Tool Usage */}
        {message.metadata?.toolsUsed && message.metadata.toolsUsed.length > 0 && (
          <div className={`flex items-center gap-1 mt-1 flex-wrap ${isUser ? 'justify-end' : ''}`}>
            <span className="text-xs text-gray-500">الأدوات المستخدمة:</span>
            {message.metadata.toolsUsed.map((tool, i) => (
              <span key={i} className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                {tool}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const ChatInterface = ({
  messages: initialMessages = [],
  onSendMessage,
  onRegenerate,
  onFeedback,
  isLoading = false,
  disabled = false,
  placeholder = 'اكتب رسالتك هنا...',
  threadName = 'محادثة جديدة',
}: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputValue, setInputValue] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [inputValue]);

  const handleSend = useCallback(() => {
    if (!inputValue.trim() && attachments.length === 0) return;
    if (disabled || isLoading) return;

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      content: inputValue.trim(),
      sender: 'user',
      timestamp: new Date(),
      status: 'sending',
      attachments: attachments.map(file => ({
        name: file.name,
        type: file.type,
        size: file.size,
      })),
    };

    setMessages(prev => [...prev, newMessage]);
    setInputValue('');
    setAttachments([]);

    onSendMessage?.(inputValue.trim(), attachments);

    // Simulate message sent after a delay
    setTimeout(() => {
      setMessages(prev => 
        prev.map(m => m.id === newMessage.id ? { ...m, status: 'sent' } : m)
      );
    }, 500);
  }, [inputValue, attachments, disabled, isLoading, onSendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments(prev => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };



  return (
    <div className="flex flex-col h-full bg-gray-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-medium text-white">{threadName}</h3>
            <p className="text-xs text-gray-400">
              {messages.filter(m => m.sender === 'assistant').length} رسائل
            </p>
          </div>
        </div>
        
        <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>ابدأ المحادثة بكتابة رسالة</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onRegenerate={onRegenerate}
              onFeedback={onFeedback}
            />
          ))
        )}
        
        {isLoading && (
          <div className="flex items-center gap-2 text-gray-400">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            <span className="text-sm mr-2">جاري الكتابة...</span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-700 bg-gray-800/50">
          <div className="flex flex-wrap gap-2">
            {attachments.map((file, index) => (
              <div key={index} className="flex items-center gap-2 bg-gray-700 px-3 py-1.5 rounded-lg text-sm">
                <Paperclip className="w-4 h-4 text-gray-400" />
                <span className="text-gray-200 truncate max-w-[150px]">{file.name}</span>
                <button
                  onClick={() => removeAttachment(index)}
                  className="text-gray-400 hover:text-red-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t border-gray-700">
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="p-2.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              className="w-full bg-gray-700 text-white placeholder-gray-400 rounded-lg px-4 py-2.5 resize-none max-h-32 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>
          
          <button
            onClick={handleSend}
            disabled={disabled || isLoading || (!inputValue.trim() && attachments.length === 0)}
            className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        
        <p className="text-xs text-gray-500 mt-2 text-center">
          Enter للإرسال • Shift+Enter للسطر الجديد
        </p>
      </div>
    </div>
  );
};

export default ChatInterface;
