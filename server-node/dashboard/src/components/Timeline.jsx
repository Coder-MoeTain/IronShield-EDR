import React from 'react';

export default function Timeline({ events = [] }) {
  if (!events.length) {
    return <p className="ui-muted">No timeline events.</p>;
  }
  return (
    <ol className="console-timeline" aria-label="Timeline">
      {events.map((ev) => (
        <li key={ev.id || `${ev.ts}-${ev.label}`} className="console-timeline-item">
          <time className="console-timeline-time" dateTime={ev.ts}>
            {ev.timeLabel || ev.ts}
          </time>
          <div className="console-timeline-body">
            <strong>{ev.label}</strong>
            {ev.detail ? <p className="ui-muted">{ev.detail}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
