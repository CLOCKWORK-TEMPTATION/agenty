'use client';

import { useEffect, useRef } from 'react';

interface Event {
  timestamp: string;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
  details?: Record<string, unknown>;
}

interface EventsTimelineProps {
  events: Event[];
  autoScroll?: boolean;
}

export function EventsTimeline({
  events,
  autoScroll = true,
}: EventsTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  if (events.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📝</div>
        <div className="empty-state-title">لا توجد أحداث بعد</div>
        <div className="empty-state-desc">
          سيتم عرض الأحداث هنا عند بدء التشغيل
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="event-feed">
      {events.map((event, index) => (
        <div key={index} className="event-item">
          <div className="event-ts">
            {new Date(event.timestamp).toLocaleTimeString('ar-EG', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </div>
          <div className={`event-type event-type-${event.type}`}>
            {event.type}
          </div>
          <div className="event-message">{event.message}</div>
        </div>
      ))}
    </div>
  );
}
