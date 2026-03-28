import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

/**
 * Virtualized scroll region for long lists (SOC tables). Parent supplies row renderer.
 */
export default function VirtualizedScrollList({
  count,
  estimateSize = 56,
  overscan = 8,
  maxHeight = 'min(65vh, 560px)',
  className = '',
  rowRender,
}) {
  const parentRef = useRef(null);
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  });

  if (count === 0) return null;

  return (
    <div ref={parentRef} className={className} style={{ overflow: 'auto', maxHeight, width: '100%' }}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((vr) => (
          <div
            key={vr.key}
            data-index={vr.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${vr.start}px)`,
            }}
          >
            {rowRender(vr.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
