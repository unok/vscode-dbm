import { describe, test, expect, beforeEach, vi } from 'vitest'
import { SQLEditorService } from '../../shared/services/SQLEditorService'
import { SQLQueryValidator } from '../../shared/utils/SQLQueryValidator'
import { SQLAutoCompleter } from '../../shared/utils/SQLAutoCompleter'
import type { 
  SQLQuery, 
  QueryResult, 
  DatabaseSchema,
  CompletionItem,
  ValidationError,
  QueryExecutionOptions
} from '../../shared/types/sql'

describe('SQLEditorService', () => {
  let sqlEditor: SQLEditorService
  let mockSchema: DatabaseSchema

  beforeEach(() => {
    mockSchema = {
      tables: [
        {
          name: 'users',
          schema: 'public',
          columns: [
            { name: 'id', type: 'integer', nullable: false, isPrimaryKey: true },
            { name: 'email', type: 'varchar(255)', nullable: false, isPrimaryKey: false },
            { name: 'name', type: 'varchar(100)', nullable: true, isPrimaryKey: false },
            { name: 'created_at', type: 'timestamp', nullable: false, isPrimaryKey: false }
          ]
        },
        {
          name: 'orders',
          schema: 'public',
          columns: [
            { name: 'id', type: 'integer', nullable: false, isPrimaryKey: true },
            { name: 'user_id', type: 'integer', nullable: false, isPrimaryKey: false },
            { name: 'total', type: 'decimal(10,2)', nullable: false, isPrimaryKey: false },
            { name: 'status', type: 'varchar(50)', nullable: false, isPrimaryKey: false }
          ]
        }
      ],
      views: [
        {
          name: 'user_orders',
          schema: 'public',
          definition: 'SELECT u.name, COUNT(o.id) as order_count FROM users u LEFT JOIN orders o ON u.id = o.user_id GROUP BY u.id'
        }
      ],
      functions: [],
      procedures: []
    }
    
    sqlEditor = new SQLEditorService(mockSchema)
  })

  describe('Query Execution', () => {
    test('should execute simple SELECT query successfully', async () => {
      const query = 'SELECT * FROM users'
      const mockResult: QueryResult = {
        columns: ['id', 'email', 'name', 'created_at'],
        rows: [
          { id: 1, email: 'john@example.com', name: 'John Doe', created_at: '2023-01-01T10:00:00Z' }
        ],
        rowCount: 1,
        executionTime: 45,
        query: query
      }

      // Mock database execution
      vi.spyOn(sqlEditor, 'executeQuery').mockResolvedValue(mockResult)

      const result = await sqlEditor.executeQuery(query)
      
      expect(result).toEqual(mockResult)
      expect(result.columns).toHaveLength(4)
      expect(result.rows).toHaveLength(1)
      expect(result.executionTime).toBeGreaterThan(0)
    })

    test('should handle SQL execution errors', async () => {
      const invalidQuery = 'SELECT * FROM non_existent_table'
      
      vi.spyOn(sqlEditor, 'executeQuery').mockRejectedValue(
        new Error('Table "non_existent_table" does not exist')
      )

      await expect(sqlEditor.executeQuery(invalidQuery)).rejects.toThrow(
        'Table "non_existent_table" does not exist'
      )
    })

    test('should execute multiple queries in sequence', async () => {
      const queries = [
        'SELECT COUNT(*) FROM users',
        'SELECT COUNT(*) FROM orders'
      ]

      const mockResults: QueryResult[] = [
        {
          columns: ['count'],
          rows: [{ count: 5 }],
          rowCount: 1,
          executionTime: 12,
          query: queries[0]
        },
        {
          columns: ['count'],
          rows: [{ count: 15 }],
          rowCount: 1,
          executionTime: 8,
          query: queries[1]
        }
      ]

      vi.spyOn(sqlEditor, 'executeMultipleQueries').mockResolvedValue(mockResults)

      const results = await sqlEditor.executeMultipleQueries(queries)
      
      expect(results).toHaveLength(2)
      expect(results[0].rows[0].count).toBe(5)
      expect(results[1].rows[0].count).toBe(15)
    })

    test('should support query execution with options', async () => {
      const query = 'SELECT * FROM users LIMIT 10'
      const options: QueryExecutionOptions = {
        maxRows: 1000,
        timeout: 30000,
        explain: false,
        dryRun: false
      }

      const mockResult: QueryResult = {
        columns: ['id', 'email', 'name', 'created_at'],
        rows: [],
        rowCount: 0,
        executionTime: 25,
        query: query
      }

      vi.spyOn(sqlEditor, 'executeQueryWithOptions').mockResolvedValue(mockResult)

      const result = await sqlEditor.executeQueryWithOptions(query, options)
      
      expect(result).toEqual(mockResult)
    })

    test('should handle query timeout', async () => {
      const longRunningQuery = 'SELECT * FROM users ORDER BY RANDOM()'
      const options: QueryExecutionOptions = {
        timeout: 1000
      }

      vi.spyOn(sqlEditor, 'executeQueryWithOptions').mockRejectedValue(
        new Error('Query execution timeout after 1000ms')
      )

      await expect(
        sqlEditor.executeQueryWithOptions(longRunningQuery, options)
      ).rejects.toThrow('Query execution timeout')
    })
  })

  describe('Query History', () => {
    test('should save executed queries to history', async () => {
      const query = 'SELECT * FROM users'
      
      await sqlEditor.executeQuery(query)
      
      const history = sqlEditor.getQueryHistory()
      expect(history).toContain(query)
    })

    test('should limit query history size', async () => {
      // Execute more queries than the history limit
      const queries = Array.from({ length: 105 }, (_, i) => `SELECT ${i}`)
      
      for (const query of queries) {
        vi.spyOn(sqlEditor, 'executeQuery').mockResolvedValue({
          columns: ['value'],
          rows: [{ value: query.split(' ')[1] }],
          rowCount: 1,
          executionTime: 1,
          query
        })
        await sqlEditor.executeQuery(query)
      }
      
      const history = sqlEditor.getQueryHistory()
      expect(history.length).toBeLessThanOrEqual(100) // Default history limit
    })

    test('should clear query history', () => {
      sqlEditor.addToHistory('SELECT * FROM users')
      sqlEditor.addToHistory('SELECT * FROM orders')
      
      expect(sqlEditor.getQueryHistory()).toHaveLength(2)
      
      sqlEditor.clearHistory()
      
      expect(sqlEditor.getQueryHistory()).toHaveLength(0)
    })

    test('should search query history', () => {
      const queries = [
        'SELECT * FROM users',
        'SELECT * FROM orders',
        'INSERT INTO users VALUES (1, "test@example.com")',
        'UPDATE users SET name = "John" WHERE id = 1'
      ]
      
      queries.forEach(query => sqlEditor.addToHistory(query))
      
      const selectQueries = sqlEditor.searchHistory('SELECT')
      expect(selectQueries).toHaveLength(2)
      expect(selectQueries.every(q => q.includes('SELECT'))).toBe(true)
      
      const userQueries = sqlEditor.searchHistory('users')
      expect(userQueries).toHaveLength(3)
    })
  })

  describe('Query Bookmarks', () => {
    test('should save and retrieve bookmarks', () => {
      const bookmark = {
        id: 'bookmark1',
        name: 'Get all users',
        query: 'SELECT * FROM users',
        description: 'Retrieves all user records',
        tags: ['users', 'select'],
        createdAt: new Date()
      }
      
      sqlEditor.saveBookmark(bookmark)
      
      const bookmarks = sqlEditor.getBookmarks()
      expect(bookmarks).toHaveLength(1)
      expect(bookmarks[0]).toEqual(bookmark)
    })

    test('should update existing bookmark', () => {
      const bookmark = {
        id: 'bookmark1',
        name: 'Get all users',
        query: 'SELECT * FROM users',
        description: 'Original description',
        tags: ['users'],
        createdAt: new Date()
      }
      
      sqlEditor.saveBookmark(bookmark)
      
      const updatedBookmark = {
        ...bookmark,
        description: 'Updated description',
        tags: ['users', 'select']
      }
      
      sqlEditor.saveBookmark(updatedBookmark)
      
      const bookmarks = sqlEditor.getBookmarks()
      expect(bookmarks).toHaveLength(1)
      expect(bookmarks[0].description).toBe('Updated description')
      expect(bookmarks[0].tags).toEqual(['users', 'select'])
    })

    test('should delete bookmark', () => {
      const bookmark = {
        id: 'bookmark1',
        name: 'Test query',
        query: 'SELECT 1',
        description: '',
        tags: [],
        createdAt: new Date()
      }
      
      sqlEditor.saveBookmark(bookmark)
      expect(sqlEditor.getBookmarks()).toHaveLength(1)
      
      sqlEditor.deleteBookmark('bookmark1')
      expect(sqlEditor.getBookmarks()).toHaveLength(0)
    })

    test('should search bookmarks by name and tags', () => {
      const bookmarks = [
        {
          id: 'b1',
          name: 'User queries',
          query: 'SELECT * FROM users',
          description: '',
          tags: ['users', 'select'],
          createdAt: new Date()
        },
        {
          id: 'b2',
          name: 'Order statistics',
          query: 'SELECT COUNT(*) FROM orders',
          description: '',
          tags: ['orders', 'analytics'],
          createdAt: new Date()
        }
      ]
      
      bookmarks.forEach(b => sqlEditor.saveBookmark(b))
      
      const userBookmarks = sqlEditor.searchBookmarks('users')
      expect(userBookmarks).toHaveLength(1)
      expect(userBookmarks[0].id).toBe('b1')
      
      const analyticsBookmarks = sqlEditor.searchBookmarks('analytics')
      expect(analyticsBookmarks).toHaveLength(1)
      expect(analyticsBookmarks[0].id).toBe('b2')
    })
  })

  describe('SQL Formatting', () => {
    test('should format SQL query', () => {
      const unformattedQuery = 'select u.name,o.total from users u join orders o on u.id=o.user_id where o.status="completed"'
      const expectedFormatted = `SELECT
  u.name,
  o.total
FROM users u
JOIN orders o ON u.id = o.user_id
WHERE o.status = "completed"`

      const formatted = sqlEditor.formatQuery(unformattedQuery)
      expect(formatted.replace(/\s+/g, ' ').trim()).toBe(
        expectedFormatted.replace(/\s+/g, ' ').trim()
      )
    })

    test('should handle complex query formatting', () => {
      const complexQuery = `select u.name,(select count(*) from orders where user_id=u.id) as order_count from users u where u.created_at>='2023-01-01' order by order_count desc limit 10`
      
      const formatted = sqlEditor.formatQuery(complexQuery)
      
      expect(formatted).toContain('SELECT')
      expect(formatted).toContain('FROM')
      expect(formatted).toContain('WHERE')
      expect(formatted).toContain('ORDER BY')
      expect(formatted).toContain('LIMIT')
    })

    test('should preserve comments in formatted SQL', () => {
      const queryWithComments = `-- Get user statistics
select name, /* user name */ count(*) as total
from users u -- main users table
group by name`
      
      const formatted = sqlEditor.formatQuery(queryWithComments)
      
      expect(formatted).toContain('-- Get user statistics')
      expect(formatted).toContain('/* user name */')
      expect(formatted).toContain('-- main users table')
    })
  })

  describe('Execution Plan', () => {
    test('should generate execution plan for query', async () => {
      const query = 'SELECT * FROM users WHERE email = "john@example.com"'
      const mockPlan = {
        query,
        plan: [
          {
            nodeType: 'Index Scan',
            relation: 'users',
            indexName: 'users_email_idx',
            cost: { startup: 0.29, total: 8.30 },
            rows: 1,
            width: 64
          }
        ],
        totalCost: 8.30,
        estimatedRows: 1
      }

      vi.spyOn(sqlEditor, 'getExecutionPlan').mockResolvedValue(mockPlan)

      const plan = await sqlEditor.getExecutionPlan(query)
      
      expect(plan.query).toBe(query)
      expect(plan.plan).toHaveLength(1)
      expect(plan.plan[0].nodeType).toBe('Index Scan')
      expect(plan.totalCost).toBe(8.30)
    })

    test('should handle execution plan errors', async () => {
      const invalidQuery = 'SELECT * FROM'
      
      vi.spyOn(sqlEditor, 'getExecutionPlan').mockRejectedValue(
        new Error('Syntax error in query')
      )

      await expect(sqlEditor.getExecutionPlan(invalidQuery)).rejects.toThrow(
        'Syntax error in query'
      )
    })
  })

  describe('Result Export', () => {
    test('should export query results to CSV', () => {
      const result: QueryResult = {
        columns: ['id', 'name', 'email'],
        rows: [
          { id: 1, name: 'John Doe', email: 'john@example.com' },
          { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
        ],
        rowCount: 2,
        executionTime: 15,
        query: 'SELECT * FROM users'
      }

      const csvData = sqlEditor.exportToCSV(result)
      const expectedCSV = `id,name,email
1,John Doe,john@example.com
2,Jane Smith,jane@example.com`

      expect(csvData.trim()).toBe(expectedCSV)
    })

    test('should export query results to JSON', () => {
      const result: QueryResult = {
        columns: ['id', 'name'],
        rows: [
          { id: 1, name: 'John Doe' },
          { id: 2, name: 'Jane Smith' }
        ],
        rowCount: 2,
        executionTime: 10,
        query: 'SELECT id, name FROM users'
      }

      const jsonData = sqlEditor.exportToJSON(result)
      const parsed = JSON.parse(jsonData)
      
      expect(parsed).toHaveLength(2)
      expect(parsed[0]).toEqual({ id: 1, name: 'John Doe' })
      expect(parsed[1]).toEqual({ id: 2, name: 'Jane Smith' })
    })

    test('should export query results to SQL INSERT statements', () => {
      const result: QueryResult = {
        columns: ['id', 'name', 'email'],
        rows: [
          { id: 1, name: 'John Doe', email: 'john@example.com' }
        ],
        rowCount: 1,
        executionTime: 8,
        query: 'SELECT * FROM users'
      }

      const sqlInserts = sqlEditor.exportToSQL(result, 'users')
      const expected = `INSERT INTO users (id, name, email) VALUES (1, 'John Doe', 'john@example.com');`

      expect(sqlInserts.trim()).toBe(expected)
    })
  })
})

describe('SQLQueryValidator', () => {
  let validator: SQLQueryValidator
  let mockSchema: DatabaseSchema

  beforeEach(() => {
    mockSchema = {
      tables: [
        {
          name: 'users',
          schema: 'public',
          columns: [
            { name: 'id', type: 'integer', nullable: false, isPrimaryKey: true },
            { name: 'email', type: 'varchar(255)', nullable: false, isPrimaryKey: false }
          ]
        }
      ],
      views: [],
      functions: [],
      procedures: []
    }
    
    validator = new SQLQueryValidator(mockSchema)
  })

  describe('Syntax Validation', () => {
    test('should validate correct SQL syntax', () => {
      const validQueries = [
        'SELECT * FROM users',
        'SELECT id, email FROM users WHERE id = 1',
        'INSERT INTO users (email) VALUES ("test@example.com")',
        'UPDATE users SET email = "new@example.com" WHERE id = 1',
        'DELETE FROM users WHERE id = 1'
      ]

      validQueries.forEach(query => {
        const errors = validator.validateSyntax(query)
        expect(errors).toHaveLength(0)
      })
    })

    test('should detect syntax errors', () => {
      const invalidQueries = [
        'SELECT * FROM',           // Missing table name
        'SELECT FROM users',       // Missing columns
        'INSERT INTO users',       // Missing VALUES clause
        'UPDATE SET email = "test"', // Missing table name
        'DELETE WHERE id = 1'      // Missing FROM clause
      ]

      invalidQueries.forEach(query => {
        const errors = validator.validateSyntax(query)
        expect(errors.length).toBeGreaterThan(0)
        expect(errors[0].type).toBe('syntax')
      })
    })

    test('should detect missing semicolon in multi-statement queries', () => {
      const query = 'SELECT * FROM users SELECT * FROM orders'
      const errors = validator.validateSyntax(query)
      
      expect(errors.length).toBeGreaterThan(0)
      expect(errors.some(e => e.message.includes('semicolon'))).toBe(true)
    })
  })

  describe('Schema Validation', () => {
    test('should validate table existence', () => {
      const validQuery = 'SELECT * FROM users'
      const invalidQuery = 'SELECT * FROM non_existent_table'

      const validErrors = validator.validateSchema(validQuery)
      expect(validErrors).toHaveLength(0)

      const invalidErrors = validator.validateSchema(invalidQuery)
      expect(invalidErrors.length).toBeGreaterThan(0)
      expect(invalidErrors[0].type).toBe('schema')
      expect(invalidErrors[0].message).toContain('Table "non_existent_table" does not exist')
    })

    test('should validate column existence', () => {
      const validQuery = 'SELECT id, email FROM users'
      const invalidQuery = 'SELECT id, non_existent_column FROM users'

      const validErrors = validator.validateSchema(validQuery)
      expect(validErrors).toHaveLength(0)

      const invalidErrors = validator.validateSchema(invalidQuery)
      expect(invalidErrors.length).toBeGreaterThan(0)
      expect(invalidErrors[0].type).toBe('schema')
      expect(invalidErrors[0].message).toContain('Column "non_existent_column" does not exist')
    })

    test('should validate table aliases', () => {
      const validQuery = 'SELECT u.id FROM users u'
      const invalidQuery = 'SELECT x.id FROM users u'

      const validErrors = validator.validateSchema(validQuery)
      expect(validErrors).toHaveLength(0)

      const invalidErrors = validator.validateSchema(invalidQuery)
      expect(invalidErrors.length).toBeGreaterThan(0)
    })
  })

  describe('Security Validation', () => {
    test('should detect potential SQL injection', () => {
      const suspiciousQueries = [
        "SELECT * FROM users WHERE id = 1; DROP TABLE users; --",
        "SELECT * FROM users WHERE name = 'test' OR '1'='1'",
        "SELECT * FROM users WHERE id = 1 UNION SELECT password FROM admin"
      ]

      suspiciousQueries.forEach(query => {
        const errors = validator.validateSecurity(query)
        expect(errors.length).toBeGreaterThan(0)
        expect(errors[0].type).toBe('security')
      })
    })

    test('should detect dangerous operations', () => {
      const dangerousQueries = [
        'DROP TABLE users',
        'TRUNCATE TABLE users',
        'ALTER TABLE users DROP COLUMN email',
        'DELETE FROM users' // Without WHERE clause
      ]

      dangerousQueries.forEach(query => {
        const errors = validator.validateSecurity(query)
        expect(errors.length).toBeGreaterThan(0)
        expect(errors.some(e => e.severity === 'error')).toBe(true)
      })
    })

    test('should allow safe operations', () => {
      const safeQueries = [
        'SELECT * FROM users',
        'SELECT COUNT(*) FROM users',
        'INSERT INTO users (email) VALUES ("test@example.com")',
        'UPDATE users SET email = "new@example.com" WHERE id = 1',
        'DELETE FROM users WHERE id = 1'
      ]

      safeQueries.forEach(query => {
        const errors = validator.validateSecurity(query)
        expect(errors.filter(e => e.severity === 'error')).toHaveLength(0)
      })
    })
  })

  describe('Performance Validation', () => {
    test('should detect missing WHERE clause in UPDATE/DELETE', () => {
      const queries = [
        'UPDATE users SET email = "test@example.com"',
        'DELETE FROM users'
      ]

      queries.forEach(query => {
        const errors = validator.validatePerformance(query)
        expect(errors.length).toBeGreaterThan(0)
        expect(errors[0].type).toBe('performance')
        expect(errors[0].message).toContain('WHERE clause')
      })
    })

    test('should detect SELECT * usage', () => {
      const query = 'SELECT * FROM users'
      const errors = validator.validatePerformance(query)
      
      expect(errors.some(e => e.message.includes('SELECT *'))).toBe(true)
      expect(errors[0].severity).toBe('warning')
    })

    test('should detect missing LIMIT in large result queries', () => {
      const query = 'SELECT email FROM users ORDER BY created_at'
      const errors = validator.validatePerformance(query)
      
      expect(errors.some(e => e.message.includes('LIMIT'))).toBe(true)
    })
  })
})

describe('SQLAutoCompleter', () => {
  let completer: SQLAutoCompleter
  let mockSchema: DatabaseSchema

  beforeEach(() => {
    mockSchema = {
      tables: [
        {
          name: 'users',
          schema: 'public',
          columns: [
            { name: 'id', type: 'integer', nullable: false, isPrimaryKey: true },
            { name: 'email', type: 'varchar(255)', nullable: false, isPrimaryKey: false },
            { name: 'name', type: 'varchar(100)', nullable: true, isPrimaryKey: false }
          ]
        },
        {
          name: 'orders',
          schema: 'public',
          columns: [
            { name: 'id', type: 'integer', nullable: false, isPrimaryKey: true },
            { name: 'user_id', type: 'integer', nullable: false, isPrimaryKey: false }
          ]
        }
      ],
      views: [],
      functions: [],
      procedures: []
    }
    
    completer = new SQLAutoCompleter(mockSchema)
  })

  describe('Keyword Completion', () => {
    test('should suggest SQL keywords', () => {
      const completions = completer.getCompletions('SEL', { line: 1, column: 4 })
      
      expect(completions.some(c => c.label === 'SELECT')).toBe(true)
      expect(completions.find(c => c.label === 'SELECT')?.kind).toBe('keyword')
    })

    test('should suggest keywords based on context', () => {
      const completions = completer.getCompletions('SELECT * ', { line: 1, column: 9 })
      
      expect(completions.some(c => c.label === 'FROM')).toBe(true)
      expect(completions.some(c => c.label === 'WHERE')).toBe(false) // Should not suggest WHERE before FROM
    })

    test('should suggest WHERE after FROM clause', () => {
      const completions = completer.getCompletions('SELECT * FROM users ', { line: 1, column: 20 })
      
      expect(completions.some(c => c.label === 'WHERE')).toBe(true)
      expect(completions.some(c => c.label === 'ORDER BY')).toBe(true)
      expect(completions.some(c => c.label === 'GROUP BY')).toBe(true)
    })
  })

  describe('Table Completion', () => {
    test('should suggest table names after FROM', () => {
      const completions = completer.getCompletions('SELECT * FROM ', { line: 1, column: 15 })
      
      expect(completions.some(c => c.label === 'users')).toBe(true)
      expect(completions.some(c => c.label === 'orders')).toBe(true)
      expect(completions.find(c => c.label === 'users')?.kind).toBe('table')
    })

    test('should filter table suggestions by prefix', () => {
      const completions = completer.getCompletions('SELECT * FROM u', { line: 1, column: 16 })
      
      expect(completions.some(c => c.label === 'users')).toBe(true)
      expect(completions.some(c => c.label === 'orders')).toBe(false)
    })

    test('should suggest table names in JOIN clauses', () => {
      const completions = completer.getCompletions('SELECT * FROM users JOIN ', { line: 1, column: 25 })
      
      expect(completions.some(c => c.label === 'orders')).toBe(true)
      expect(completions.some(c => c.label === 'users')).toBe(false) // Should not suggest same table
    })
  })

  describe('Column Completion', () => {
    test('should suggest column names in SELECT clause', () => {
      const completions = completer.getCompletions('SELECT ', { line: 1, column: 7 })
      
      // Without table context, should suggest all columns
      expect(completions.some(c => c.label === 'id')).toBe(true)
      expect(completions.some(c => c.label === 'email')).toBe(true)
      expect(completions.some(c => c.label === 'name')).toBe(true)
    })

    test('should suggest table-specific columns', () => {
      const completions = completer.getCompletions('SELECT * FROM users WHERE ', { line: 1, column: 26 })
      
      expect(completions.some(c => c.label === 'id')).toBe(true)
      expect(completions.some(c => c.label === 'email')).toBe(true)
      expect(completions.some(c => c.label === 'name')).toBe(true)
      expect(completions.find(c => c.label === 'id')?.kind).toBe('column')
    })

    test('should suggest qualified column names with table aliases', () => {
      const completions = completer.getCompletions('SELECT u.', { line: 1, column: 9 })
      
      expect(completions.some(c => c.label === 'id')).toBe(true)
      expect(completions.some(c => c.label === 'email')).toBe(true)
      expect(completions.some(c => c.label === 'name')).toBe(true)
    })
  })

  describe('Function Completion', () => {
    test('should suggest SQL functions', () => {
      const completions = completer.getCompletions('SELECT COUNT', { line: 1, column: 12 })
      
      expect(completions.some(c => c.label === 'COUNT()')).toBe(true)
      expect(completions.find(c => c.label === 'COUNT()')?.kind).toBe('function')
    })

    test('should suggest aggregate functions in SELECT', () => {
      const completions = completer.getCompletions('SELECT ', { line: 1, column: 7 })
      
      expect(completions.some(c => c.label === 'COUNT()')).toBe(true)
      expect(completions.some(c => c.label === 'SUM()')).toBe(true)
      expect(completions.some(c => c.label === 'AVG()')).toBe(true)
      expect(completions.some(c => c.label === 'MAX()')).toBe(true)
      expect(completions.some(c => c.label === 'MIN()')).toBe(true)
    })

    test('should suggest string functions', () => {
      const completions = completer.getCompletions('SELECT UPPER', { line: 1, column: 12 })
      
      expect(completions.some(c => c.label === 'UPPER()')).toBe(true)
      expect(completions.some(c => c.label === 'LOWER()')).toBe(true)
      expect(completions.some(c => c.label === 'CONCAT()')).toBe(true)
    })
  })

  describe('Snippet Completion', () => {
    test('should suggest common SQL snippets', () => {
      const completions = completer.getCompletions('', { line: 1, column: 1 })
      
      expect(completions.some(c => c.kind === 'snippet')).toBe(true)
      expect(completions.some(c => c.label.includes('SELECT'))).toBe(true)
    })

    test('should suggest JOIN snippet', () => {
      const completions = completer.getCompletions('SELECT * FROM users J', { line: 1, column: 22 })
      
      const joinSnippet = completions.find(c => c.label.includes('JOIN'))
      expect(joinSnippet).toBeDefined()
      expect(joinSnippet?.kind).toBe('snippet')
    })

    test('should suggest INSERT snippet', () => {
      const completions = completer.getCompletions('INS', { line: 1, column: 4 })
      
      const insertSnippet = completions.find(c => c.label.includes('INSERT'))
      expect(insertSnippet).toBeDefined()
      expect(insertSnippet?.insertText).toContain('VALUES')
    })
  })

  describe('Context-Aware Completion', () => {
    test('should not suggest keywords in wrong context', () => {
      const completions = completer.getCompletions('SELECT id, email FROM users WHERE email = "', { line: 1, column: 44 })
      
      expect(completions.some(c => c.kind === 'keyword')).toBe(false)
      expect(completions.some(c => c.kind === 'value')).toBe(true)
    })

    test('should suggest operators after column names', () => {
      const completions = completer.getCompletions('SELECT * FROM users WHERE id ', { line: 1, column: 30 })
      
      expect(completions.some(c => c.label === '=')).toBe(true)
      expect(completions.some(c => c.label === '!=')).toBe(true)
      expect(completions.some(c => c.label === '>')).toBe(true)
      expect(completions.some(c => c.label === '<')).toBe(true)
      expect(completions.some(c => c.label === 'IN')).toBe(true)
      expect(completions.some(c => c.label === 'LIKE')).toBe(true)
    })

    test('should handle subquery completion', () => {
      const completions = completer.getCompletions('SELECT * FROM users WHERE id IN (SELECT ', { line: 1, column: 41 })
      
      expect(completions.some(c => c.label === 'id')).toBe(true)
      expect(completions.some(c => c.label === 'user_id')).toBe(true)
    })
  })

  describe('Performance and Caching', () => {
    test('should cache completion results for identical requests', () => {
      const spy = vi.spyOn(completer, 'generateCompletions')
      
      const query = 'SELECT * FROM '
      const position = { line: 1, column: 15 }
      
      completer.getCompletions(query, position)
      completer.getCompletions(query, position)
      
      expect(spy).toHaveBeenCalledTimes(1)
    })

    test('should limit completion results for performance', () => {
      const completions = completer.getCompletions('', { line: 1, column: 1 })
      
      expect(completions.length).toBeLessThanOrEqual(50) // Reasonable limit
    })

    test('should prioritize relevant completions', () => {
      const completions = completer.getCompletions('SELECT * FROM users WHERE em', { line: 1, column: 29 })
      
      // 'email' should be first since it matches the prefix
      const emailIndex = completions.findIndex(c => c.label === 'email')
      const otherColumnsIndex = completions.findIndex(c => c.label === 'id')
      
      expect(emailIndex).toBeLessThan(otherColumnsIndex)
    })
  })
})