'use client';

import React, { useState, useCallback } from 'react';
import { ChatInterface, ThreadHistory } from '@/components/conversation';
import type { Message } from '@/components/conversation';
import type { Thread } from '@/components/conversation';


// Generate sample threads
const generateSampleThreads = (): Thread[] => [
  {
    id: 'thread-1',
    title: 'فريق البحث ألفا',
    lastMessage: 'تم إكمال تحليل المصادر بنجاح. هل تريد مراجعة النتائج؟',
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    messageCount: 24,
    status: 'pinned',
    teamName: 'Research Team A',
    tags: ['research', 'high-priority'],
    unreadCount: 2,
  },
  {
    id: 'thread-2',
    title: 'تطوير المتجر الإلكتروني',
    lastMessage: 'دعنا نبدأ بتحليل المتطلبات والمنافسين...',
    timestamp: new Date(Date.now() - 60 * 60 * 1000),
    messageCount: 15,
    status: 'active',
    teamName: 'Dev Team B',
    tags: ['development', 'e-commerce'],
  },
  {
    id: 'thread-3',
    title: 'وكيل توليد الكود',
    lastMessage: 'أي لغة برمجة تفضل استخدامها؟ يمكنني العمل مع Python و TypeScript و Rust.',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    messageCount: 8,
    status: 'active',
    teamName: 'Code Team C',
    tags: ['coding', 'ai'],
    unreadCount: 1,
  },
  {
    id: 'thread-4',
    title: 'تحليل البيانات الشهرية',
    lastMessage: 'النتائج جاهزة للمراجعة. تم تحديد 3 فرص رئيسية للتحسين.',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    messageCount: 42,
    status: 'archived',
    teamName: 'Data Team D',
    tags: ['analytics', 'monthly'],
  },
];

// Generate sample messages for a thread
const generateSampleMessages = (_threadId: string): Message[] => [
  {
    id: 'msg-1',
    content: 'مرحباً! أنا هنا لمساعدتك في بناء فريق وكلاء لهذه المهمة. ما هو المشروع الذي تعمل عليه؟',
    sender: 'assistant',
    timestamp: new Date(Date.now() - 60 * 60 * 1000),
    metadata: {
      model: 'GPT-4',
      tokens: 45,
      latency: 890,
    },
  },
  {
    id: 'msg-2',
    content: 'أحتاج إلى فريق لتحليل سوق المنافسين لمنتج SaaS جديد في مجال إدارة المشاريع.',
    sender: 'user',
    timestamp: new Date(Date.now() - 55 * 60 * 1000),
    status: 'sent',
  },
  {
    id: 'msg-3',
    content: 'ممتاز! سأقوم بتجميع فريق بحث متخصص. سيتضمن ذلك: محلل أبحاث سوق، متخصص في تحليل المنافسين، وكاتب محتوى للتقارير.',
    sender: 'assistant',
    timestamp: new Date(Date.now() - 50 * 60 * 1000),
    metadata: {
      model: 'Claude 3',
      tokens: 78,
      latency: 1200,
      toolsUsed: ['search', 'analysis'],
    },
  },
  {
    id: 'msg-4',
    content: 'هل يمكنك إعطائي نبذة عن الخبرات المطلوبة لكل دور؟',
    sender: 'user',
    timestamp: new Date(Date.now() - 45 * 60 * 1000),
    status: 'sent',
  },
  {
    id: 'msg-5',
    content: 'بالطبع! فيما يلي تفاصيل الأدوار:\n\n1. **محلل أبحاث السوق**: خبرة 3+ سنوات في SaaS، مهارات تحليل بيانات\n2. **محلل المنافسين**: خبرة في تحليل استراتيجيات المنتجات، معرفة بأدوات مثل SimilarWeb\n3. **كاتب التقارير**: مهارات كتابة تقارير احترافية، خبرة في مجال التقنية',
    sender: 'assistant',
    timestamp: new Date(Date.now() - 40 * 60 * 1000),
    metadata: {
      model: 'GPT-4',
      tokens: 120,
      latency: 1500,
    },
  },
  {
    id: 'msg-6',
    content: 'تمام! لنبدأ التحليل. هل يمكنك البدء بالبحث عن أبرز 5 منافسين في هذا المجال؟',
    sender: 'user',
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    status: 'sent',
  },
  {
    id: 'msg-7',
    content: 'سأبدأ البحث فوراً. سأستخدم أدوات البحث لجمع معلومات شاملة عن المنافسين الرئيسيين في سوق إدارة المشاريع.',
    sender: 'assistant',
    timestamp: new Date(Date.now() - 4 * 60 * 1000),
    metadata: {
      model: 'GPT-4',
      tokens: 65,
      latency: 1100,
      toolsUsed: ['search', 'data-collection'],
    },
  },
];

const ConversationPage = () => {
  const [threads, setThreads] = useState<Thread[]>(generateSampleThreads());
  const [selectedThreadId, setSelectedThreadId] = useState<string>('thread-1');
  const [messages, setMessages] = useState<Message[]>(generateSampleMessages('thread-1'));
  const [isLoading, setIsLoading] = useState(false);

  const selectedThread = threads.find(t => t.id === selectedThreadId);

  const handleSelectThread = useCallback((threadId: string) => {
    setSelectedThreadId(threadId);
    // In production, fetch messages from API
    setMessages(generateSampleMessages(threadId));
    // Reset unread count for selected thread
    setThreads(prev => prev.map(t => 
      t.id === threadId ? { ...t, unreadCount: 0 } : t
    ));
  }, []);

  const handleCreateThread = useCallback(() => {
    const newThread: Thread = {
      id: `thread-${Date.now()}`,
      title: 'محادثة جديدة',
      lastMessage: 'ابدأ المحادثة هنا...',
      timestamp: new Date(),
      messageCount: 0,
      status: 'active',
    };
    setThreads(prev => [newThread, ...prev]);
    setSelectedThreadId(newThread.id);
    setMessages([]);
  }, []);

  const handleSendMessage = useCallback((content: string, attachments?: File[]) => {
    // Add user message
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      content,
      sender: 'user',
      timestamp: new Date(),
      status: 'sent',
      attachments: attachments?.map(file => ({
        name: file.name,
        type: file.type,
        size: file.size,
      })),
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    // Update thread
    setThreads(prev => prev.map(t => 
      t.id === selectedThreadId 
        ? { ...t, lastMessage: content, messageCount: t.messageCount + 1, timestamp: new Date() }
        : t
    ));

    // Simulate assistant response
    setIsLoading(true);
    setTimeout(() => {
      const response: Message = {
        id: `msg-${Date.now()}-assistant`,
        content: 'فهمت طلبك. سأقوم بمعالجة ذلك والرد عليك قريباً.',
        sender: 'assistant',
        timestamp: new Date(),
        metadata: {
          model: 'GPT-4',
          tokens: 25,
          latency: 800,
        },
      };
      setMessages(prev => [...prev, response]);
      setIsLoading(false);
      
      setThreads(prev => prev.map(t => 
        t.id === selectedThreadId 
          ? { ...t, lastMessage: response.content, messageCount: t.messageCount + 1 }
          : t
      ));
    }, 1500);
  }, [selectedThreadId]);

  const handleDeleteThread = useCallback((threadId: string) => {
    if (confirm('هل أنت متأكد من حذف هذه المحادثة؟')) {
      setThreads(prev => prev.filter(t => t.id !== threadId));
      if (selectedThreadId === threadId) {
        const remaining = threads.filter(t => t.id !== threadId);
        const firstRemaining = remaining[0];
        if (firstRemaining) {
          setSelectedThreadId(firstRemaining.id);
          setMessages(generateSampleMessages(firstRemaining.id));
        } else {
          setMessages([]);
        }
      }
    }
  }, [selectedThreadId, threads]);

  const handleRenameThread = useCallback((threadId: string, newTitle: string) => {
    setThreads(prev => prev.map(t => 
      t.id === threadId ? { ...t, title: newTitle } : t
    ));
  }, []);

  const handleArchiveThread = useCallback((threadId: string) => {
    setThreads(prev => prev.map(t => 
      t.id === threadId ? { ...t, status: t.status === 'archived' ? 'active' : 'archived' } : t
    ));
  }, []);

  const handlePinThread = useCallback((threadId: string) => {
    setThreads(prev => prev.map(t => 
      t.id === threadId ? { ...t, status: t.status === 'pinned' ? 'active' : 'pinned' } : t
    ));
  }, []);

  const handleRegenerate = useCallback((messageId: string) => {
    setIsLoading(true);
    setTimeout(() => {
      setMessages(prev => prev.map(m => 
        m.id === messageId 
          ? { ...m, content: m.content + ' (معاد توليده)' }
          : m
      ));
      setIsLoading(false);
    }, 1000);
  }, []);

  const handleFeedback = useCallback((messageId: string, feedback: 'positive' | 'negative') => {
    console.log(`Feedback for ${messageId}: ${feedback}`);
  }, []);

  return (
    <div className="h-[calc(100vh-64px)] flex">
      {/* Thread History Sidebar */}
      <div className="w-80 flex-shrink-0 p-4">
        <ThreadHistory
          threads={threads}
          selectedThreadId={selectedThreadId}
          onSelectThread={handleSelectThread}
          onCreateThread={handleCreateThread}
          onDeleteThread={handleDeleteThread}
          onRenameThread={handleRenameThread}
          onArchiveThread={handleArchiveThread}
          onPinThread={handlePinThread}
        />
      </div>

      {/* Chat Interface */}
      <div className="flex-1 p-4 pr-0">
        <div className="h-full bg-gray-800 rounded-lg overflow-hidden">
          <ChatInterface
            messages={messages}
            onSendMessage={handleSendMessage}
            onRegenerate={handleRegenerate}
            onFeedback={handleFeedback}
            isLoading={isLoading}
            threadName={selectedThread?.title}
          />
        </div>
      </div>
    </div>
  );
};

export default ConversationPage;
