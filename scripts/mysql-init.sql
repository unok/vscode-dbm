-- MySQL開発環境初期化スクリプト
CREATE DATABASE IF NOT EXISTS test_db;
USE test_db;

-- サンプルテーブル作成
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    department VARCHAR(50),
    hire_date DATE,
    salary DECIMAL(10,2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    status ENUM('planning', 'active', 'completed', 'cancelled') DEFAULT 'planning',
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_projects (
    user_id VARCHAR(36),
    project_id VARCHAR(36),
    role VARCHAR(50) DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, project_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- サンプルデータ投入
INSERT INTO users (name, email, department, hire_date, salary) VALUES
('田中太郎', 'tanaka@example.com', '営業部', '2020-04-01', 450000.00),
('佐藤花子', 'sato@example.com', '開発部', '2019-03-15', 520000.00),
('鈴木一郎', 'suzuki@example.com', '人事部', '2021-06-01', 380000.00),
('高橋美咲', 'takahashi@example.com', '開発部', '2022-01-10', 480000.00),
('山田次郎', 'yamada@example.com', '営業部', '2020-08-20', 420000.00);

INSERT INTO projects (name, description, status, start_date, end_date) VALUES
('新商品開発プロジェクト', 'Q2向け新商品の企画・開発', 'active', '2024-01-15', '2024-06-30'),
('基幹システム刷新', 'レガシーシステムのモダン化', 'planning', '2024-04-01', '2024-12-31'),
('営業支援ツール導入', 'CRM・SFAシステムの導入と運用', 'completed', '2023-06-01', '2023-12-31');