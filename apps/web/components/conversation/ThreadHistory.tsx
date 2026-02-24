'use client';

import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  MoreVertical, 
  Trash2, 
  Edit2, 
  Archive,
  Pin,
  MessageSquare,
  Clock,
  ChevronRight,
  X,
  Loader2
} from 'lucide-react';

export interface Thread {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  messageCount: number;
  status: 'active' | 'archived' | 'pinned';
  teamName?: string;
  tags?: string[];
  unreadCount?: number;
}

interface ThreadHistoryProps {
  threads?: Thread[];
  selectedThreadId?: string;
  onSelectThread?: (threadId: string) => void;
  onCreateThread?: () => void;
  onDeleteThread?: (threadId: string) => void;
  onRenameThread?: (threadId: string, newTitle: string) => void;
  onArchiveThread?: (threadId: string) => void;
  onPinThread?: (threadId: string) => void;
  isLoading?: boolean;
}

const defaultThreads: Thread[] = [
  {
    id: '1',
    title: 'فريق البحث ألفا',
    lastMessage: 'تم إكمال تحليل المصادر بنجاح...',
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    messageCount: 24,
    status: 'pinned',
    teamName: 'Research Team A',
    tags: ['research', 'high-priority'],
    unreadCount: 2,
  },
  {
    id: '2',
    title: 'تطوير المتجر الإلكتروني',
    lastMessage: 'دعنا نبدأ بتحليل المتطلبات...',
    timestamp: new Date(Date.now() - 60 * 60 * 1000),
    messageCount: 15,
    status: 'active',
    teamName: 'Dev Team B',
    tags: ['development', 'e-commerce'],
  },
  {
    id: '3',
    title: 'وكيل توليد الكود',
    lastMessage: 'أي لغة برمجة تفضل استخدامها؟',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    messageCount: 8,
    status: 'active',
    teamName: 'Code Team C',
    tags: ['coding', 'ai'],
    unreadCount: 1,
  },
  {
    id: '4',
    title: 'تحليل البيانات الشهرية',
    lastMessage: 'النتائج جاهزة للمراجعة',
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    messageCount: 42,
    status: 'archived',
    teamName: 'Data Team D',
    tags: ['analytics', 'monthly'],
  },
  {
    id: '5',
    title: 'إنشاء محتوى تسويقي',
    lastMessage: 'هل يمكنك مراجعة المقالة؟',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    messageCount: 12,
    status: 'active',
    teamName: 'Content Team E',
    tags: ['content', 'marketing'],
  },
];

const formatTime = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60 * 1000) return 'الآن';
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))} دقيقة`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))} ساعة`;
  if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / (24 * 60 * 60 * 1000))} يوم`;
  
  return date.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' });
};

const ThreadItem = ({
  thread,
  isSelected,
  onSelect,
  onDelete,
  onRename,
  onArchive,
  onPin,
}: {
  thread: Thread;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (newTitle: string) => void;
  onArchive: () => void;
  onPin: () => void;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(thread.title);
  const [showMenu, setShowMenu] = useState(false);

  const handleRename = () => {
    if (editTitle.trim()) {
      onRename(editTitle.trim());
    }
    setIsEditing(false);
  };

  return (
    <div
      onClick={onSelect}
      className={`relative p-3 rounded-lg cursor-pointer transition-all group ${
        isSelected
          ? 'bg-blue-600/20 border-r-2 border-blue-500'
          : 'hover:bg-gray-700/50 border-r-2 border-transparent'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
          thread.status === 'pinned' ? 'bg-yellow-500/20 text-yellow-400' :
          thread.status === 'archived' ? 'bg-gray-600/20 text-gray-400' :
          'bg-blue-500/20 text-blue-400'
        }`}>
          {thread.status === 'pinned' ? (
            <Pin className="w-5 h-5" />
          ) : (
            <MessageSquare className="w-5 h-5" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename();
                  if (e.key === 'Escape') setIsEditing(false);
                }}
                className="flex-1 bg-gray-700 text-white text-sm px-2 py-1 rounded"
                autoFocus
              />
              <button onClick={handleRename} className="text-green-400">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <h3 className={`font-medium truncate ${
                isSelected ? 'text-blue-400' : 'text-white'
              }`}>
                {thread.title}
              </h3>
              
              {/* Menu */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(!showMenu);
                  }}
                  className="p-1 text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                
                {showMenu && (
                  <div 
                    className="absolute right-0 top-full mt-1 w-40 bg-gray-800 rounded-lg shadow-lg border border-gray-700 z-10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => { onPin(); setShowMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 rounded-t-lg"
                    >
                      <Pin className="w-4 h-4" />
                      {thread.status === 'pinned' ? 'إلغاء التثبيت' : 'تثبيت'}
                    </button>
                    <button
                      onClick={() => { setIsEditing(true); setShowMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700"
                    >
                      <Edit2 className="w-4 h-4" />
                      إعادة تسمية
                    </button>
                    <button
                      onClick={() => { onArchive(); setShowMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700"
                    >
                      <Archive className="w-4 h-4" />
                      أرشفة
                    </button>
                    <button
                      onClick={() => { onDelete(); setShowMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-gray-700 rounded-b-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                      حذف
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <p className="text-sm text-gray-400 truncate mt-0.5">
            {thread.lastMessage}
          </p>

          {/* Meta */}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(thread.timestamp)}
            </span>
            
            {thread.teamName && (
              <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">
                {thread.teamName}
              </span>
            )}

            {thread.unreadCount && thread.unreadCount > 0 && (
              <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full">
                {thread.unreadCount}
              </span>
            )}
          </div>

          {/* Tags */}
          {thread.tags && thread.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {thread.tags.slice(0, 3).map((tag, i) => (
                <span key={i} className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ThreadHistory = ({
  threads: initialThreads = defaultThreads,
  selectedThreadId,
  onSelectThread,
  onCreateThread,
  onDeleteThread,
  onRenameThread,
  onArchiveThread,
  onPinThread,
  isLoading = false,
}: ThreadHistoryProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'pinned' | 'archived'>('all');

  // Click outside to close menus
  React.useEffect(() => {
    const handleClickOutside = () => {
      // Close any open menus
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const filteredThreads = useMemo(() => {
    let filtered = initialThreads;

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(t => t.status === filterStatus);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(query) ||
        t.lastMessage.toLowerCase().includes(query) ||
        t.teamName?.toLowerCase().includes(query) ||
        t.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Sort: pinned first, then by timestamp
    return filtered.sort((a, b) => {
      if (a.status === 'pinned' && b.status !== 'pinned') return -1;
      if (a.status !== 'pinned' && b.status === 'pinned') return 1;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
  }, [initialThreads, searchQuery, filterStatus]);

  const groupedThreads = useMemo(() => {
    const today: Thread[] = [];
    const thisWeek: Thread[] = [];
    const older: Thread[] = [];

    const now = new Date();

    filteredThreads.forEach(thread => {
      const diff = now.getTime() - thread.timestamp.getTime();
      
      if (diff < 24 * 60 * 60 * 1000) {
        today.push(thread);
      } else if (diff < 7 * 24 * 60 * 60 * 1000) {
        thisWeek.push(thread);
      } else {
        older.push(thread);
      }
    });

    return { today, thisWeek, older };
  }, [filteredThreads]);

  return (
    <div className="flex flex-col h-full bg-gray-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">سجل المحادثات</h2>
          <button
            onClick={onCreateThread}
            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="البحث في المحادثات..."
            className="w-full bg-gray-700 text-white placeholder-gray-400 rounded-lg pr-10 pl-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mt-3">
          {(['all', 'active', 'pinned', 'archived'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1 rounded-full text-xs transition-colors ${
                filterStatus === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              {status === 'all' ? 'الكل' :
               status === 'active' ? 'نشط' :
               status === 'pinned' ? 'مثبت' : 'مؤرشف'}
            </button>
          ))}
        </div>
      </div>

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        ) : filteredThreads.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">لا توجد محادثات</p>
          </div>
        ) : (
          <div className="space-y-1">
            {/* Today */}
            {groupedThreads.today.length > 0 && (
              <>
                <h3 className="text-xs font-medium text-gray-500 px-3 py-2">اليوم</h3>
                {groupedThreads.today.map((thread) => (
                  <ThreadItem
                    key={thread.id}
                    thread={thread}
                    isSelected={selectedThreadId === thread.id}
                    onSelect={() => onSelectThread?.(thread.id)}
                    onDelete={() => onDeleteThread?.(thread.id)}
                    onRename={(title) => onRenameThread?.(thread.id, title)}
                    onArchive={() => onArchiveThread?.(thread.id)}
                    onPin={() => onPinThread?.(thread.id)}
                  />
                ))}
              </>
            )}

            {/* This Week */}
            {groupedThreads.thisWeek.length > 0 && (
              <>
                <h3 className="text-xs font-medium text-gray-500 px-3 py-2">هذا الأسبوع</h3>
                {groupedThreads.thisWeek.map((thread) => (
                  <ThreadItem
                    key={thread.id}
                    thread={thread}
                    isSelected={selectedThreadId === thread.id}
                    onSelect={() => onSelectThread?.(thread.id)}
                    onDelete={() => onDeleteThread?.(thread.id)}
                    onRename={(title) => onRenameThread?.(thread.id, title)}
                    onArchive={() => onArchiveThread?.(thread.id)}
                    onPin={() => onPinThread?.(thread.id)}
                  />
                ))}
              </>
            )}

            {/* Older */}
            {groupedThreads.older.length > 0 && (
              <>
                <h3 className="text-xs font-medium text-gray-500 px-3 py-2">أقدم</h3>
                {groupedThreads.older.map((thread) => (
                  <ThreadItem
                    key={thread.id}
                    thread={thread}
                    isSelected={selectedThreadId === thread.id}
                    onSelect={() => onSelectThread?.(thread.id)}
                    onDelete={() => onDeleteThread?.(thread.id)}
                    onRename={(title) => onRenameThread?.(thread.id, title)}
                    onArchive={() => onArchiveThread?.(thread.id)}
                    onPin={() => onPinThread?.(thread.id)}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="p-3 border-t border-gray-700 bg-gray-800">
        <p className="text-xs text-gray-500 text-center">
          {filteredThreads.length} محادثة • {initialThreads.filter(t => t.unreadCount).reduce((sum, t) => sum + (t.unreadCount || 0), 0)} غير مقروءة
        </p>
      </div>
    </div>
  );
};

export default ThreadHistory;
