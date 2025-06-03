import type { VirtualScrollConfig, VirtualScrollRange } from "../types/datagrid"

export interface VirtualScrollState {
  scrollTop: number
  containerHeight: number
  totalItems: number
  visibleRange: VirtualScrollRange
  isScrolling: boolean
}

export class VirtualScrollManager {
  private config: VirtualScrollConfig
  private state: VirtualScrollState
  private itemHeights: Map<number, number> = new Map()
  private scrollTimeout: NodeJS.Timeout | null = null
  private callbacks: {
    onScrollChange?: (range: VirtualScrollRange) => void
    onScrollStart?: () => void
    onScrollEnd?: () => void
  } = {}

  constructor(config: VirtualScrollConfig) {
    this.config = {
      bufferSize: 5,
      overscan: 2,
      ...config,
    }

    this.state = {
      scrollTop: 0,
      containerHeight: config.containerHeight,
      totalItems: 0,
      visibleRange: { start: 0, end: 0, visibleStart: 0, visibleEnd: 0 },
      isScrolling: false,
    }

    if (typeof config.itemHeight === "function") {
      // Pre-calculate some heights for dynamic sizing
      this.precalculateHeights()
    }
  }

  isEnabled(): boolean {
    return this.config.enabled
  }

  setTotalItems(count: number): void {
    this.state.totalItems = count
    this.updateVisibleRange()
  }

  setScrollTop(scrollTop: number): void {
    if (this.state.scrollTop === scrollTop) return

    this.state.scrollTop = Math.max(0, scrollTop)
    this.state.isScrolling = true

    this.callbacks.onScrollStart?.()
    this.updateVisibleRange()

    // Debounce scroll end detection
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout)
    }

    this.scrollTimeout = setTimeout(() => {
      this.state.isScrolling = false
      this.callbacks.onScrollEnd?.()
    }, 150)
  }

  setContainerHeight(height: number): void {
    this.state.containerHeight = height
    this.updateVisibleRange()
  }

  getVisibleRange(): VirtualScrollRange {
    return { ...this.state.visibleRange }
  }

  getItemHeight(index: number): number {
    if (typeof this.config.itemHeight === "function") {
      // Check cache first
      if (this.itemHeights.has(index)) {
        return this.itemHeights.get(index)!
      }

      const height = this.config.itemHeight(index)
      this.itemHeights.set(index, height)
      return height
    }

    return this.config.itemHeight as number
  }

  getTotalHeight(): number {
    if (typeof this.config.itemHeight === "function") {
      // Calculate total height for dynamic heights
      let total = 0
      for (let i = 0; i < this.state.totalItems; i++) {
        total += this.getItemHeight(i)
      }
      return total
    }

    return this.state.totalItems * (this.config.itemHeight as number)
  }

  getOffsetForIndex(index: number): number {
    if (typeof this.config.itemHeight === "function") {
      let offset = 0
      for (let i = 0; i < index; i++) {
        offset += this.getItemHeight(i)
      }
      return offset
    }

    return index * (this.config.itemHeight as number)
  }

  getIndexForOffset(offset: number): number {
    if (typeof this.config.itemHeight === "function") {
      let currentOffset = 0
      for (let i = 0; i < this.state.totalItems; i++) {
        const itemHeight = this.getItemHeight(i)
        if (currentOffset + itemHeight > offset) {
          return i
        }
        currentOffset += itemHeight
      }
      return this.state.totalItems - 1
    }

    return Math.floor(offset / (this.config.itemHeight as number))
  }

  getItemsInRange(
    start: number,
    end: number
  ): Array<{
    index: number
    offset: number
    height: number
  }> {
    const items = []

    for (let index = start; index <= end && index < this.state.totalItems; index++) {
      items.push({
        index,
        offset: this.getOffsetForIndex(index),
        height: this.getItemHeight(index),
      })
    }

    return items
  }

  onScrollChange(callback: (range: VirtualScrollRange) => void): void {
    this.callbacks.onScrollChange = callback
  }

  onScrollStart(callback: () => void): void {
    this.callbacks.onScrollStart = callback
  }

  onScrollEnd(callback: () => void): void {
    this.callbacks.onScrollEnd = callback
  }

  getScrollState(): VirtualScrollState {
    return { ...this.state }
  }

  // Performance optimization: estimate visible items without full calculation
  estimateVisibleItems(): { start: number; count: number } {
    const averageHeight =
      typeof this.config.itemHeight === "function"
        ? this.calculateAverageHeight()
        : (this.config.itemHeight as number)

    const start = Math.floor(this.state.scrollTop / averageHeight)
    const count = Math.ceil(this.state.containerHeight / averageHeight) + 1

    return {
      start: Math.max(0, start),
      count: Math.min(count, this.state.totalItems - start),
    }
  }

  // Smooth scrolling to specific index
  scrollToIndex(index: number, alignment: "start" | "center" | "end" = "start"): number {
    const itemOffset = this.getOffsetForIndex(index)
    const itemHeight = this.getItemHeight(index)

    let targetScrollTop: number

    switch (alignment) {
      case "center":
        targetScrollTop = itemOffset - (this.state.containerHeight - itemHeight) / 2
        break
      case "end":
        targetScrollTop = itemOffset - this.state.containerHeight + itemHeight
        break
      case "start":
      default:
        targetScrollTop = itemOffset
        break
    }

    return Math.max(
      0,
      Math.min(targetScrollTop, this.getTotalHeight() - this.state.containerHeight)
    )
  }

  // Get the currently visible items with their positions
  getVisibleItems(): Array<{
    index: number
    offset: number
    height: number
    isVisible: boolean
  }> {
    const range = this.state.visibleRange
    const items = []

    for (let index = range.start; index <= range.end && index < this.state.totalItems; index++) {
      const offset = this.getOffsetForIndex(index)
      const height = this.getItemHeight(index)
      const isVisible = index >= range.visibleStart && index <= range.visibleEnd

      items.push({
        index,
        offset,
        height,
        isVisible,
      })
    }

    return items
  }

  // Update configuration
  updateConfig(newConfig: Partial<VirtualScrollConfig>): void {
    this.config = { ...this.config, ...newConfig }

    if (newConfig.containerHeight) {
      this.state.containerHeight = newConfig.containerHeight
    }

    if (newConfig.itemHeight) {
      this.itemHeights.clear() // Clear cache when item height changes
    }

    this.updateVisibleRange()
  }

  private updateVisibleRange(): void {
    const { scrollTop, containerHeight, totalItems } = this.state
    const { bufferSize = 5, overscan = 2 } = this.config

    if (totalItems === 0) {
      this.state.visibleRange = { start: 0, end: 0, visibleStart: 0, visibleEnd: 0 }
      this.callbacks.onScrollChange?.(this.state.visibleRange)
      return
    }

    // Calculate visible range
    const visibleStart = this.getIndexForOffset(scrollTop)
    const visibleEnd = Math.min(this.getIndexForOffset(scrollTop + containerHeight), totalItems - 1)

    // Add buffer and overscan
    const start = Math.max(0, visibleStart - bufferSize - overscan)
    const end = Math.min(totalItems - 1, visibleEnd + bufferSize + overscan)

    this.state.visibleRange = {
      start,
      end,
      visibleStart,
      visibleEnd,
    }

    this.callbacks.onScrollChange?.(this.state.visibleRange)
  }

  private calculateAverageHeight(): number {
    if (this.itemHeights.size === 0) {
      return typeof this.config.itemHeight === "function"
        ? this.config.itemHeight(0)
        : (this.config.itemHeight as number)
    }

    const heights = Array.from(this.itemHeights.values())
    return heights.reduce((sum, height) => sum + height, 0) / heights.length
  }

  private precalculateHeights(): void {
    if (typeof this.config.itemHeight !== "function") return

    // Pre-calculate heights for first few items to get better estimates
    const precalculateCount = Math.min(100, this.state.totalItems)

    for (let i = 0; i < precalculateCount; i++) {
      this.getItemHeight(i)
    }
  }

  // Memory management
  clearCache(): void {
    this.itemHeights.clear()
  }

  // Performance monitoring
  getPerformanceMetrics(): {
    cachedHeights: number
    totalItems: number
    visibleItems: number
    bufferItems: number
  } {
    const range = this.state.visibleRange
    const visibleItems = range.visibleEnd - range.visibleStart + 1
    const bufferItems = range.end - range.start + 1 - visibleItems

    return {
      cachedHeights: this.itemHeights.size,
      totalItems: this.state.totalItems,
      visibleItems,
      bufferItems,
    }
  }

  dispose(): void {
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout)
    }

    this.itemHeights.clear()
    this.callbacks = {}
  }
}
