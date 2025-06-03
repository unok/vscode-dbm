import type React from "react"
import { useEffect, useState } from "react"
import type { ChangeRecord, ChangeStatistics } from "../../../shared/types/datagrid"
import type { DataChangeTracker } from "../../../shared/utils/DataChangeTracker"

interface ChangeTrackingPanelProps {
  changeTracker: DataChangeTracker
  onClose: () => void
  onRollback: (type: "all" | "cell" | "row", rowIndex?: number, columnId?: string) => void
}

export const ChangeTrackingPanel: React.FC<ChangeTrackingPanelProps> = ({
  changeTracker,
  onClose,
  onRollback,
}) => {
  const [changeRecord, setChangeRecord] = useState<ChangeRecord>(() =>
    changeTracker.getChangeRecord()
  )
  const [statistics, setStatistics] = useState<ChangeStatistics>(() =>
    changeTracker.getStatistics()
  )
  const [showSQL, setShowSQL] = useState(false)
  const [sqlStatements, setSqlStatements] = useState<string[]>([])
  const [selectedTab, setSelectedTab] = useState<"overview" | "cells" | "rows" | "sql">("overview")

  // Update change data periodically
  useEffect(() => {
    const updateChanges = () => {
      setChangeRecord(changeTracker.getChangeRecord())
      setStatistics(changeTracker.getStatistics())
    }

    const interval = setInterval(updateChanges, 1000)
    return () => clearInterval(interval)
  }, [changeTracker])

  // Generate SQL when needed
  useEffect(() => {
    if (showSQL) {
      // In a real implementation, this would get the table name from context
      const statements = changeTracker.generateSQLStatements("your_table_name")
      setSqlStatements(statements)
    }
  }, [showSQL, changeTracker, changeRecord])

  const formatTimestamp = (date: Date | null): string => {
    if (!date) return "Never"
    return date.toLocaleString()
  }

  const formatCellValue = (value: any): string => {
    if (value === null || value === undefined) return "NULL"
    if (typeof value === "string") return `"${value}"`
    return String(value)
  }

  const getChangesSummary = () => {
    return changeTracker.getChangesSummary()
  }

  return (
    <div className='change-tracking-panel'>
      <div className='panel-header'>
        <h3>Change Tracking</h3>
        <div className='header-actions'>
          <button
            className='sql-button'
            onClick={() => setShowSQL(!showSQL)}
            title='View SQL Statements'
          >
            📋 SQL
          </button>
          <button className='close-button' onClick={onClose}>
            ✕
          </button>
        </div>
      </div>

      <div className='panel-tabs'>
        <button
          className={`tab ${selectedTab === "overview" ? "active" : ""}`}
          onClick={() => setSelectedTab("overview")}
        >
          Overview
        </button>
        <button
          className={`tab ${selectedTab === "cells" ? "active" : ""}`}
          onClick={() => setSelectedTab("cells")}
        >
          Cell Changes ({changeRecord.modifiedCells.length})
        </button>
        <button
          className={`tab ${selectedTab === "rows" ? "active" : ""}`}
          onClick={() => setSelectedTab("rows")}
        >
          Row Changes ({changeRecord.addedRows.length + changeRecord.deletedRows.length})
        </button>
        {showSQL && (
          <button
            className={`tab ${selectedTab === "sql" ? "active" : ""}`}
            onClick={() => setSelectedTab("sql")}
          >
            SQL ({sqlStatements.length})
          </button>
        )}
      </div>

      <div className='panel-content'>
        {selectedTab === "overview" && (
          <div className='overview-tab'>
            <div className='statistics-grid'>
              <div className='stat-item'>
                <div className='stat-value'>{statistics.totalChanges}</div>
                <div className='stat-label'>Total Changes</div>
              </div>
              <div className='stat-item'>
                <div className='stat-value'>{statistics.modifiedCells}</div>
                <div className='stat-label'>Modified Cells</div>
              </div>
              <div className='stat-item'>
                <div className='stat-value'>{statistics.addedRows}</div>
                <div className='stat-label'>Added Rows</div>
              </div>
              <div className='stat-item'>
                <div className='stat-value'>{statistics.deletedRows}</div>
                <div className='stat-label'>Deleted Rows</div>
              </div>
              <div className='stat-item'>
                <div className='stat-value'>{statistics.affectedRows}</div>
                <div className='stat-label'>Affected Rows</div>
              </div>
              <div className='stat-item'>
                <div className='stat-value'>{formatTimestamp(changeRecord.lastModified)}</div>
                <div className='stat-label'>Last Modified</div>
              </div>
            </div>

            <div className='summary-section'>
              <h4>Summary</h4>
              <div className='summary-content'>
                <div className='summary-description'>{getChangesSummary().description}</div>
                {getChangesSummary().details.map((detail, index) => (
                  <div key={index} className='summary-detail'>
                    • {detail}
                  </div>
                ))}
                {getChangesSummary().warnings.map((warning, index) => (
                  <div key={index} className='summary-warning'>
                    ⚠️ {warning}
                  </div>
                ))}
              </div>
            </div>

            <div className='actions-section'>
              <button
                className='rollback-all-button'
                onClick={() => onRollback("all")}
                disabled={statistics.totalChanges === 0}
              >
                🔄 Rollback All Changes
              </button>
            </div>
          </div>
        )}

        {selectedTab === "cells" && (
          <div className='cells-tab'>
            {changeRecord.modifiedCells.length === 0 ? (
              <div className='no-changes'>No cell changes</div>
            ) : (
              <div className='changes-list'>
                {changeRecord.modifiedCells.map((change, index) => (
                  <div key={index} className='change-item cell-change'>
                    <div className='change-header'>
                      <span className='change-location'>
                        Row {change.rowIndex}, Column {change.columnId}
                      </span>
                      <span className='change-timestamp'>{formatTimestamp(change.timestamp)}</span>
                    </div>
                    <div className='change-details'>
                      <div className='value-change'>
                        <span className='old-value'>{formatCellValue(change.originalValue)}</span>
                        <span className='arrow'>→</span>
                        <span className='new-value'>{formatCellValue(change.newValue)}</span>
                      </div>
                    </div>
                    <div className='change-actions'>
                      <button
                        className='rollback-button'
                        onClick={() => onRollback("cell", change.rowIndex, change.columnId)}
                        title='Rollback this change'
                      >
                        🔄
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedTab === "rows" && (
          <div className='rows-tab'>
            {changeRecord.addedRows.length === 0 && changeRecord.deletedRows.length === 0 ? (
              <div className='no-changes'>No row changes</div>
            ) : (
              <div className='changes-list'>
                {/* Added rows */}
                {changeRecord.addedRows.map((addition, index) => (
                  <div key={`add-${index}`} className='change-item row-addition'>
                    <div className='change-header'>
                      <span className='change-type'>➕ Added Row</span>
                      <span className='change-location'>Row {addition.rowIndex}</span>
                      <span className='change-timestamp'>
                        {formatTimestamp(addition.timestamp)}
                      </span>
                    </div>
                    <div className='change-details'>
                      <div className='row-data'>
                        {Object.entries(addition.data).map(([key, value]) => (
                          <div key={key} className='data-field'>
                            <span className='field-name'>{key}:</span>
                            <span className='field-value'>{formatCellValue(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className='change-actions'>
                      <button
                        className='rollback-button'
                        onClick={() => onRollback("row", addition.rowIndex)}
                        title='Remove this added row'
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}

                {/* Deleted rows */}
                {changeRecord.deletedRows.map((deletion, index) => (
                  <div key={`del-${index}`} className='change-item row-deletion'>
                    <div className='change-header'>
                      <span className='change-type'>🗑️ Deleted Row</span>
                      <span className='change-location'>Row {deletion.originalIndex}</span>
                      <span className='change-timestamp'>
                        {formatTimestamp(deletion.timestamp)}
                      </span>
                    </div>
                    <div className='change-details'>
                      <div className='row-data'>
                        {Object.entries(deletion.data).map(([key, value]) => (
                          <div key={key} className='data-field'>
                            <span className='field-name'>{key}:</span>
                            <span className='field-value'>{formatCellValue(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className='change-actions'>
                      <button
                        className='rollback-button'
                        onClick={() => onRollback("row", deletion.originalIndex)}
                        title='Restore this deleted row'
                      >
                        🔄
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedTab === "sql" && showSQL && (
          <div className='sql-tab'>
            {sqlStatements.length === 0 ? (
              <div className='no-changes'>No SQL statements to execute</div>
            ) : (
              <div className='sql-statements'>
                <div className='sql-header'>
                  <h4>Generated SQL Statements</h4>
                  <button
                    className='copy-sql-button'
                    onClick={() => {
                      navigator.clipboard?.writeText(`${sqlStatements.join(";\n")};`)
                    }}
                  >
                    📋 Copy All
                  </button>
                </div>
                <div className='sql-list'>
                  {sqlStatements.map((statement, index) => (
                    <div key={index} className='sql-statement'>
                      <div className='sql-index'>{index + 1}.</div>
                      <code className='sql-code'>{statement};</code>
                      <button
                        className='copy-statement-button'
                        onClick={() => navigator.clipboard?.writeText(`${statement};`)}
                        title='Copy this statement'
                      >
                        📋
                      </button>
                    </div>
                  ))}
                </div>
                <div className='sql-footer'>
                  <div className='sql-note'>
                    💡 These statements represent all pending changes and can be executed to apply
                    changes to the database.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
