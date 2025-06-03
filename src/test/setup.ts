import "@testing-library/jest-dom"
import { cleanup } from "@testing-library/react"
import { afterAll, afterEach, beforeAll } from "vitest"

// Jest互換のグローバルAPIをセットアップ
beforeAll(() => {
  // React Testing Library のセットアップ
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  })

  // ResizeObserver モック
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  // IntersectionObserver モック
  global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
    root = null
    rootMargin = ""
    thresholds = []
  }
})

// 各テスト後のクリーンアップ
afterEach(() => {
  cleanup()
})

afterAll(() => {
  // 全テスト完了後のクリーンアップ
})
