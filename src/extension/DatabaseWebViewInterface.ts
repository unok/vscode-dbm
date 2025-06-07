import type { BaseMessage, ExecuteQueryMessage } from "../shared/types/messages"

/**
 * DatabaseWebViewProvider の公開インターフェース
 * プライベートメンバーへのアクセスを避けるための型定義
 */
export interface DatabaseQueryHandler {
  handleQuery(
    query: ExecuteQueryMessage["data"],
    resultCallback: (message: BaseMessage) => void
  ): Promise<void>
}

/**
 * クエリ実行結果のコールバック型
 */
export type QueryResultCallback = (message: BaseMessage) => void
