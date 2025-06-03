import { v4 as uuidv4 } from 'uuid'
import type { ColumnDefinition, CellValue, UUIDOptions } from '../types/datagrid'

export class UUIDGenerator {
  /**
   * Generate UUID v4 (random)
   */
  generateV4(): string {
    return uuidv4()
  }

  /**
   * Generate UUID v7 (timestamp-based with random suffix)
   * Provides natural sorting by creation time
   */
  generateV7(): string {
    // UUID v7 implementation
    const timestamp = Date.now()
    const timestampHex = timestamp.toString(16).padStart(12, '0')
    
    // Split timestamp into parts for UUID format
    const timeLow = timestampHex.slice(-8)
    const timeMid = timestampHex.slice(-12, -8)
    const timeHi = '7' + timestampHex.slice(-15, -12).padStart(3, '0')
    
    // Generate random clock sequence and node
    const clockSeq = Math.floor(Math.random() * 0x3fff) | 0x8000
    const node = Array.from({ length: 6 }, () => 
      Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
    ).join('')
    
    return [
      timeLow,
      timeMid,
      timeHi,
      clockSeq.toString(16).padStart(4, '0'),
      node
    ].join('-')
  }

  /**
   * Generate UUID v1 (timestamp + MAC address)
   * Note: Uses random node instead of MAC for privacy
   */
  generateV1(): string {
    const timestamp = Date.now()
    const timestampTicks = (timestamp + 12219292800000) * 10000 // Convert to 100-nanosecond intervals since UUID epoch
    
    const timeLow = (timestampTicks & 0xffffffff).toString(16).padStart(8, '0')
    const timeMid = ((timestampTicks >>> 32) & 0xffff).toString(16).padStart(4, '0')
    const timeHi = (((timestampTicks >>> 48) & 0x0fff) | 0x1000).toString(16).padStart(4, '0')
    
    const clockSeq = Math.floor(Math.random() * 0x3fff) | 0x8000
    const node = Array.from({ length: 6 }, () => 
      Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
    ).join('')
    
    return [
      timeLow,
      timeMid,
      timeHi,
      clockSeq.toString(16).padStart(4, '0'),
      node
    ].join('-')
  }

  /**
   * Generate UUID with options
   */
  generateWithOptions(options: UUIDOptions): string {
    let uuid: string
    
    switch (options.version) {
      case 1:
        uuid = this.generateV1()
        break
      case 7:
        uuid = this.generateV7()
        break
      case 4:
      default:
        uuid = this.generateV4()
        break
    }
    
    if (options.prefix) {
      uuid = options.prefix + uuid
    }
    
    if (options.suffix) {
      uuid = uuid + options.suffix
    }
    
    return uuid
  }

  /**
   * Generate appropriate default value for column
   */
  generateDefaultValue(column: ColumnDefinition): CellValue {
    const columnType = column.type.toLowerCase()
    
    // Handle UUID columns
    if (columnType.includes('uuid') || columnType.includes('guid')) {
      return this.generateV4()
    }
    
    // Handle timestamp columns with default current timestamp
    if (columnType.includes('timestamp') || 
        (columnType.includes('datetime') && column.defaultValue === 'CURRENT_TIMESTAMP')) {
      return new Date().toISOString()
    }
    
    // Handle date columns
    if (columnType.includes('date') && !columnType.includes('time')) {
      return new Date().toISOString().split('T')[0]
    }
    
    // Handle time columns
    if (columnType.includes('time') && !columnType.includes('date')) {
      return new Date().toTimeString().split(' ')[0]
    }
    
    // Handle boolean columns
    if (columnType.includes('bool')) {
      return false
    }
    
    // Handle numeric columns
    if (columnType.includes('int') || 
        columnType.includes('decimal') || 
        columnType.includes('numeric') ||
        columnType.includes('float') ||
        columnType.includes('double')) {
      return 0
    }
    
    // Handle auto-increment columns
    if (column.isAutoIncrement) {
      return undefined
    }
    
    // Handle nullable columns
    if (column.nullable) {
      return null
    }
    
    // Default string value
    return ''
  }

  /**
   * Generate contextual default values based on column name and type
   */
  generateContextualDefault(column: ColumnDefinition, existingRows: Record<string, CellValue>[]): CellValue {
    const columnName = column.name.toLowerCase()
    const columnType = column.type.toLowerCase()
    
    // Generate context-aware defaults based on column name patterns
    if (columnName.includes('email')) {
      return this.generateExampleEmail()
    }
    
    if (columnName.includes('phone')) {
      return this.generateExamplePhone()
    }
    
    if (columnName.includes('url') || columnName.includes('website')) {
      return this.generateExampleUrl()
    }
    
    if (columnName.includes('name') && !columnName.includes('file') && !columnName.includes('user')) {
      return this.generateExampleName()
    }
    
    if (columnName.includes('title')) {
      return this.generateExampleTitle()
    }
    
    if (columnName.includes('description') || columnName.includes('comment')) {
      return this.generateExampleDescription()
    }
    
    if (columnName.includes('status')) {
      return this.generateExampleStatus()
    }
    
    if (columnName.includes('price') || columnName.includes('amount') || columnName.includes('cost')) {
      return this.generateExamplePrice()
    }
    
    if (columnName.includes('count') || columnName.includes('quantity')) {
      return this.generateExampleCount()
    }
    
    // Look for patterns in existing data
    if (existingRows.length > 0) {
      const pattern = this.detectPattern(column.id, existingRows)
      if (pattern) {
        return pattern
      }
    }
    
    // Fall back to type-based default
    return this.generateDefaultValue(column)
  }

  /**
   * Generate sequential values for auto-increment like behavior
   */
  generateSequentialValue(column: ColumnDefinition, existingRows: Record<string, CellValue>[]): CellValue {
    if (column.isAutoIncrement) {
      return undefined // Let database handle
    }
    
    const columnType = column.type.toLowerCase()
    
    if (columnType.includes('int') || columnType.includes('serial')) {
      const existingValues = existingRows
        .map(row => Number(row[column.id]))
        .filter(val => !isNaN(val))
      
      if (existingValues.length === 0) {
        return 1
      }
      
      return Math.max(...existingValues) + 1
    }
    
    // Generate sequential string values
    if (columnType.includes('varchar') || columnType.includes('text')) {
      const prefix = column.name.toUpperCase().slice(0, 3)
      const sequence = existingRows.length + 1
      return `${prefix}${sequence.toString().padStart(4, '0')}`
    }
    
    return this.generateDefaultValue(column)
  }

  /**
   * Detect patterns in existing data
   */
  private detectPattern(columnId: string, rows: Record<string, CellValue>[]): CellValue | null {
    const values = rows.map(row => row[columnId]).filter(val => val !== null && val !== undefined)
    
    if (values.length === 0) {
      return null
    }
    
    // Check for numeric sequence
    const numericValues = values.map(v => Number(v)).filter(v => !isNaN(v))
    if (numericValues.length === values.length && numericValues.length > 1) {
      const differences = []
      for (let i = 1; i < numericValues.length; i++) {
        differences.push(numericValues[i] - numericValues[i - 1])
      }
      
      // Check if differences are consistent (arithmetic sequence)
      const avgDifference = differences.reduce((a, b) => a + b, 0) / differences.length
      const isSequence = differences.every(diff => Math.abs(diff - avgDifference) < 0.1)
      
      if (isSequence) {
        return numericValues[numericValues.length - 1] + avgDifference
      }
    }
    
    // Check for string patterns
    const stringValues = values.filter(v => typeof v === 'string') as string[]
    if (stringValues.length === values.length && stringValues.length > 1) {
      // Check for prefix + number pattern
      const match = stringValues[0].match(/^(.+?)(\d+)$/)
      if (match) {
        const prefix = match[1]
        const lastNumber = stringValues
          .map(v => {
            const m = v.match(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`))
            return m ? parseInt(m[1], 10) : null
          })
          .filter(n => n !== null) as number[]
        
        if (lastNumber.length === stringValues.length) {
          return prefix + (Math.max(...lastNumber) + 1)
        }
      }
    }
    
    return null
  }

  // Example data generators
  private generateExampleEmail(): string {
    const names = ['john', 'jane', 'alice', 'bob', 'charlie', 'diana']
    const domains = ['example.com', 'test.com', 'demo.org', 'sample.net']
    const name = names[Math.floor(Math.random() * names.length)]
    const domain = domains[Math.floor(Math.random() * domains.length)]
    return `${name}@${domain}`
  }

  private generateExamplePhone(): string {
    const areaCode = Math.floor(Math.random() * 900) + 100
    const exchange = Math.floor(Math.random() * 900) + 100
    const number = Math.floor(Math.random() * 9000) + 1000
    return `${areaCode}-${exchange}-${number}`
  }

  private generateExampleUrl(): string {
    const domains = ['example.com', 'test.org', 'demo.net', 'sample.com']
    const domain = domains[Math.floor(Math.random() * domains.length)]
    return `https://www.${domain}`
  }

  private generateExampleName(): string {
    const firstNames = ['John', 'Jane', 'Alice', 'Bob', 'Charlie', 'Diana', 'Eva', 'Frank']
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis']
    const first = firstNames[Math.floor(Math.random() * firstNames.length)]
    const last = lastNames[Math.floor(Math.random() * lastNames.length)]
    return `${first} ${last}`
  }

  private generateExampleTitle(): string {
    const titles = [
      'Software Engineer',
      'Product Manager',
      'Data Scientist',
      'UX Designer',
      'Marketing Specialist',
      'Sales Representative'
    ]
    return titles[Math.floor(Math.random() * titles.length)]
  }

  private generateExampleDescription(): string {
    const descriptions = [
      'This is a sample description.',
      'Example content for testing purposes.',
      'Placeholder text for demonstration.',
      'Sample data entry for development.'
    ]
    return descriptions[Math.floor(Math.random() * descriptions.length)]
  }

  private generateExampleStatus(): string {
    const statuses = ['active', 'inactive', 'pending', 'completed', 'draft', 'published']
    return statuses[Math.floor(Math.random() * statuses.length)]
  }

  private generateExamplePrice(): number {
    return Math.round((Math.random() * 1000 + 10) * 100) / 100
  }

  private generateExampleCount(): number {
    return Math.floor(Math.random() * 100) + 1
  }
}