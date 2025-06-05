import { SQLFormatter } from "@/shared/services/SQLFormatter"
import { beforeEach, describe, expect, test } from "vitest"

describe("SQLFormatter", () => {
  let formatter: SQLFormatter

  beforeEach(() => {
    formatter = new SQLFormatter()
  })

  describe("基本的なフォーマット", () => {
    test("単純なSELECT文をフォーマットする", () => {
      const input = "SELECT id, name FROM users WHERE active = true"
      const expected = `SELECT
  id,
  name
FROM
  users
WHERE
  active = true`

      expect(formatter.format(input)).toBe(expected)
    })

    test("複数行のSELECT文を整形する", () => {
      const input = `SELECT id,name,email
FROM users
WHERE active=true AND created_at>'2024-01-01'`

      const expected = `SELECT
  id,
  name,
  email
FROM
  users
WHERE
  active = true
  AND created_at > '2024-01-01'`

      expect(formatter.format(input)).toBe(expected)
    })
  })

  describe("JOIN文のフォーマット", () => {
    test("INNER JOINを適切にインデントする", () => {
      const input = "SELECT u.name, p.title FROM users u INNER JOIN posts p ON u.id = p.user_id"

      const expected = `SELECT
  u.name,
  p.title
FROM
  users u
  INNER JOIN posts p ON u.id = p.user_id`

      expect(formatter.format(input)).toBe(expected)
    })

    test("複数のJOINを整形する", () => {
      const input = `SELECT u.name, p.title, c.content
FROM users u
JOIN posts p ON u.id = p.user_id
LEFT JOIN comments c ON p.id = c.post_id
WHERE u.active = true`

      const expected = `SELECT
  u.name,
  p.title,
  c.content
FROM
  users u
  JOIN posts p ON u.id = p.user_id
  LEFT JOIN comments c ON p.id = c.post_id
WHERE
  u.active = true`

      expect(formatter.format(input)).toBe(expected)
    })
  })

  describe("サブクエリのフォーマット", () => {
    test("WHERE句内のサブクエリを整形する", () => {
      const input =
        "SELECT * FROM users WHERE id IN (SELECT user_id FROM posts WHERE published = true)"

      const expected = `SELECT
  *
FROM
  users
WHERE
  id IN (
    SELECT
      user_id
    FROM
      posts
    WHERE
      published = true
  )`

      expect(formatter.format(input)).toBe(expected)
    })

    test("FROM句内のサブクエリを整形する", () => {
      const input =
        "SELECT u.name, post_count FROM users u JOIN (SELECT user_id, COUNT(*) as post_count FROM posts GROUP BY user_id) p ON u.id = p.user_id"

      const expected = `SELECT
  u.name,
  post_count
FROM
  users u
  JOIN (
    SELECT
      user_id,
      COUNT(*) as post_count
    FROM
      posts
    GROUP BY
      user_id
  ) p ON u.id = p.user_id`

      expect(formatter.format(input)).toBe(expected)
    })
  })

  describe("集計関数とGROUP BY", () => {
    test("GROUP BY句を整形する", () => {
      const input =
        "SELECT department, COUNT(*) as count, AVG(salary) as avg_salary FROM employees GROUP BY department HAVING COUNT(*) > 5"

      const expected = `SELECT
  department,
  COUNT(*) as count,
  AVG(salary) as avg_salary
FROM
  employees
GROUP BY
  department
HAVING
  COUNT(*) > 5`

      expect(formatter.format(input)).toBe(expected)
    })

    test("複数カラムのGROUP BYを整形する", () => {
      const input =
        "SELECT year, month, SUM(amount) FROM sales GROUP BY year, month ORDER BY year DESC, month DESC"

      const expected = `SELECT
  year,
  month,
  SUM(amount)
FROM
  sales
GROUP BY
  year,
  month
ORDER BY
  year DESC,
  month DESC`

      expect(formatter.format(input)).toBe(expected)
    })
  })

  describe("CASE文のフォーマット", () => {
    test("単純なCASE文を整形する", () => {
      const input = `SELECT name, CASE WHEN age < 18 THEN 'Minor' WHEN age >= 65 THEN 'Senior' ELSE 'Adult' END as category FROM users`

      const expected = `SELECT
  name,
  CASE
    WHEN age < 18 THEN 'Minor'
    WHEN age >= 65 THEN 'Senior'
    ELSE 'Adult'
  END as category
FROM
  users`

      expect(formatter.format(input)).toBe(expected)
    })

    test("ネストしたCASE文を整形する", () => {
      const input = `SELECT CASE WHEN type = 'A' THEN CASE WHEN status = 'active' THEN 'A-Active' ELSE 'A-Inactive' END ELSE 'Other' END FROM items`

      const expected = `SELECT
  CASE
    WHEN type = 'A' THEN
      CASE
        WHEN status = 'active' THEN 'A-Active'
        ELSE 'A-Inactive'
      END
    ELSE 'Other'
  END
FROM
  items`

      expect(formatter.format(input)).toBe(expected)
    })
  })

  describe("INSERT/UPDATE/DELETE文", () => {
    test("INSERT文を整形する", () => {
      const input =
        "INSERT INTO users (name, email, created_at) VALUES ('John Doe', 'john@example.com', NOW())"

      const expected = `INSERT INTO users (
  name,
  email,
  created_at
)
VALUES (
  'John Doe',
  'john@example.com',
  NOW()
)`

      expect(formatter.format(input)).toBe(expected)
    })

    test("UPDATE文を整形する", () => {
      const input =
        "UPDATE users SET name = 'Jane Doe', email = 'jane@example.com', updated_at = NOW() WHERE id = 1"

      const expected = `UPDATE users
SET
  name = 'Jane Doe',
  email = 'jane@example.com',
  updated_at = NOW()
WHERE
  id = 1`

      expect(formatter.format(input)).toBe(expected)
    })

    test("DELETE文を整形する", () => {
      const input = "DELETE FROM users WHERE created_at < '2020-01-01' AND active = false"

      const expected = `DELETE FROM users
WHERE
  created_at < '2020-01-01'
  AND active = false`

      expect(formatter.format(input)).toBe(expected)
    })
  })

  describe("CTE (Common Table Expression)", () => {
    test("単一のCTEを整形する", () => {
      const input =
        "WITH active_users AS (SELECT * FROM users WHERE active = true) SELECT * FROM active_users"

      const expected = `WITH active_users AS (
  SELECT
    *
  FROM
    users
  WHERE
    active = true
)
SELECT
  *
FROM
  active_users`

      expect(formatter.format(input)).toBe(expected)
    })

    test("複数のCTEを整形する", () => {
      const input = `WITH active_users AS (SELECT * FROM users WHERE active = true), recent_posts AS (SELECT * FROM posts WHERE created_at > '2024-01-01') SELECT u.name, COUNT(p.id) FROM active_users u JOIN recent_posts p ON u.id = p.user_id GROUP BY u.name`

      const expected = `WITH active_users AS (
  SELECT
    *
  FROM
    users
  WHERE
    active = true
),
recent_posts AS (
  SELECT
    *
  FROM
    posts
  WHERE
    created_at > '2024-01-01'
)
SELECT
  u.name,
  COUNT(p.id)
FROM
  active_users u
  JOIN recent_posts p ON u.id = p.user_id
GROUP BY
  u.name`

      expect(formatter.format(input)).toBe(expected)
    })
  })

  describe("オプション設定", () => {
    test("インデントサイズを変更できる", () => {
      formatter = new SQLFormatter({ indentSize: 4 })
      const input = "SELECT id, name FROM users"

      const expected = `SELECT
    id,
    name
FROM
    users`

      expect(formatter.format(input)).toBe(expected)
    })

    test("大文字/小文字を設定できる", () => {
      formatter = new SQLFormatter({ uppercase: false })
      const input = "SELECT id FROM users WHERE active = TRUE"

      const expected = `select
  id
from
  users
where
  active = true`

      expect(formatter.format(input)).toBe(expected)
    })

    test("コンパクトモードで整形する", () => {
      formatter = new SQLFormatter({ compact: true })
      const input = "SELECT id, name, email FROM users WHERE active = true"

      const expected = `SELECT id, name, email
FROM users
WHERE active = true`

      expect(formatter.format(input)).toBe(expected)
    })
  })

  describe("エラーハンドリング", () => {
    test("不正なSQLでもクラッシュしない", () => {
      const input = "SELECT FROM WHERE"

      expect(() => formatter.format(input)).not.toThrow()
      expect(formatter.format(input)).toBeTruthy()
    })

    test("空文字列を処理できる", () => {
      expect(formatter.format("")).toBe("")
    })

    test("コメントを保持する", () => {
      const input = `-- Get all active users
SELECT * FROM users
/* Filter by status */
WHERE active = true`

      const result = formatter.format(input)
      expect(result).toContain("-- Get all active users")
      expect(result).toContain("/* Filter by status */")
    })
  })

  describe("パフォーマンス", () => {
    test("長大なクエリも高速に処理する", () => {
      // 1000行のUNION ALLクエリを生成
      const lines = Array.from({ length: 1000 }, (_, i) => `SELECT ${i} as id, 'User ${i}' as name`)
      const input = lines.join(" UNION ALL ")

      const start = performance.now()
      const result = formatter.format(input)
      const duration = performance.now() - start

      expect(duration).toBeLessThan(1000) // 1秒以内
      expect(result).toContain("UNION ALL")
    })
  })
})
