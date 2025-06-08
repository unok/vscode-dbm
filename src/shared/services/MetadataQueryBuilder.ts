import type {
  MetadataQuery,
  MySQLMetadataQuery,
  PostgreSQLMetadataQuery,
  SQLiteMetadataQuery,
} from "../types/schema";

export class MetadataQueryBuilder {
  getQueries(dbType: "mysql" | "postgresql" | "sqlite"): MetadataQuery {
    switch (dbType) {
      case "mysql":
        return new MySqlQueries();
      case "postgresql":
        return new PostgreSqlQueries();
      case "sqlite":
        return new SqLiteQueries();
      default:
        throw new Error(`Unsupported database type: ${dbType}`);
    }
  }
}

class MySqlQueries implements MySQLMetadataQuery {
  getTables(schema?: string): string {
    const schemaFilter = schema ? `AND TABLE_SCHEMA = '${schema}'` : "";
    return `
      SELECT 
        TABLE_NAME as name,
        TABLE_SCHEMA as schema,
        TABLE_TYPE as type,
        TABLE_COMMENT as comment,
        CREATE_TIME as created_at,
        UPDATE_TIME as updated_at
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE' ${schemaFilter}
      ORDER BY TABLE_NAME
    `;
  }

  getViews(schema?: string): string {
    const schemaFilter = schema ? `AND TABLE_SCHEMA = '${schema}'` : "";
    return `
      SELECT 
        TABLE_NAME as name,
        TABLE_SCHEMA as schema,
        VIEW_DEFINITION as definition,
        TABLE_COMMENT as comment
      FROM INFORMATION_SCHEMA.VIEWS 
      WHERE 1=1 ${schemaFilter}
      ORDER BY TABLE_NAME
    `;
  }

  getColumns(table: string, schema?: string): string {
    const schemaFilter = schema ? `AND TABLE_SCHEMA = '${schema}'` : "";
    return `
      SELECT 
        c.COLUMN_NAME as name,
        c.DATA_TYPE as type,
        c.IS_NULLABLE = 'YES' as nullable,
        c.COLUMN_DEFAULT as default_value,
        c.COLUMN_KEY = 'PRI' as is_primary_key,
        c.COLUMN_KEY = 'UNI' as is_unique,
        c.EXTRA LIKE '%auto_increment%' as is_auto_increment,
        c.CHARACTER_MAXIMUM_LENGTH as max_length,
        c.NUMERIC_PRECISION as precision,
        c.NUMERIC_SCALE as scale,
        c.COLUMN_COMMENT as comment,
        kcu.REFERENCED_TABLE_NAME as foreign_key_table,
        kcu.REFERENCED_COLUMN_NAME as foreign_key_column,
        kcu.REFERENCED_TABLE_SCHEMA as foreign_key_schema
      FROM INFORMATION_SCHEMA.COLUMNS c
      LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu 
        ON c.TABLE_SCHEMA = kcu.TABLE_SCHEMA 
        AND c.TABLE_NAME = kcu.TABLE_NAME 
        AND c.COLUMN_NAME = kcu.COLUMN_NAME
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
      WHERE c.TABLE_NAME = '${table}' ${schemaFilter}
      ORDER BY c.ORDINAL_POSITION
    `;
  }

  getIndexes(table: string, schema?: string): string {
    const schemaFilter = schema ? `AND TABLE_SCHEMA = '${schema}'` : "";
    return `
      SELECT 
        INDEX_NAME as name,
        COLUMN_NAME as column_name,
        NON_UNIQUE = 0 as is_unique,
        INDEX_NAME = 'PRIMARY' as is_primary,
        INDEX_TYPE as type
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_NAME = '${table}' ${schemaFilter}
      ORDER BY INDEX_NAME, SEQ_IN_INDEX
    `;
  }

  getConstraints(table: string, schema?: string): string {
    const schemaFilter = schema ? `AND TABLE_SCHEMA = '${schema}'` : "";
    return `
      SELECT 
        CONSTRAINT_NAME as name,
        CONSTRAINT_TYPE as type,
        COLUMN_NAME as column_name,
        REFERENCED_TABLE_NAME as referenced_table,
        REFERENCED_COLUMN_NAME as referenced_column
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
      JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc 
        ON kcu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
        AND kcu.TABLE_SCHEMA = tc.TABLE_SCHEMA
      WHERE kcu.TABLE_NAME = '${table}' ${schemaFilter}
      ORDER BY CONSTRAINT_NAME
    `;
  }

  getFunctions(schema?: string): string {
    const schemaFilter = schema ? `AND ROUTINE_SCHEMA = '${schema}'` : "";
    return `
      SELECT 
        ROUTINE_NAME as name,
        ROUTINE_SCHEMA as schema,
        DATA_TYPE as return_type,
        ROUTINE_DEFINITION as definition,
        ROUTINE_COMMENT as comment
      FROM INFORMATION_SCHEMA.ROUTINES 
      WHERE ROUTINE_TYPE = 'FUNCTION' ${schemaFilter}
      ORDER BY ROUTINE_NAME
    `;
  }

  getTriggers(table?: string, schema?: string): string {
    const tableFilter = table ? `AND EVENT_OBJECT_TABLE = '${table}'` : "";
    const schemaFilter = schema ? `AND TRIGGER_SCHEMA = '${schema}'` : "";
    return `
      SELECT 
        TRIGGER_NAME as name,
        EVENT_OBJECT_TABLE as table_name,
        EVENT_MANIPULATION as event,
        ACTION_TIMING as timing,
        ACTION_STATEMENT as definition
      FROM INFORMATION_SCHEMA.TRIGGERS 
      WHERE 1=1 ${tableFilter} ${schemaFilter}
      ORDER BY TRIGGER_NAME
    `;
  }

  getRowCount(table: string, schema?: string): string {
    const fullTableName = schema
      ? `\`${schema}\`.\`${table}\``
      : `\`${table}\``;
    return `SELECT COUNT(*) as count FROM ${fullTableName}`;
  }

  getTableSize(table: string, schema?: string): string {
    const schemaFilter = schema ? `AND TABLE_SCHEMA = '${schema}'` : "";
    return `
      SELECT 
        DATA_LENGTH + INDEX_LENGTH as size_bytes,
        TABLE_ROWS as row_count
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = '${table}' ${schemaFilter}
    `;
  }

  getAutoIncrementInfo(table: string, schema?: string): string {
    const schemaFilter = schema ? `AND TABLE_SCHEMA = '${schema}'` : "";
    return `
      SELECT AUTO_INCREMENT as next_value
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = '${table}' ${schemaFilter}
    `;
  }
}

class PostgreSqlQueries implements PostgreSQLMetadataQuery {
  getTables(schema = "public"): string {
    return `
      SELECT 
        t.table_name as name,
        t.table_schema as schema,
        'table' as type,
        obj_description(c.oid) as comment
      FROM information_schema.tables t
      LEFT JOIN pg_class c ON c.relname = t.table_name
      WHERE t.table_type = 'BASE TABLE' 
        AND t.table_schema = '${schema}'
      ORDER BY t.table_name
    `;
  }

  getViews(schema = "public"): string {
    return `
      SELECT 
        table_name as name,
        table_schema as schema,
        view_definition as definition
      FROM information_schema.views 
      WHERE table_schema = '${schema}'
      ORDER BY table_name
    `;
  }

  getColumns(table: string, schema = "public"): string {
    return `
      SELECT 
        c.column_name as name,
        c.data_type as type,
        CASE 
          WHEN c.data_type = 'character varying' THEN c.data_type || '(' || c.character_maximum_length || ')'
          WHEN c.data_type = 'numeric' AND c.numeric_precision IS NOT NULL THEN 
            c.data_type || '(' || c.numeric_precision || 
            CASE WHEN c.numeric_scale IS NOT NULL AND c.numeric_scale > 0 
                 THEN ',' || c.numeric_scale 
                 ELSE '' END || ')'
          ELSE c.data_type
        END as full_type,
        c.is_nullable = 'YES' as nullable,
        c.column_default as default_value,
        CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key,
        CASE WHEN u.column_name IS NOT NULL THEN true ELSE false END as is_unique,
        c.column_default LIKE 'nextval%' as is_auto_increment,
        c.character_maximum_length as max_length,
        c.character_maximum_length,
        c.numeric_precision as precision,
        c.numeric_precision,
        c.numeric_scale as scale,
        c.numeric_scale,
        col_description(pgc.oid, c.ordinal_position) as comment,
        pk.constraint_name,
        fk.foreign_table_name as foreign_key_table,
        fk.foreign_column_name as foreign_key_column,
        fk.foreign_table_schema as foreign_key_schema
      FROM information_schema.columns c
      LEFT JOIN pg_class pgc ON pgc.relname = c.table_name
      LEFT JOIN pg_namespace pgn ON pgn.oid = pgc.relnamespace AND pgn.nspname = c.table_schema
      LEFT JOIN (
        SELECT ku.column_name, tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage ku 
          ON tc.constraint_name = ku.constraint_name
        WHERE tc.constraint_type = 'PRIMARY KEY' 
          AND tc.table_name = '${table}' 
          AND tc.table_schema = '${schema}'
      ) pk ON pk.column_name = c.column_name
      LEFT JOIN (
        SELECT ku.column_name, tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage ku 
          ON tc.constraint_name = ku.constraint_name
        WHERE tc.constraint_type = 'UNIQUE' 
          AND tc.table_name = '${table}' 
          AND tc.table_schema = '${schema}'
      ) u ON u.column_name = c.column_name
      LEFT JOIN (
        SELECT 
          ku.column_name,
          ccu.table_name as foreign_table_name,
          ccu.column_name as foreign_column_name,
          ccu.table_schema as foreign_table_schema
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage ku 
          ON tc.constraint_name = ku.constraint_name
        JOIN information_schema.constraint_column_usage ccu 
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_name = '${table}' 
          AND tc.table_schema = '${schema}'
      ) fk ON fk.column_name = c.column_name
      WHERE c.table_name = '${table}' 
        AND c.table_schema = '${schema}'
      ORDER BY c.ordinal_position
    `;
  }

  getIndexes(table: string, schema = "public"): string {
    return `
      SELECT 
        i.relname as name,
        array_to_string(array_agg(a.attname), ',') as column_names,
        ix.indisunique as is_unique,
        ix.indisprimary as is_primary,
        am.amname as type
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_am am ON i.relam = am.oid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE t.relname = '${table}' 
        AND n.nspname = '${schema}'
      GROUP BY i.relname, ix.indisunique, ix.indisprimary, am.amname
      ORDER BY i.relname
    `;
  }

  getConstraints(table: string, schema = "public"): string {
    return `
      SELECT 
        tc.constraint_name as name,
        tc.constraint_type as type,
        ku.column_name,
        ccu.table_name as referenced_table,
        ccu.column_name as referenced_column
      FROM information_schema.table_constraints tc
      LEFT JOIN information_schema.key_column_usage ku 
        ON tc.constraint_name = ku.constraint_name
      LEFT JOIN information_schema.constraint_column_usage ccu 
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.table_name = '${table}' 
        AND tc.table_schema = '${schema}'
      ORDER BY tc.constraint_name
    `;
  }

  getFunctions(schema = "public"): string {
    return `
      SELECT 
        p.proname as name,
        n.nspname as schema,
        pg_get_function_result(p.oid) as return_type,
        pg_get_functiondef(p.oid) as definition
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = '${schema}'
        AND p.prokind = 'f'
      ORDER BY p.proname
    `;
  }

  getTriggers(table?: string, schema = "public"): string {
    const tableFilter = table ? `AND t.relname = '${table}'` : "";
    return `
      SELECT 
        trig.tgname as name,
        t.relname as table_name,
        CASE trig.tgtype & 3
          WHEN 1 THEN 'delete'
          WHEN 2 THEN 'update'
          WHEN 4 THEN 'insert'
        END as event,
        CASE trig.tgtype & 66
          WHEN 2 THEN 'before'
          WHEN 64 THEN 'after'
        END as timing,
        pg_get_triggerdef(trig.oid) as definition
      FROM pg_trigger trig
      JOIN pg_class t ON trig.tgrelid = t.oid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = '${schema}' ${tableFilter}
        AND NOT trig.tgisinternal
      ORDER BY trig.tgname
    `;
  }

  getRowCount(table: string, schema = "public"): string {
    return `SELECT COUNT(*) as count FROM "${schema}"."${table}"`;
  }

  getSequences(schema = "public"): string {
    return `
      SELECT 
        sequence_name as name,
        data_type,
        start_value,
        minimum_value,
        maximum_value,
        increment
      FROM information_schema.sequences
      WHERE sequence_schema = '${schema}'
      ORDER BY sequence_name
    `;
  }

  getEnums(schema = "public"): string {
    return `
      SELECT 
        t.typname as name,
        array_to_string(array_agg(e.enumlabel), ',') as values
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = '${schema}'
      GROUP BY t.typname
      ORDER BY t.typname
    `;
  }

  getTablespaces(): string {
    return `
      SELECT 
        spcname as name,
        pg_tablespace_location(oid) as location
      FROM pg_tablespace
      ORDER BY spcname
    `;
  }
}

class SqLiteQueries implements SQLiteMetadataQuery {
  getTables(): string {
    return `
      SELECT 
        name,
        type,
        sql as definition
      FROM sqlite_master 
      WHERE type = 'table' 
        AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `;
  }

  getViews(): string {
    return `
      SELECT 
        name,
        sql as definition
      FROM sqlite_master 
      WHERE type = 'view'
      ORDER BY name
    `;
  }

  getColumns(table: string): string {
    return `PRAGMA table_info("${table}")`;
  }

  getIndexes(table: string): string {
    return `PRAGMA index_list("${table}")`;
  }

  getConstraints(table: string): string {
    return `
      SELECT sql as definition
      FROM sqlite_master 
      WHERE type = 'table' 
        AND name = '${table}'
    `;
  }

  getFunctions(): string {
    // SQLite doesn't have user-defined functions in the same way
    return "SELECT NULL as name WHERE 1=0";
  }

  getTriggers(table?: string): string {
    const tableFilter = table ? `AND tbl_name = '${table}'` : "";
    return `
      SELECT 
        name,
        tbl_name as table_name,
        sql as definition
      FROM sqlite_master 
      WHERE type = 'trigger' ${tableFilter}
      ORDER BY name
    `;
  }

  getRowCount(table: string): string {
    return `SELECT COUNT(*) as count FROM "${table}"`;
  }

  getPragmaInfo(table: string): string {
    return `PRAGMA table_info("${table}")`;
  }

  getForeignKeys(table: string): string {
    return `PRAGMA foreign_key_list("${table}")`;
  }
}
