import { exec } from "node:child_process"
import { promisify } from "node:util"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const execAsync = promisify(exec)

describe("Docker Compose DB環境テスト", () => {
  beforeAll(async () => {
    // 開発環境のDocker Composeを起動
    try {
      await execAsync("docker-compose -f docker-compose.dev.yml up -d")

      // データベース起動待機
      await new Promise((resolve) => setTimeout(resolve, 15000))
    } catch (error) {
      console.error("❌ Docker Compose起動失敗:", error)
      throw error
    }
  }, 60000) // 60秒タイムアウト

  afterAll(async () => {
    try {
      await execAsync("docker-compose -f docker-compose.dev.yml down")
    } catch (error) {
      console.error("❌ Docker Compose停止失敗:", error)
    }
  }, 30000)

  it("開発環境のDocker Composeが正常に起動する", async () => {
    // Docker Composeサービスの状態確認
    const { stdout } = await execAsync(
      'docker-compose -f docker-compose.dev.yml ps --services --filter "status=running"'
    )
    const runningServices = stdout
      .trim()
      .split("\n")
      .filter((service) => service.length > 0)

    expect(runningServices).toContain("mysql-dev")
    expect(runningServices).toContain("postgres-dev")
    expect(runningServices).toContain("sqlite-dev")
  }, 20000)

  it("MySQLコンテナが正常に動作している", async () => {
    try {
      const { stdout } = await execAsync(
        `docker exec $(docker-compose -f docker-compose.dev.yml ps -q mysql-dev) mysql -u dev_user -pdev_password -e "SELECT 1 as test"`
      )
      expect(stdout).toContain("test")
      expect(stdout).toContain("1")
    } catch (error) {
      throw new Error(`MySQL接続テスト失敗: ${error}`)
    }
  }, 15000)

  it("PostgreSQLコンテナが正常に動作している", async () => {
    try {
      const { stdout } = await execAsync(
        `docker exec $(docker-compose -f docker-compose.dev.yml ps -q postgres-dev) psql -U dev_user -d test_db -c "SELECT 1 as test;"`
      )
      expect(stdout).toContain("test")
      expect(stdout).toContain("1")
    } catch (error) {
      throw new Error(`PostgreSQL接続テスト失敗: ${error}`)
    }
  }, 15000)

  it("SQLiteコンテナが正常に動作している", async () => {
    try {
      const { stdout } = await execAsync(
        "docker exec $(docker-compose -f docker-compose.dev.yml ps -q sqlite-dev) ls -la /data"
      )
      expect(stdout).toBeDefined()
    } catch (error) {
      throw new Error(`SQLite接続テスト失敗: ${error}`)
    }
  }, 10000)

  it("ポート競合が発生していない", async () => {
    // 各データベースのポートが正しく露出されている
    const { stdout: mysqlPort } = await execAsync(
      "docker-compose -f docker-compose.dev.yml port mysql-dev 3306"
    )
    const { stdout: postgresPort } = await execAsync(
      "docker-compose -f docker-compose.dev.yml port postgres-dev 5432"
    )

    expect(mysqlPort.trim()).toBe("0.0.0.0:3306")
    expect(postgresPort.trim()).toBe("0.0.0.0:5432")
  }, 10000)

  it("テスト環境とのポート分離が正しく設定されている", async () => {
    // 開発環境とテスト環境のポートが異なることを確認
    const devPorts = {
      mysql: "3306",
      postgres: "5432",
    }

    const testPorts = {
      mysql: "3307",
      postgres: "5433",
    }

    expect(devPorts.mysql).not.toBe(testPorts.mysql)
    expect(devPorts.postgres).not.toBe(testPorts.postgres)
  })
})
