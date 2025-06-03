import React, { useEffect, useRef, useState, useCallback } from 'react'
import type { VirtualScrollManager } from '../../../shared/utils/VirtualScrollManager'

interface VirtualScrollContainerProps {
  manager: VirtualScrollManager
  totalItems: number
  containerHeight: number
  children: React.ReactNode
}

export const VirtualScrollContainer: React.FC<VirtualScrollContainerProps> = ({
  manager,
  totalItems,
  containerHeight,
  children
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [isScrolling, setIsScrolling] = useState(false)

  // Update manager with total items
  useEffect(() => {
    manager.setTotalItems(totalItems)
  }, [manager, totalItems])

  // Handle scroll events
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop
    setScrollTop(newScrollTop)
    manager.setScrollTop(newScrollTop)
    setIsScrolling(true)
  }, [manager])

  // Set up scroll end detection
  useEffect(() => {
    manager.onScrollStart(() => setIsScrolling(true))
    manager.onScrollEnd(() => setIsScrolling(false))
  }, [manager])

  // Get visible range and items
  const visibleRange = manager.getVisibleRange()
  const visibleItems = manager.getVisibleItems()
  const totalHeight = manager.getTotalHeight()

  return (
    <div className="virtual-scroll-container">
      <div
        ref={containerRef}
        className="virtual-scroll-viewport"
        style={{
          height: containerHeight,
          overflow: 'auto',
          position: 'relative'
        }}
        onScroll={handleScroll}
      >
        {/* Total height spacer */}
        <div
          style={{
            height: totalHeight,
            position: 'relative'
          }}
        >
          {/* Visible content */}
          <div
            style={{
              position: 'absolute',
              top: visibleItems.length > 0 ? visibleItems[0].offset : 0,
              width: '100%'
            }}
          >
            {children}
          </div>
        </div>
      </div>

      {/* Scroll indicators */}
      {isScrolling && (
        <div className="scroll-indicators">
          <div className="scroll-position">
            {visibleRange.visibleStart + 1} - {visibleRange.visibleEnd + 1} of {totalItems}
          </div>
          <div className="scroll-progress">
            <div
              className="scroll-progress-bar"
              style={{
                width: `${((visibleRange.visibleEnd - visibleRange.visibleStart + 1) / totalItems) * 100}%`,
                left: `${(visibleRange.visibleStart / totalItems) * 100}%`
              }}
            />
          </div>
        </div>
      )}

      {/* Performance metrics (debug) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="virtual-scroll-debug">
          <div>Rendered: {visibleRange.end - visibleRange.start + 1} / {totalItems}</div>
          <div>Buffer: {visibleRange.start}-{visibleRange.visibleStart}, {visibleRange.visibleEnd}-{visibleRange.end}</div>
          <div>Scroll: {scrollTop.toFixed(0)}px / {totalHeight.toFixed(0)}px</div>
        </div>
      )}
    </div>
  )
}