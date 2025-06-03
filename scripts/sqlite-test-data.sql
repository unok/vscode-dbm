-- SQLite テスト環境初期化スクリプト

-- サンプルテーブル作成
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    department TEXT,
    hire_date DATE,
    salary REAL,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'cancelled')),
    start_date DATE,
    end_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_projects (
    user_id TEXT,
    project_id TEXT,
    role TEXT DEFAULT 'member',
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, project_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- トリガーでupdated_at自動更新
CREATE TRIGGER IF NOT EXISTS update_users_updated_at
    AFTER UPDATE ON users
    FOR EACH ROW
    BEGIN
        UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- サンプルデータ投入
INSERT OR IGNORE INTO users (name, email, department, hire_date, salary) VALUES
('田中太郎', 'tanaka@example.com', '営業部', '2020-04-01', 450000.00),
('佐藤花子', 'sato@example.com', '開発部', '2019-03-15', 520000.00),
('鈴木一郎', 'suzuki@example.com', '人事部', '2021-06-01', 380000.00),
('高橋美咲', 'takahashi@example.com', '開発部', '2022-01-10', 480000.00),
('山田次郎', 'yamada@example.com', '営業部', '2020-08-20', 420000.00);

INSERT OR IGNORE INTO projects (name, description, status, start_date, end_date) VALUES
('新商品開発プロジェクト', 'Q2向け新商品の企画・開発', 'active', '2024-01-15', '2024-06-30'),
('基幹システム刷新', 'レガシーシステムのモダン化', 'planning', '2024-04-01', '2024-12-31'),
('営業支援ツール導入', 'CRM・SFAシステムの導入と運用', 'completed', '2023-06-01', '2023-12-31');