#!/bin/bash

# データベース初期化スクリプト
set -e

echo "🚀 データベース環境初期化中..."

# 開発環境のデータベースが起動するまで待機
echo "📡 データベース起動を待機中..."
sleep 10

# MySQL接続テスト
echo "🔍 MySQL接続テスト..."
until mysql -h mysql-dev -u dev_user -pdev_password -e "SELECT 1" &> /dev/null; do
    echo "MySQL接続待機中..."
    sleep 2
done
echo "✅ MySQL接続成功"

# PostgreSQL接続テスト
echo "🔍 PostgreSQL接続テスト..."
until PGPASSWORD=dev_password psql -h postgres-dev -U dev_user -d test_db -c "SELECT 1" &> /dev/null; do
    echo "PostgreSQL接続待機中..."
    sleep 2
done
echo "✅ PostgreSQL接続成功"

# SQLiteファイル作成
echo "🔍 SQLite初期化..."
sqlite3 /workspace/test.db < /workspace/scripts/sqlite-test-data.sql
echo "✅ SQLite初期化完了"

echo "🎉 全データベース初期化完了!"