'use client';

import React, { useState, useRef } from 'react';

export interface DraggableItem {
  id: string;
  content: React.ReactNode;
}

interface DraggableListProps {
  items: DraggableItem[];
  onReorder: (newItems: DraggableItem[]) => void;
  className?: string;
  itemClassName?: string;
}

export function DraggableList({ items, onReorder, className = '', itemClassName = '' }: DraggableListProps) {
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const dragNode = useRef<HTMLDivElement | null>(null);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    dragNode.current = e.target as HTMLDivElement;
    dragNode.current.addEventListener('dragend', handleDragEnd);
    
    // Slight delay to allow the ghost image to render without being invisible
    setTimeout(() => {
      setDraggedIdx(index);
    }, 0);

    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      // Requires a dummy data string for Firefox to allow drag
      e.dataTransfer.setData('text/plain', items[index]?.id || 'item');
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    if (index !== draggedIdx) {
      setDragOverIdx(index);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    // Necessary to allow dropping
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    
    if (draggedIdx !== null && draggedIdx !== index) {
      const newItems = [...items];
      const draggedItem = newItems.splice(draggedIdx, 1)[0];
      if (draggedItem) {
        newItems.splice(index, 0, draggedItem);
        onReorder(newItems);
      }
    }
    
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
    if (dragNode.current) {
      dragNode.current.removeEventListener('dragend', handleDragEnd);
      dragNode.current = null;
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {items.map((item, index) => {
        const isDragged = draggedIdx === index;
        const isDragOver = dragOverIdx === index;
        
        return (
          <div
            key={item.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnter={(e) => handleDragEnter(e, index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={`
              cursor-move p-4 bg-white dark:bg-gray-800 rounded border 
              shadow-sm transition-all duration-300 ease-in-out
              ${isDragged ? 'opacity-40 scale-95 border-blue-500 border-dashed' : 'opacity-100'}
              ${isDragOver && draggedIdx !== null && index < draggedIdx ? 'border-t-2 border-t-blue-500 mt-4' : ''}
              ${isDragOver && draggedIdx !== null && index > draggedIdx ? 'border-b-2 border-b-blue-500 mb-4' : ''}
              hover:shadow-md hover:border-blue-300
              ${itemClassName}
            `}
          >
            <div className="flex items-center gap-3">
              <div className="text-gray-400">
                {/* Drag handle icon */}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 6H10V8H8V6ZM14 6H16V8H14V6ZM8 11H10V13H8V11ZM14 11H16V13H14V11ZM8 16H10V18H8V16ZM14 16H16V18H14V16Z" fill="currentColor"/>
                </svg>
              </div>
              <div className="flex-1 pointer-events-none">
                {item.content}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
