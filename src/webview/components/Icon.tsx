import type React from "react";

export interface IconProps {
  name: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  title?: string;
}

/**
 * VSCode Codicon アイコンコンポーネント
 * VSCode のテーマ統合されたアイコンフォントを使用
 * フォント読み込み失敗時はUnicodeフォールバックを表示
 */
export const Icon: React.FC<IconProps> = ({
  name,
  className = "",
  size = "md",
  title,
}) => {
  const sizeClasses = {
    sm: "text-sm", // 14px
    md: "text-base", // 16px
    lg: "text-lg", // 18px
  };

  // nameがすでにcodicon-で始まっている場合はそのまま使用、そうでなければ追加
  const iconClass = name.startsWith("codicon-") ? name : `codicon-${name}`;

  return (
    <span
      className={`codicon ${iconClass} ${sizeClasses[size]} ${className}`}
      title={title}
      aria-hidden="true"
      style={{
        fontFamily: "codicon, 'Segoe UI Symbol', monospace",
      }}
    />
  );
};

/**
 * 一般的に使用されるアイコン名の定数
 */
export const IconNames = {
  // Database
  DATABASE: "database",
  TABLE: "table",
  COLUMN: "symbol-field",

  // Connection
  PLUG: "plug",
  REFRESH: "refresh",

  // Query
  FILE_CODE: "file-code",
  PLAY: "play",
  SAVE: "save",
  SYMBOL_KEYWORD: "symbol-keyword",

  // Data
  CLOUD_UPLOAD: "cloud-upload",
  HISTORY: "history",

  // Navigation
  CHEVRON_RIGHT: "chevron-right",
  CHEVRON_DOWN: "chevron-down",
  FOLDER: "folder",
  FOLDER_OPENED: "folder-opened",

  // Actions
  ADD: "add",
  EDIT: "edit",
  TRASH: "trash",
  CLOSE: "close",
  SEARCH: "search",

  // File types
  FILE: "file",
  SYMBOL_CLASS: "symbol-class",
  SYMBOL_INTERFACE: "symbol-interface",
  SYMBOL_FUNCTION: "symbol-function",
} as const;

export type IconName = (typeof IconNames)[keyof typeof IconNames];
