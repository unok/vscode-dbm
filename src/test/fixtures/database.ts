// テスト用のデータベース関連フィクスチャ

export const mockDatabaseConfig = {
  mysql: {
    host: 'localhost',
    port: 3306,
    user: 'test_user',
    password: 'test_password',
    database: 'test_db',
  },
  postgresql: {
    host: 'localhost',
    port: 5432,
    user: 'test_user',
    password: 'test_password',
    database: 'test_db',
  },
  sqlite: {
    database: ':memory:',
  },
};

export const mockTableSchema = {
  users: [
    { name: 'id', type: 'VARCHAR(36)', isPrimaryKey: true },
    { name: 'name', type: 'VARCHAR(100)', nullable: false },
    { name: 'email', type: 'VARCHAR(255)', nullable: false, unique: true },
    { name: 'department', type: 'VARCHAR(50)', nullable: true },
    { name: 'hire_date', type: 'DATE', nullable: true },
    { name: 'salary', type: 'DECIMAL(10,2)', nullable: true },
    { name: 'is_active', type: 'BOOLEAN', defaultValue: true },
    { name: 'created_at', type: 'TIMESTAMP', defaultValue: 'CURRENT_TIMESTAMP' },
    { name: 'updated_at', type: 'TIMESTAMP', defaultValue: 'CURRENT_TIMESTAMP' },
  ],
};

export const mockTableData = {
  users: [
    {
      id: 'user-001',
      name: '田中太郎',
      email: 'tanaka@example.com',
      department: '営業部',
      hire_date: '2020-04-01',
      salary: 450000.00,
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'user-002',
      name: '佐藤花子',
      email: 'sato@example.com',
      department: '開発部',
      hire_date: '2019-03-15',
      salary: 520000.00,
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ],
};