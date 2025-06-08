import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/globals.css";
import "./styles/table-details.css";

function initializeApp() {
  const container = document.getElementById("root");
  if (!container) {
    console.error("Root element not found! DOM state:", document.readyState);
    console.error("Body contents:", document.body.innerHTML);
    throw new Error("Root element not found");
  }
  const root = createRoot(container);

  // React 19 concurrent features
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

// Ensure DOM is ready before initializing React
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  // DOM is already loaded
  initializeApp();
}
