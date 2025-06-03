/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/webview/**/*.{js,ts,jsx,tsx,html}",
    "./src/webview/index.html"
  ],
  theme: {
    extend: {
      colors: {
        // VSCode theme integration
        vscode: {
          'editor-bg': 'var(--vscode-editor-background)',
          'editor-fg': 'var(--vscode-editor-foreground)',
          'button-bg': 'var(--vscode-button-background)',
          'button-hover': 'var(--vscode-button-hoverBackground)',
          'button-secondary': 'var(--vscode-button-secondaryBackground)',
          'input-bg': 'var(--vscode-input-background)',
          'input-border': 'var(--vscode-input-border)',
          'panel-border': 'var(--vscode-panel-border)',
          'list-hover': 'var(--vscode-list-hoverBackground)',
          'list-active': 'var(--vscode-list-activeSelectionBackground)',
          'sidebar-bg': 'var(--vscode-sideBar-background)',
          'activitybar-bg': 'var(--vscode-activityBar-background)',
          'tab-active': 'var(--vscode-tab-activeBackground)',
          'tab-inactive': 'var(--vscode-tab-inactiveBackground)',
          'error': 'var(--vscode-errorForeground)',
          'warning': 'var(--vscode-warningForeground)',
          'success': 'var(--vscode-terminal-ansiGreen)',
          'info': 'var(--vscode-terminal-ansiBlue)'
        }
      },
      fontFamily: {
        'vscode': ['var(--vscode-font-family)', 'monospace']
      },
      fontSize: {
        'vscode': ['var(--vscode-font-size)', { lineHeight: 'var(--vscode-font-size)' }]
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'pulse-slow': 'pulse 3s infinite'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        }
      }
    }
  },
  plugins: [],
  // Ensure compatibility with VSCode webview environment
  corePlugins: {
    preflight: false // Disable Tailwind's base styles to avoid conflicts with VSCode
  },
  darkMode: "class"
}
