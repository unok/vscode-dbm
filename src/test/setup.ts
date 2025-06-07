import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";

// Jest互換のグローバルAPIをセットアップ
beforeAll(() => {
  // React Testing Library のセットアップ
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {
        /* MediaQueryList mock */
      },
      removeListener: () => {
        /* MediaQueryList mock */
      },
      addEventListener: () => {
        /* MediaQueryList mock */
      },
      removeEventListener: () => {
        /* MediaQueryList mock */
      },
      dispatchEvent: () => {
        /* MediaQueryList mock */
      },
    }),
  });

  // ResizeObserver モック
  global.ResizeObserver = class ResizeObserver {
    observe() {
      /* ResizeObserver mock */
    }
    unobserve() {
      /* ResizeObserver mock */
    }
    disconnect() {
      /* ResizeObserver mock */
    }
  };

  // IntersectionObserver モック
  global.IntersectionObserver = class IntersectionObserver {
    observe() {
      /* IntersectionObserver mock */
    }
    unobserve() {
      /* IntersectionObserver mock */
    }
    disconnect() {
      /* IntersectionObserver mock */
    }
    takeRecords() {
      return [];
    }
    root = null;
    rootMargin = "";
    thresholds = [];
  };
});

// 各テスト後のクリーンアップ
afterEach(() => {
  cleanup();
});

afterAll(() => {
  // 全テスト完了後のクリーンアップ
});
