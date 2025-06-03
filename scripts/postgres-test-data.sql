-- PostgreSQL テスト環境用データ

-- UUID拡張を有効化
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- テストデータのクリア
DELETE FROM user_projects;
DELETE FROM projects;
DELETE FROM users;

-- テスト用ユーザーデータ
INSERT INTO users (name, email, department, hire_date, salary) VALUES
('テスト太郎', 'test.taro@test.com', 'テスト部', '2023-01-01', 300000.00),
('テスト花子', 'test.hanako@test.com', 'QA部', '2023-02-01', 350000.00),
('テスト次郎', 'test.jiro@test.com', 'Dev部', '2023-03-01', 400000.00);

-- テスト用プロジェクトデータ
INSERT INTO projects (name, description, status, start_date, end_date) VALUES
('テストプロジェクトA', 'テスト用プロジェクト1', 'active', '2024-01-01', '2024-06-30'),
('テストプロジェクトB', 'テスト用プロジェクト2', 'planning', '2024-03-01', '2024-09-30');