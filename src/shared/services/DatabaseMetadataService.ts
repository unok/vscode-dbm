import type { DatabaseConnection } from "../database/DatabaseConnection";
import type {
  ColumnMetadata,
  ConnectionSchema,
  ConstraintMetadata,
  DatabaseSchema,
  IndexMetadata,
  SchemaSearchOptions,
  SchemaSearchResult,
  SchemaTreeNode,
  TableMetadata,
  ViewMetadata,
} from "../types/schema";
import { MetadataQueryBuilder } from "./MetadataQueryBuilder";

export class DatabaseMetadataService {
  private cache: Map<string, ConnectionSchema> = new Map();
  private queryBuilder = new MetadataQueryBuilder();

  /**
   * Get complete database schema
   */
  async getSchema(connection: DatabaseConnection): Promise<DatabaseSchema> {
    if (!connection.isConnected()) {
      throw new Error("Database connection is not established");
    }

    const connectionId = this.getConnectionId(connection);
    const cached = this.cache.get(connectionId);

    if (cached && !cached.isStale) {
      return cached.schema;
    }

    const dbType = connection.getType() as "mysql" | "postgresql" | "sqlite";
    const queries = this.queryBuilder.getQueries(dbType);

    // Get tables
    const tablesResult = await connection.query(queries.getTables());
    const tables: TableMetadata[] = [];

    for (const tableRow of tablesResult.rows) {
      const tableMetadata = await this.getTableMetadata(
        connection,
        String(tableRow.name),
        String(tableRow.schema || ""),
      );
      tables.push(tableMetadata);
    }

    // Get views
    const viewsResult = await connection.query(queries.getViews());
    const views: ViewMetadata[] = viewsResult.rows.map((row) => ({
      name: String(row.name),
      schema: String(row.schema || ""),
      definition: String(row.definition || ""),
      columns: [], // Will be populated separately if needed
      comment: String(row.comment || ""),
    }));

    const schema: DatabaseSchema = {
      tables,
      views,
    };

    // Cache the result
    this.cache.set(connectionId, {
      connectionId,
      databaseName:
        ((tablesResult.rows[0] as Record<string, unknown>)?.schema as string) ||
        "default",
      schema,
      lastUpdated: new Date(),
      isStale: false,
    });

    return schema;
  }

  /**
   * Get detailed table metadata including columns
   */
  async getTableMetadata(
    connection: DatabaseConnection,
    tableName: string,
    schema?: string,
  ): Promise<TableMetadata> {
    const dbType = connection.getType() as "mysql" | "postgresql" | "sqlite";
    const queries = this.queryBuilder.getQueries(dbType);

    const columnsResult = await connection.query(
      queries.getColumns(tableName, schema),
    );

    if (columnsResult.rows.length === 0) {
      throw new Error(`Table "${tableName}" not found`);
    }

    const columns: ColumnMetadata[] = columnsResult.rows.map((row) => ({
      name: String(row.name),
      type: String(row.type),
      fullType: String(row.full_type || row.type), // Enhanced field
      nullable: row.nullable !== false,
      defaultValue: row.default_value as string | null,
      isPrimaryKey: row.is_primary_key === true,
      isForeignKey: Boolean(row.foreign_key_table),
      isUnique: row.is_unique === true,
      isAutoIncrement: row.is_auto_increment === true,
      maxLength: row.max_length as number | undefined,
      characterMaximumLength: row.character_maximum_length as number | null, // Enhanced field
      precision: row.precision as number | undefined,
      numericPrecision: row.numeric_precision as number | null, // Enhanced field
      scale: row.scale as number | undefined,
      numericScale: row.numeric_scale as number | null, // Enhanced field
      comment: String(row.comment || ""),
      constraintName: String(row.constraint_name || ""), // Enhanced field
      foreignKeyTarget: row.foreign_key_table
        ? {
            table: String(row.foreign_key_table),
            column: String(row.foreign_key_column),
            schema: String(row.foreign_key_schema || ""),
          }
        : undefined,
    }));

    // Get row count
    const rowCount = await this.getTableRowCount(connection, tableName, schema);

    return {
      name: tableName,
      schema,
      type: "table",
      columns,
      rowCount,
    };
  }

  /**
   * Get table row count
   */
  async getTableRowCount(
    connection: DatabaseConnection,
    tableName: string,
    schema?: string,
  ): Promise<number> {
    const dbType = connection.getType() as "mysql" | "postgresql" | "sqlite";
    const queries = this.queryBuilder.getQueries(dbType);

    const result = await connection.query(
      queries.getRowCount(tableName, schema),
    );
    return Number.parseInt(String(result.rows[0]?.count || "0"), 10);
  }

  /**
   * Search tables by name pattern
   */
  searchTables(schema: DatabaseSchema, pattern: string): TableMetadata[] {
    const lowerPattern = pattern.toLowerCase();
    return schema.tables.filter((table) =>
      table.name.toLowerCase().includes(lowerPattern),
    );
  }

  /**
   * Search schema nodes with advanced options
   */
  searchSchema(
    schema: DatabaseSchema,
    options: SchemaSearchOptions,
  ): SchemaSearchResult[] {
    const results: SchemaSearchResult[] = [];
    const pattern = options.caseSensitive
      ? options.query
      : options.query.toLowerCase();

    // Search tables
    if (options.types.includes("table")) {
      for (const table of schema.tables) {
        const tableName = options.caseSensitive
          ? table.name
          : table.name.toLowerCase();
        if (tableName.includes(pattern)) {
          results.push({
            node: this.tableToTreeNode(table),
            matches: [
              {
                field: "name",
                value: table.name,
                start: tableName.indexOf(pattern),
                end: tableName.indexOf(pattern) + pattern.length,
              },
            ],
          });
        }

        // Search columns if specified
        if (options.types.includes("column")) {
          for (const column of table.columns) {
            const columnName = options.caseSensitive
              ? column.name
              : column.name.toLowerCase();
            if (columnName.includes(pattern)) {
              results.push({
                node: this.columnToTreeNode(column, table.name),
                matches: [
                  {
                    field: "name",
                    value: column.name,
                    start: columnName.indexOf(pattern),
                    end: columnName.indexOf(pattern) + pattern.length,
                  },
                ],
              });
            }
          }
        }
      }
    }

    // Search views
    if (options.types.includes("view")) {
      for (const view of schema.views) {
        const viewName = options.caseSensitive
          ? view.name
          : view.name.toLowerCase();
        if (viewName.includes(pattern)) {
          results.push({
            node: this.viewToTreeNode(view),
            matches: [
              {
                field: "name",
                value: view.name,
                start: viewName.indexOf(pattern),
                end: viewName.indexOf(pattern) + pattern.length,
              },
            ],
          });
        }
      }
    }

    return results;
  }

  /**
   * Convert schema to tree structure
   */
  schemaToTree(schema: DatabaseSchema): SchemaTreeNode[] {
    const root: SchemaTreeNode[] = [];

    // Tables folder
    if (schema.tables.length > 0) {
      const tablesNode: SchemaTreeNode = {
        id: "tables",
        label: `Tables (${schema.tables.length})`,
        type: "tables",
        icon: "table",
        children: schema.tables.map((table) => this.tableToTreeNode(table)),
        isExpanded: true,
      };
      root.push(tablesNode);
    }

    // Views folder
    if (schema.views.length > 0) {
      const viewsNode: SchemaTreeNode = {
        id: "views",
        label: `Views (${schema.views.length})`,
        type: "views",
        icon: "eye",
        children: schema.views.map((view) => this.viewToTreeNode(view)),
        isExpanded: false,
      };
      root.push(viewsNode);
    }

    return root;
  }

  /**
   * Refresh schema cache
   */
  refreshSchema(connection: DatabaseConnection): void {
    const connectionId = this.getConnectionId(connection);
    const cached = this.cache.get(connectionId);
    if (cached) {
      cached.isStale = true;
    }
  }

  /**
   * Clear all cached schemas
   */
  clearCache(): void {
    this.cache.clear();
  }

  // Private helper methods
  private getConnectionId(connection: DatabaseConnection): string {
    // Create a unique identifier for the connection
    return `${connection.getType()}-${Date.now()}`;
  }

  private tableToTreeNode(table: TableMetadata): SchemaTreeNode {
    return {
      id: `table-${table.name}`,
      label: table.name,
      type: "table",
      icon: "table",
      metadata: table,
      children: [
        {
          id: `table-${table.name}-columns`,
          label: `Columns (${table.columns.length})`,
          type: "columns",
          icon: "list",
          children: table.columns.map((column) =>
            this.columnToTreeNode(column, table.name),
          ),
          parentId: `table-${table.name}`,
        },
      ],
    };
  }

  private viewToTreeNode(view: ViewMetadata): SchemaTreeNode {
    return {
      id: `view-${view.name}`,
      label: view.name,
      type: "view",
      icon: "eye",
      metadata: view,
    };
  }

  private columnToTreeNode(
    column: ColumnMetadata,
    tableName: string,
  ): SchemaTreeNode {
    const typeInfo = column.isPrimaryKey
      ? " (PK)"
      : column.isForeignKey
        ? " (FK)"
        : "";
    return {
      id: `column-${tableName}-${column.name}`,
      label: `${column.name}: ${column.type}${typeInfo}`,
      type: "column",
      icon: column.isPrimaryKey
        ? "key"
        : column.isForeignKey
          ? "link"
          : "field",
      metadata: column,
      parentId: `table-${tableName}-columns`,
    };
  }

  // 🔵 REFACTOR: Full implementation of enhanced metadata features

  /**
   * Get table metadata with detailed constraint information
   */
  async getTableMetadataWithConstraints(
    connection: DatabaseConnection,
    tableName: string,
    schema?: string,
  ): Promise<TableMetadata> {
    const dbType = connection.getType() as "mysql" | "postgresql" | "sqlite";
    const queries = this.queryBuilder.getQueries(dbType);

    // Get enhanced column information with constraints
    const columnsResult = await connection.query(
      queries.getColumns(tableName, schema),
    );

    if (columnsResult.rows.length === 0) {
      throw new Error(`Table "${tableName}" not found`);
    }

    const columns: ColumnMetadata[] = columnsResult.rows.map((row) => ({
      name: String(row.name),
      type: String(row.type),
      fullType: String(row.full_type || row.type),
      nullable: row.nullable !== false,
      defaultValue: row.default_value as string | null,
      isPrimaryKey: row.is_primary_key === true,
      isForeignKey: Boolean(row.foreign_key_table),
      isUnique: row.is_unique === true,
      isAutoIncrement: row.is_auto_increment === true,
      maxLength: row.max_length as number | undefined,
      characterMaximumLength: row.character_maximum_length as number | null,
      precision: row.precision as number | undefined,
      numericPrecision: row.numeric_precision as number | null,
      scale: row.scale as number | undefined,
      numericScale: row.numeric_scale as number | null,
      comment: String(row.comment || ""),
      constraintName: String(row.constraint_name || ""),
      foreignKeyTarget: row.foreign_key_table
        ? {
            table: String(row.foreign_key_table),
            column: String(row.foreign_key_column),
            schema: String(row.foreign_key_schema || ""),
          }
        : undefined,
    }));

    // Get additional metadata
    const rowCount = await this.getTableRowCount(connection, tableName, schema);
    const indexes = await this.getTableIndexes(connection, tableName, schema);
    const constraints = await this.getTableConstraints(
      connection,
      tableName,
      schema,
    );

    return {
      name: tableName,
      schema,
      type: "table",
      columns,
      rowCount,
      indexes,
      constraints,
    };
  }

  /**
   * Get table index information
   */
  async getTableIndexes(
    connection: DatabaseConnection,
    tableName: string,
    schema?: string,
  ): Promise<IndexMetadata[]> {
    const dbType = connection.getType() as "mysql" | "postgresql" | "sqlite";
    const queries = this.queryBuilder.getQueries(dbType);

    try {
      const result = await connection.query(
        queries.getIndexes(tableName, schema),
      );

      return result.rows.map((row) => ({
        name: String(row.index_name || row.name),
        table: tableName,
        columns: Array.isArray(row.column_names)
          ? row.column_names.map(String)
          : [String(row.column_name || row.column)],
        isUnique: row.is_unique === true,
        isPrimary: row.is_primary === true,
        type: String(row.index_type || "btree") as IndexMetadata["type"],
        size: row.size as number | undefined,
      }));
    } catch (error) {
      console.warn(`Failed to get indexes for table ${tableName}:`, error);
      return [];
    }
  }

  /**
   * Get table and column comments
   */
  async getTableComments(
    connection: DatabaseConnection,
    tableName: string,
    schema?: string,
  ): Promise<{
    tableComment?: string;
    columnComments: Record<string, string>;
  }> {
    const dbType = connection.getType() as "mysql" | "postgresql" | "sqlite";

    try {
      let tableComment = "";
      const columnComments: Record<string, string> = {};

      if (dbType === "postgresql") {
        // Get table comment
        const tableCommentQuery = `
          SELECT obj_description(c.oid) as comment
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relname = $1
          ${schema ? "AND n.nspname = $2" : ""}
        `;
        const tableResult = await connection.query(
          tableCommentQuery,
          schema ? [tableName, schema] : [tableName],
        );
        tableComment = String(tableResult.rows[0]?.comment || "");

        // Get column comments
        const columnCommentQuery = `
          SELECT col_description(c.oid, a.attnum) as comment, a.attname as column_name
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          JOIN pg_attribute a ON a.attrelid = c.oid
          WHERE c.relname = $1
          AND a.attnum > 0
          AND NOT a.attisdropped
          ${schema ? "AND n.nspname = $2" : ""}
        `;
        const columnResult = await connection.query(
          columnCommentQuery,
          schema ? [tableName, schema] : [tableName],
        );

        for (const row of columnResult.rows) {
          if (row.comment) {
            columnComments[String(row.column_name)] = String(row.comment);
          }
        }
      } else if (dbType === "mysql") {
        // MySQL implementation would go here
        // For now, return empty comments
      }

      return { tableComment, columnComments };
    } catch (error) {
      console.warn(`Failed to get comments for table ${tableName}:`, error);
      return { columnComments: {} };
    }
  }

  /**
   * Get detailed constraint information for a table
   */
  async getTableConstraints(
    connection: DatabaseConnection,
    tableName: string,
    schema?: string,
  ): Promise<ConstraintMetadata[]> {
    const dbType = connection.getType() as "mysql" | "postgresql" | "sqlite";

    try {
      let constraintQuery = "";

      if (dbType === "postgresql") {
        constraintQuery = `
          SELECT 
            tc.constraint_name,
            tc.constraint_type,
            array_agg(kcu.column_name ORDER BY kcu.ordinal_position) as column_names,
            tc.table_name,
            ccu.table_name AS referenced_table,
            array_agg(ccu.column_name) as referenced_columns,
            rc.delete_rule as on_delete,
            rc.update_rule as on_update,
            pg_get_constraintdef(pgc.oid) as definition
          FROM information_schema.table_constraints tc
          LEFT JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name 
            AND tc.table_schema = kcu.table_schema
          LEFT JOIN information_schema.constraint_column_usage ccu 
            ON tc.constraint_name = ccu.constraint_name 
            AND tc.table_schema = ccu.table_schema
          LEFT JOIN information_schema.referential_constraints rc 
            ON tc.constraint_name = rc.constraint_name 
            AND tc.table_schema = rc.constraint_schema
          LEFT JOIN pg_constraint pgc ON pgc.conname = tc.constraint_name
          WHERE tc.table_name = $1
          ${schema ? "AND tc.table_schema = $2" : ""}
          GROUP BY tc.constraint_name, tc.constraint_type, tc.table_name, 
                   ccu.table_name, rc.delete_rule, rc.update_rule, pgc.oid
        `;
      } else {
        // Fallback for other databases
        return [];
      }

      const result = await connection.query(
        constraintQuery,
        schema ? [tableName, schema] : [tableName],
      );

      return result.rows.map((row) => ({
        name: String(row.constraint_name),
        type: String(row.constraint_type)
          .toLowerCase()
          .replace(" ", "_") as ConstraintMetadata["type"],
        columns: Array.isArray(row.column_names)
          ? row.column_names.map(String)
          : [],
        referencedTable: row.referenced_table
          ? String(row.referenced_table)
          : undefined,
        referencedColumns: Array.isArray(row.referenced_columns)
          ? row.referenced_columns.map(String)
          : undefined,
        definition: String(row.definition || ""),
      }));
    } catch (error) {
      console.warn(`Failed to get constraints for table ${tableName}:`, error);
      return [];
    }
  }
}
