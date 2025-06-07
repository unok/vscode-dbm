import React from "react"

// Development helper utilities
export const isDevelopment = process.env.NODE_ENV === "development"
export const isProduction = process.env.NODE_ENV === "production"

// HMR detection
export const isHMREnabled = () => {
  return typeof (import.meta as { hot?: unknown }).hot !== "undefined"
}

// Vite dev server configuration
const getViteDevPort = (): string => {
  // 環境変数から読み込み、デフォルトは5173
  return process.env.VITE_DEV_PORT || "5173"
}

// Vite dev server detection
export const isViteDevServer = () => {
  const devPort = getViteDevPort()
  return typeof window !== "undefined" && window.location.port === devPort && isDevelopment
}

// Environment info
export const getEnvironmentInfo = () => {
  return {
    isDevelopment,
    isProduction,
    isHMREnabled: isHMREnabled(),
    isViteDevServer: isViteDevServer(),
    nodeEnv: process.env.NODE_ENV,
    userAgent: typeof window !== "undefined" ? window.navigator.userAgent : "Unknown",
    location: typeof window !== "undefined" ? window.location.href : "Unknown",
  }
}

// HMR status logging
export const logHMRStatus = () => {
  if (isDevelopment) {
    console.group("🔥 HMR Status")

    if (isHMREnabled()) {
      console.info("✅ Hot Module Replacement is enabled")
    } else {
      console.warn("⚠️ Hot Module Replacement is not available")
    }
    console.groupEnd()
  }
}

// VSCode WebView detection
export const isVSCodeWebView = () => {
  return typeof window !== "undefined" && typeof window.acquireVsCodeApi === "function"
}

// Development overlay component - will be a React component
export const DevelopmentOverlay: React.FC = () => {
  if (!isDevelopment) return null

  const envInfo = getEnvironmentInfo()

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
        React.createElement("div", { key: "vscode" }, `VSCode: ${isVSCodeWebView() ? "✅" : "❌"}`),
      ]
    )
  )
}

// React refresh detection
export const isReactRefreshEnabled = () => {
  return (
    typeof window !== "undefined" &&
    (window as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown }).__REACT_DEVTOOLS_GLOBAL_HOOK__ &&
    isHMREnabled()
  )
}

// Performance monitoring
export const logPerformanceMetrics = () => {
  if (isDevelopment && typeof window !== "undefined" && "performance" in window) {
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
export const testHMR = () => {
  if (isHMREnabled()) {
    return true
  }
  console.warn("⚠️ HMR not available - changes require page reload")
  return false
}

// Auto-run development logging
if (isDevelopment) {
  logHMRStatus()
  logPerformanceMetrics()
}
