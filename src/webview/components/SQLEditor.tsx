import React, { useState, useEffect, useRef, useMemo, useCallback, startTransition } from 'react'
import * as monaco from 'monaco-editor'
import { SQLEditorService } from '../../shared/services/SQLEditorService'
import { SQLQueryValidator } from '../../shared/utils/SQLQueryValidator'
import { SQLAutoCompleter } from '../../shared/utils/SQLAutoCompleter'
import { useVSCodeAPI } from '../api/vscode'
import type { 
  QueryResult, 
  QueryExecutionOptions, 
  DatabaseSchema,
  ValidationError,
  QueryBookmark,
  ExecutionPlan,
  CompletionItem
} from '../../shared/types/sql'

interface SQLEditorProps {
  initialQuery?: string
  schema?: DatabaseSchema
  onQueryExecute?: (query: string, result: QueryResult) => void
  onError?: (error: string) => void
  readOnly?: boolean
  height?: number
}

const SQLEditor: React.FC<SQLEditorProps> = ({
  initialQuery = '',
  schema,
  onQueryExecute,
  onError,
  readOnly = false,
  height = 400
}) => {
  // State management
  const [query, setQuery] = useState(initialQuery)
  const [isExecuting, setIsExecuting] = useState(false)
  const [queryResults, setQueryResults] = useState<QueryResult[]>([])
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [executionHistory, setExecutionHistory] = useState<string[]>([])
  const [bookmarks, setBookmarks] = useState<QueryBookmark[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [showBookmarks, setShowBookmarks] = useState(false)
  const [showExecutionPlan, setShowExecutionPlan] = useState(false)
  const [executionPlan, setExecutionPlan] = useState<ExecutionPlan | null>(null)

  // Refs
  const editorRef = useRef<HTMLDivElement>(null)
  const monacoEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)

  // Services
  const sqlEditorService = useMemo(() => 
    new SQLEditorService(schema || { tables: [], views: [], functions: [], procedures: [] }), 
    [schema]
  )
  const validator = useMemo(() => 
    new SQLQueryValidator(schema || { tables: [], views: [], functions: [], procedures: [] }), 
    [schema]
  )
  const autoCompleter = useMemo(() => 
    new SQLAutoCompleter(schema || { tables: [], views: [], functions: [], procedures: [] }), 
    [schema]
  )
  const vscodeApi = useVSCodeAPI()

  // Initialize Monaco Editor
  useEffect(() => {
    if (!editorRef.current) return

    // Configure SQL language
    monaco.languages.register({ id: 'sql' })
    
    // Configure syntax highlighting
    monaco.languages.setMonarchTokensProvider('sql', {
      defaultToken: '',
      tokenPostfix: '.sql',
      ignoreCase: true,
      brackets: [
        { open: '(', close: ')', token: 'delimiter.parenthesis' },
        { open: '[', close: ']', token: 'delimiter.square' },
        { open: '{', close: '}', token: 'delimiter.curly' }
      ],
      keywords: [
        'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER',
        'ON', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'UNION',
        'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE',
        'ALTER', 'DROP', 'TRUNCATE', 'INDEX', 'VIEW', 'TABLE', 'DATABASE',
        'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'IS', 'NULL',
        'AS', 'DISTINCT', 'ALL', 'ANY', 'SOME', 'CASE', 'WHEN', 'THEN',
        'ELSE', 'END', 'ASC', 'DESC', 'PRIMARY', 'KEY', 'FOREIGN', 'UNIQUE'
      ],
      operators: [
        '=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=',
        '<>', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=',
        '>>=', '<<='
      ],
      builtinFunctions: [
        'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'CONCAT', 'SUBSTRING',
        'LENGTH', 'UPPER', 'LOWER', 'TRIM', 'NOW', 'DATE', 'TIME'
      ],
      tokenizer: {
        root: [
          { include: '@comments' },
          { include: '@whitespace' },
          { include: '@numbers' },
          { include: '@strings' },
          { include: '@complexIdentifiers' },
          [/[;,.]/, 'delimiter'],
          [/[()]/, '@brackets'],
          [/[\w@#$]+/, {
            cases: {
              '@keywords': 'keyword',
              '@operators': 'operator',
              '@builtinFunctions': 'predefined',
              '@default': 'identifier'
            }
          }]
        ],
        comments: [
          [/--+.*/, 'comment'],
          [/\/\*/, { token: 'comment.quote', next: '@comment' }]
        ],
        comment: [
          [/[^*/]+/, 'comment'],
          [/\*\//, { token: 'comment.quote', next: '@pop' }],
          [/./, 'comment']
        ],
        whitespace: [
          [/\s+/, 'white']
        ],
        numbers: [
          [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
          [/\d+/, 'number']
        ],
        strings: [
          [/'/, { token: 'string', next: '@string' }],
          [/"/, { token: 'string.double', next: '@stringDouble' }]
        ],
        string: [
          [/[^']+/, 'string'],
          [/''/, 'string.escape'],
          [/'/, { token: 'string', next: '@pop' }]
        ],
        stringDouble: [
          [/[^"]+/, 'string.double'],
          [/""/, 'string.escape'],
          [/"/, { token: 'string.double', next: '@pop' }]
        ],
        complexIdentifiers: [
          [/\[/, { token: 'identifier.quote', next: '@bracketedIdentifier' }],
          [/`/, { token: 'identifier.quote', next: '@quotedIdentifier' }]
        ],
        bracketedIdentifier: [
          [/[^\]]+/, 'identifier'],
          [/]]/, 'identifier.escape'],
          [/\]/, { token: 'identifier.quote', next: '@pop' }]
        ],
        quotedIdentifier: [
          [/[^`]+/, 'identifier'],
          [/``/, 'identifier.escape'],
          [/`/, { token: 'identifier.quote', next: '@pop' }]
        ]
      }
    })

    // Configure autocompletion
    monaco.languages.registerCompletionItemProvider('sql', {
      provideCompletionItems: (model, position) => {
        const query = model.getValue()
        const completions = autoCompleter.getCompletions(query, {
          line: position.lineNumber,
          column: position.column
        })

        return {
          suggestions: completions.map(completion => ({
            label: completion.label,
            kind: mapCompletionKind(completion.kind),
            detail: completion.detail,
            documentation: completion.documentation,
            insertText: completion.insertText || completion.label,
            insertTextRules: completion.insertTextRules === 'insertAsSnippet' 
              ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet 
              : undefined,
            range: {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: position.column,
              endColumn: position.column
            }
          }))
        }
      }
    })

    // Configure validation
    monaco.languages.registerCodeActionProvider('sql', {
      provideCodeActions: (model, range, context) => {
        const actions: monaco.languages.CodeAction[] = []
        
        for (const marker of context.markers) {
          if (marker.source === 'sql-validator') {
            actions.push({
              title: 'Format Query',
              kind: 'quickfix',
              edit: {
                edits: [{
                  resource: model.uri,
                  edit: {
                    range: model.getFullModelRange(),
                    text: sqlEditorService.formatQuery(model.getValue())
                  }
                }]
              }
            })
          }
        }
        
        return { actions, dispose: () => {} }
      }
    })

    // Create editor instance
    const editor = monaco.editor.create(editorRef.current, {
      value: query,
      language: 'sql',
      theme: 'vs-dark',
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
      lineNumbers: 'on',
      wordWrap: 'on',
      readOnly,
      contextmenu: true,
      quickSuggestions: true,
      parameterHints: { enabled: true },
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnEnter: 'on',
      tabCompletion: 'on',
      formatOnPaste: true,
      formatOnType: true
    })

    monacoEditorRef.current = editor

    // Setup event handlers
    editor.onDidChangeModelContent(() => {
      const value = editor.getValue()
      setQuery(value)
      
      // Validate query
      startTransition(() => {
        const errors = validator.validateQuery(value)
        setValidationErrors(errors)
        
        // Update editor markers
        const markers = errors.map(error => ({
          severity: mapSeverity(error.severity),
          startLineNumber: error.line || 1,
          startColumn: error.column || 1,
          endLineNumber: error.line || 1,
          endColumn: (error.column || 1) + (error.length || 1),
          message: error.message,
          source: 'sql-validator'
        }))
        
        monaco.editor.setModelMarkers(editor.getModel()!, 'sql-validator', markers)
      })
    })

    // Keyboard shortcuts
    editor.addAction({
      id: 'execute-query',
      label: 'Execute Query',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => {
        handleExecuteQuery()
      }
    })

    editor.addAction({
      id: 'format-query',
      label: 'Format Query',
      keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF],
      run: () => {
        handleFormatQuery()
      }
    })

    editor.addAction({
      id: 'save-bookmark',
      label: 'Save as Bookmark',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB],
      run: () => {
        handleSaveBookmark()
      }
    })

    return () => {
      editor.dispose()
    }
  }, [schema, readOnly])

  // Update editor content when initialQuery changes
  useEffect(() => {
    if (monacoEditorRef.current && initialQuery !== query) {
      monacoEditorRef.current.setValue(initialQuery)
    }
  }, [initialQuery])

  // Execute query
  const handleExecuteQuery = useCallback(async () => {
    if (!query.trim() || isExecuting) return

    setIsExecuting(true)
    
    try {
      const selectedText = monacoEditorRef.current?.getModel()?.getValueInRange(
        monacoEditorRef.current.getSelection()!
      )
      const queryToExecute = selectedText || query

      const result = await sqlEditorService.executeQuery(queryToExecute)
      
      setQueryResults(prev => [result, ...prev.slice(0, 9)]) // Keep last 10 results
      setExecutionHistory(sqlEditorService.getQueryHistory().slice(0, 50))
      
      onQueryExecute?.(queryToExecute, result)
      vscodeApi.showInfo(`Query executed successfully in ${result.executionTime}ms`)
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      onError?.(errorMessage)
      vscodeApi.showError(errorMessage)
    } finally {
      setIsExecuting(false)
    }
  }, [query, isExecuting, sqlEditorService, onQueryExecute, onError, vscodeApi])

  // Execute with options
  const handleExecuteWithOptions = useCallback(async (options: QueryExecutionOptions) => {
    if (!query.trim() || isExecuting) return

    setIsExecuting(true)
    
    try {
      const result = await sqlEditorService.executeQueryWithOptions(query, options)
      setQueryResults(prev => [result, ...prev.slice(0, 9)])
      vscodeApi.showInfo('Query executed with options successfully')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      vscodeApi.showError(errorMessage)
    } finally {
      setIsExecuting(false)
    }
  }, [query, isExecuting, sqlEditorService, vscodeApi])

  // Get execution plan
  const handleGetExecutionPlan = useCallback(async () => {
    if (!query.trim()) return

    try {
      const plan = await sqlEditorService.getExecutionPlan(query)
      setExecutionPlan(plan)
      setShowExecutionPlan(true)
      vscodeApi.showInfo('Execution plan generated successfully')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      vscodeApi.showError(errorMessage)
    }
  }, [query, sqlEditorService, vscodeApi])

  // Format query
  const handleFormatQuery = useCallback(() => {
    if (!monacoEditorRef.current) return

    const formatted = sqlEditorService.formatQuery(query)
    monacoEditorRef.current.setValue(formatted)
    vscodeApi.showInfo('Query formatted successfully')
  }, [query, sqlEditorService, vscodeApi])

  // Save bookmark
  const handleSaveBookmark = useCallback(() => {
    if (!query.trim()) return

    const name = prompt('Bookmark name:')
    if (!name) return

    const bookmark: QueryBookmark = {
      id: `bookmark_${Date.now()}`,
      name,
      query,
      description: '',
      tags: [],
      createdAt: new Date()
    }

    sqlEditorService.saveBookmark(bookmark)
    setBookmarks(sqlEditorService.getBookmarks())
    vscodeApi.showInfo('Bookmark saved successfully')
  }, [query, sqlEditorService, vscodeApi])

  // Load bookmark
  const handleLoadBookmark = useCallback((bookmark: QueryBookmark) => {
    if (monacoEditorRef.current) {
      monacoEditorRef.current.setValue(bookmark.query)
    }
    setShowBookmarks(false)
  }, [])

  // Clear results
  const handleClearResults = useCallback(() => {
    setQueryResults([])
    vscodeApi.showInfo('Results cleared')
  }, [vscodeApi])

  // Export results
  const handleExportResults = useCallback((result: QueryResult, format: string) => {
    let exportedData: string
    let fileName: string

    switch (format) {
      case 'csv':
        exportedData = sqlEditorService.exportToCSV(result)
        fileName = 'query_result.csv'
        break
      case 'json':
        exportedData = sqlEditorService.exportToJSON(result)
        fileName = 'query_result.json'
        break
      case 'sql':
        exportedData = sqlEditorService.exportToSQL(result, 'exported_data')
        fileName = 'query_result.sql'
        break
      default:
        return
    }

    // Create download link
    const blob = new Blob([exportedData], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)

    vscodeApi.showInfo(`Results exported as ${format.toUpperCase()}`)
  }, [sqlEditorService, vscodeApi])

  return (
    <div className='sql-editor h-full flex flex-col bg-gray-900 text-white'>
      {/* Toolbar */}
      <SQLEditorToolbar
        isExecuting={isExecuting}
        hasQuery={!!query.trim()}
        validationErrors={validationErrors}
        onExecute={handleExecuteQuery}
        onExecuteWithOptions={handleExecuteWithOptions}
        onGetExecutionPlan={handleGetExecutionPlan}
        onFormat={handleFormatQuery}
        onSaveBookmark={handleSaveBookmark}
        onShowHistory={() => setShowHistory(true)}
        onShowBookmarks={() => setShowBookmarks(true)}
        onClearResults={handleClearResults}
      />

      {/* Editor */}
      <div 
        ref={editorRef} 
        className='flex-1 border border-gray-700'
        style={{ height: `${height}px` }}
      />

      {/* Results */}
      {queryResults.length > 0 && (
        <SQLResultsPanel
          results={queryResults}
          onExport={handleExportResults}
          onClear={handleClearResults}
        />
      )}

      {/* History Modal */}
      {showHistory && (
        <SQLHistoryModal
          history={executionHistory}
          onSelect={(selectedQuery) => {
            if (monacoEditorRef.current) {
              monacoEditorRef.current.setValue(selectedQuery)
            }
            setShowHistory(false)
          }}
          onClose={() => setShowHistory(false)}
        />
      )}

      {/* Bookmarks Modal */}
      {showBookmarks && (
        <SQLBookmarksModal
          bookmarks={bookmarks}
          onSelect={handleLoadBookmark}
          onDelete={(id) => {
            sqlEditorService.deleteBookmark(id)
            setBookmarks(sqlEditorService.getBookmarks())
          }}
          onClose={() => setShowBookmarks(false)}
        />
      )}

      {/* Execution Plan Modal */}
      {showExecutionPlan && executionPlan && (
        <SQLExecutionPlanModal
          plan={executionPlan}
          onClose={() => setShowExecutionPlan(false)}
        />
      )}
    </div>
  )
}

// Toolbar component
const SQLEditorToolbar: React.FC<{
  isExecuting: boolean
  hasQuery: boolean
  validationErrors: ValidationError[]
  onExecute: () => void
  onExecuteWithOptions: (options: QueryExecutionOptions) => void
  onGetExecutionPlan: () => void
  onFormat: () => void
  onSaveBookmark: () => void
  onShowHistory: () => void
  onShowBookmarks: () => void
  onClearResults: () => void
}> = ({
  isExecuting,
  hasQuery,
  validationErrors,
  onExecute,
  onExecuteWithOptions,
  onGetExecutionPlan,
  onFormat,
  onSaveBookmark,
  onShowHistory,
  onShowBookmarks,
  onClearResults
}) => {
  const hasErrors = validationErrors.some(e => e.severity === 'error')

  return (
    <div className='sql-editor-toolbar flex items-center justify-between p-3 bg-gray-800 border-b border-gray-700'>
      <div className='flex items-center gap-2'>
        <button
          onClick={onExecute}
          disabled={!hasQuery || isExecuting || hasErrors}
          className='btn-primary text-sm flex items-center gap-2'
        >
          {isExecuting ? (
            <>
              <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white'></div>
              Executing...
            </>
          ) : (
            <>
              <PlayIcon />
              Execute (Ctrl+Enter)
            </>
          )}
        </button>

        <button
          onClick={onGetExecutionPlan}
          disabled={!hasQuery || isExecuting}
          className='btn-secondary text-sm'
        >
          Explain
        </button>

        <button
          onClick={onFormat}
          disabled={!hasQuery}
          className='btn-secondary text-sm'
        >
          Format
        </button>

        <button
          onClick={onSaveBookmark}
          disabled={!hasQuery}
          className='btn-secondary text-sm'
        >
          Bookmark
        </button>
      </div>

      <div className='flex items-center gap-2'>
        {validationErrors.length > 0 && (
          <div className='flex items-center gap-1 text-sm'>
            <ErrorIcon className='text-red-400' />
            <span className='text-red-400'>{validationErrors.length} issues</span>
          </div>
        )}

        <button onClick={onShowHistory} className='btn-secondary text-sm'>
          History
        </button>

        <button onClick={onShowBookmarks} className='btn-secondary text-sm'>
          Bookmarks
        </button>

        <button onClick={onClearResults} className='btn-secondary text-sm'>
          Clear Results
        </button>
      </div>
    </div>
  )
}

// Results panel component (simplified)
const SQLResultsPanel: React.FC<{
  results: QueryResult[]
  onExport: (result: QueryResult, format: string) => void
  onClear: () => void
}> = ({ results, onExport, onClear }) => {
  const [selectedResultIndex, setSelectedResultIndex] = useState(0)
  const selectedResult = results[selectedResultIndex]

  return (
    <div className='sql-results-panel bg-gray-800 border-t border-gray-700 p-4 max-h-96 overflow-auto'>
      <div className='flex items-center justify-between mb-4'>
        <h3 className='font-semibold text-white'>Query Results</h3>
        <div className='flex items-center gap-2'>
          <select
            value={selectedResultIndex}
            onChange={(e) => setSelectedResultIndex(Number(e.target.value))}
            className='bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white'
          >
            {results.map((_, index) => (
              <option key={index} value={index}>
                Result {index + 1}
              </option>
            ))}
          </select>
          <button
            onClick={() => onExport(selectedResult, 'csv')}
            className='btn-secondary text-sm'
          >
            Export CSV
          </button>
        </div>
      </div>

      {selectedResult && (
        <div className='text-sm'>
          <div className='mb-2 text-gray-400'>
            {selectedResult.rowCount} rows in {selectedResult.executionTime}ms
          </div>
          <div className='bg-gray-900 rounded border border-gray-700 overflow-auto max-h-64'>
            <table className='w-full text-sm'>
              <thead className='bg-gray-700'>
                <tr>
                  {selectedResult.columns.map(col => (
                    <th key={col} className='px-3 py-2 text-left font-medium text-gray-300'>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedResult.rows.slice(0, 100).map((row, index) => (
                  <tr key={index} className='border-b border-gray-800'>
                    {selectedResult.columns.map(col => (
                      <td key={col} className='px-3 py-2 text-gray-300'>
                        {row[col] === null ? (
                          <span className='text-gray-500 italic'>NULL</span>
                        ) : (
                          String(row[col])
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// Simplified modal components (would be fully implemented)
const SQLHistoryModal: React.FC<any> = ({ history, onSelect, onClose }) => (
  <div className='modal-overlay' onClick={onClose}>
    <div className='modal-content' onClick={e => e.stopPropagation()}>
      <h2>Query History</h2>
      <div className='max-h-96 overflow-auto'>
        {history.map((query: string, index: number) => (
          <div
            key={index}
            className='p-2 hover:bg-gray-700 cursor-pointer'
            onClick={() => onSelect(query)}
          >
            {query.slice(0, 100)}...
          </div>
        ))}
      </div>
    </div>
  </div>
)

const SQLBookmarksModal: React.FC<any> = ({ bookmarks, onSelect, onDelete, onClose }) => (
  <div className='modal-overlay' onClick={onClose}>
    <div className='modal-content' onClick={e => e.stopPropagation()}>
      <h2>Bookmarks</h2>
      <div className='max-h-96 overflow-auto'>
        {bookmarks.map((bookmark: QueryBookmark) => (
          <div key={bookmark.id} className='p-2 hover:bg-gray-700 flex justify-between'>
            <div className='cursor-pointer' onClick={() => onSelect(bookmark)}>
              <div className='font-medium'>{bookmark.name}</div>
              <div className='text-sm text-gray-400'>{bookmark.query.slice(0, 50)}...</div>
            </div>
            <button onClick={() => onDelete(bookmark.id)} className='text-red-400'>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  </div>
)

const SQLExecutionPlanModal: React.FC<any> = ({ plan, onClose }) => (
  <div className='modal-overlay' onClick={onClose}>
    <div className='modal-content' onClick={e => e.stopPropagation()}>
      <h2>Execution Plan</h2>
      <pre className='bg-gray-900 p-4 rounded text-sm overflow-auto max-h-96'>
        {JSON.stringify(plan, null, 2)}
      </pre>
    </div>
  </div>
)

// Helper functions
function mapCompletionKind(kind: string): monaco.languages.CompletionItemKind {
  switch (kind) {
    case 'keyword': return monaco.languages.CompletionItemKind.Keyword
    case 'function': return monaco.languages.CompletionItemKind.Function
    case 'table': return monaco.languages.CompletionItemKind.Struct
    case 'column': return monaco.languages.CompletionItemKind.Field
    case 'snippet': return monaco.languages.CompletionItemKind.Snippet
    default: return monaco.languages.CompletionItemKind.Text
  }
}

function mapSeverity(severity: string): monaco.MarkerSeverity {
  switch (severity) {
    case 'error': return monaco.MarkerSeverity.Error
    case 'warning': return monaco.MarkerSeverity.Warning
    case 'info': return monaco.MarkerSeverity.Info
    default: return monaco.MarkerSeverity.Hint
  }
}

// Icon components
const PlayIcon: React.FC = () => (
  <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20'>
    <path fillRule='evenodd' d='M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z' clipRule='evenodd' />
  </svg>
)

const ErrorIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={`w-4 h-4 ${className}`} fill='currentColor' viewBox='0 0 20 20'>
    <path fillRule='evenodd' d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z' clipRule='evenodd' />
  </svg>
)

export default SQLEditor