import { http, HttpResponse } from 'msw';

// APIモックハンドラー
export const handlers = [
  // データベース接続APIのモック
  http.post('/api/database/connect', () => {
    return HttpResponse.json({
      success: true,
      connectionId: 'mock-connection-123',
      dbType: 'mysql',
    });
  }),

  // テーブル一覧取得APIのモック
  http.get('/api/database/:connectionId/tables', () => {
    return HttpResponse.json({
      success: true,
      tables: [
        { name: 'users', type: 'table' },
        { name: 'projects', type: 'table' },
        { name: 'user_projects', type: 'table' },
      ],
    });
  }),

  // テーブルデータ取得APIのモック
  http.get('/api/database/:connectionId/tables/:tableName/data', () => {
    return HttpResponse.json({
      success: true,
      data: [
        {
          id: '1',
          name: 'テストユーザー1',
          email: 'test1@example.com',
          department: 'テスト部',
        },
        {
          id: '2',
          name: 'テストユーザー2',
          email: 'test2@example.com',
          department: 'QA部',
        },
      ],
      total: 2,
    });
  }),

  // SQLクエリ実行APIのモック
  http.post('/api/database/:connectionId/query', () => {
    return HttpResponse.json({
      success: true,
      results: [
        {
          id: '1',
          name: 'クエリ結果1',
          value: 100,
        },
      ],
      executionTime: 120,
    });
  }),
];