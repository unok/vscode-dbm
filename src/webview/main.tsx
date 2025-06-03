import React from "react"
import { createRoot } from "react-dom/client"
import { App } from "./App"
import "./styles/globals.css"

const container = document.getElementById("root")
if (!container) {
  throw new Error("Root element not found")
}

const root = createRoot(container)

// React 19 concurrent features
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
