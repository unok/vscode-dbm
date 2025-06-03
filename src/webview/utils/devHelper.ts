/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react"

// Development helper utilities
export class DevHelper {
  static isDevelopment = process.env.NODE_ENV === "development"
  static isProduction = process.env.NODE_ENV === "production"

  // HMR detection
  static isHMREnabled = () => {
    return typeof (import.meta as any).hot !== "undefined"
  }

  // Vite dev server detection
  static isViteDevServer = () => {
    return (
      typeof window !== "undefined" && window.location.port === "5173" && DevHelper.isDevelopment
    )
  }

  // Environment info
  static getEnvironmentInfo = () => {
    return {
      isDevelopment: DevHelper.isDevelopment,
      isProduction: DevHelper.isProduction,
      isHMREnabled: DevHelper.isHMREnabled(),
      isViteDevServer: DevHelper.isViteDevServer(),
      nodeEnv: process.env.NODE_ENV,
      userAgent: typeof window !== "undefined" ? window.navigator.userAgent : "Unknown",
      location: typeof window !== "undefined" ? window.location.href : "Unknown",
    }
  }

  // HMR status logging
  static logHMRStatus = () => {
    if (DevHelper.isDevelopment) {
      console.group("🔥 HMR Status")

      if (DevHelper.isHMREnabled()) {
      } else {
        console.warn("⚠️ Hot Module Replacement is not available")
      }
      console.groupEnd()
    }
  }

  // VSCode WebView detection
  static isVSCodeWebView = () => {
    return typeof window !== "undefined" && typeof window.acquireVsCodeApi === "function"
  }

  // Development overlay component - will be a React component
  static DevelopmentOverlay: React.FC = () => {
    if (!DevHelper.isDevelopment) return null

    const envInfo = DevHelper.getEnvironmentInfo()

    return React.createElement(
      "div",
      {
        className: "fixed bottom-4 right-4 z-50 opacity-50 hover:opacity-100 transition-opacity",
      },
      React.createElement(
        "div",
        {
          className:
            "bg-gray-900 text-white text-xs p-2 rounded shadow-lg border border-gray-700 max-w-xs",
        },
        [
          React.createElement(
            "div",
            { key: "title", className: "font-semibold mb-1" },
            "🔧 Dev Info"
          ),
          React.createElement("div", { key: "mode" }, `Mode: ${envInfo.nodeEnv}`),
          React.createElement("div", { key: "hmr" }, `HMR: ${envInfo.isHMREnabled ? "✅" : "❌"}`),
          React.createElement(
            "div",
            { key: "vite" },
            `Vite: ${envInfo.isViteDevServer ? "✅" : "❌"}`
          ),
          React.createElement(
            "div",
            { key: "vscode" },
            `VSCode: ${DevHelper.isVSCodeWebView() ? "✅" : "❌"}`
          ),
        ]
      )
    )
  }

  // React refresh detection
  static isReactRefreshEnabled = () => {
    return (
      typeof window !== "undefined" &&
      (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ &&
      DevHelper.isHMREnabled()
    )
  }

  // Performance monitoring
  static logPerformanceMetrics = () => {
    if (DevHelper.isDevelopment && typeof window !== "undefined" && "performance" in window) {
      setTimeout(() => {
        const _navigation = performance.getEntriesByType(
          "navigation"
        )[0] as PerformanceNavigationTiming
        console.group("⚡ Performance Metrics")
        console.groupEnd()
      }, 1000)
    }
  }

  // Test HMR functionality
  static testHMR = () => {
    if (DevHelper.isHMREnabled()) {
      return true
    }
    console.warn("⚠️ HMR not available - changes require page reload")
    return false
  }
}

// Auto-run development logging
if (DevHelper.isDevelopment) {
  DevHelper.logHMRStatus()
  DevHelper.logPerformanceMetrics()
}
