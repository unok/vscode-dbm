import { useEffect, useState } from "react"
import { vscodeApi } from "../api/vscode"

type Theme = "dark" | "light"

export const useVSCodeTheme = (): Theme => {
  const [theme, setTheme] = useState<Theme>("dark")

  useEffect(() => {
    // VSCode theme detection
    const detectTheme = () => {
      const body = document.body
      const computedStyle = getComputedStyle(body)
      const backgroundColor = computedStyle.getPropertyValue("--vscode-editor-background")

      // If background is light, use light theme, otherwise dark
      if (backgroundColor) {
        // Convert hex/rgb to brightness
        const isLight = isLightColor(backgroundColor)
        const detectedTheme = isLight ? "light" : "dark"
        setTheme(detectedTheme)

        // Apply theme class to body for Tailwind
        document.body.classList.remove("light", "dark")
        document.body.classList.add(detectedTheme)
      }
    }

    // Listen for theme changes from VSCode API
    vscodeApi.onMessage("themeChanged", (data) => {
      const themeData = data as { kind?: "light" | "dark" }
      if (themeData.kind) {
        setTheme(themeData.kind)
        document.body.classList.remove("light", "dark")
        document.body.classList.add(themeData.kind)
      }
    })

    // Initial detection
    detectTheme()

    // Listen for theme changes via CSS variable changes
    const observer = new MutationObserver(() => {
      detectTheme()
    })

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "style"],
    })

    // Request current theme from VSCode
    vscodeApi.getTheme()

    return () => {
      observer.disconnect()
      vscodeApi.removeMessageHandler("themeChanged")
    }
  }, [])

  return theme
}

function isLightColor(color: string): boolean {
  // Simple heuristic: if the color value suggests a light background
  // This is a basic implementation - can be improved
  if (color.includes("rgb")) {
    const match = color.match(/\d+/g)
    if (match) {
      const [r, g, b] = match.map(Number)
      const brightness = (r * 299 + g * 587 + b * 114) / 1000
      return brightness > 128
    }
  }

  // Default to dark theme
  return false
}
