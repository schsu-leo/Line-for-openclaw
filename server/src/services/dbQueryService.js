const db = require('../config/db');
const { encrypt, decrypt } = require('../config/encryption');
const { getSetting, invalidate } = require('./settings.service');
const OpenAI = require('openai');
const { GoogleGenAI } = require('@google/genai');

// Tables to exclude from all queries (system/internal tables)
const SYSTEM_TABLES = [
  'knex_migrations', 'knex_migrations_lock',
  'knex_migrations_unified', 'knex_migrations_unified_lock',
  'nocodb_meta', 'nc_evolutions', 'nc_models_v2',
  'db_query_permissions',
];

// DML/DDL keywords forbidden in generated SQL
const FORBIDDEN_KEYWORDS = [
  'DROP', 'DELETE', 'INSERT', 'UPDATE', 'CREATE', 'ALTER',
  'TRUNCATE', 'EXEC', 'EXECUTE', 'GRANT', 'REVOKE', 'COPY',
];

/**
 * Get all public tables in the DB (admin view).
 */
async function getAllPublicTables() {
  const rows = await db('information_schema.tables')
    .select('table_name')
    .where({ table_schema: 'public' })
    .whereIn('table_type', ['BASE TABLE', 'VIEW'])
    .whereNotIn('table_name', SYSTEM_TABLES)
    .orderBy('table_name');
  return rows.map((r) => r.table_name);
}

/**
 * Get allowed tables for a given user.
 * Admin → all tables; others → department whitelist.
 */
async function getAllowedTables(user) {
  if (user.roles?.includes('admin')) return getAllPublicTables();
  const perm = await db('db_query_permissions')
    .where({ department: user.department })
    .first();
  return perm ? (perm.allowed_tables || []) : [];
}

/**
 * Get hidden columns map for a user's department.
 * Returns { tableName: [col1, col2] }
 */
async function getHiddenColumns(user) {
  if (user.roles?.includes('admin')) return {};
  const perm = await db('db_query_permissions')
    .where({ department: user.department })
    .first();
  return perm ? (perm.hidden_columns || {}) : {};
}

/**
 * Get column schema for a list of tables.
 * Returns { tableName: [{ column_name, data_type, is_nullable }] }
 */
async function getSchemaForTables(tables) {
  if (!tables.length) return {};
  const cols = await db('information_schema.columns')
    .select('table_name', 'column_name', 'data_type', 'is_nullable')
    .where({ table_schema: 'public' })
    .whereIn('table_name', tables)
    .orderBy(['table_name', 'ordinal_position']);

  const schema = {};
  for (const col of cols) {
    if (!schema[col.table_name]) schema[col.table_name] = [];
    schema[col.table_name].push({
      column_name: col.column_name,
      data_type: col.data_type,
      is_nullable: col.is_nullable,
    });
  }
  return schema;
}

/**
 * Apply hidden_columns filter to result rows.
 */
function applyHiddenColumns(rows, hiddenColumns, tableName) {
  const hidden = hiddenColumns[tableName] || [];
  if (!hidden.length) return rows;
  return rows.map((row) => {
    const cleaned = { ...row };
    for (const col of hidden) delete cleaned[col];
    return cleaned;
  });
}

/**
 * Validate SQL: SELECT only, no forbidden keywords, tables in whitelist.
 * Returns array of table names found in query.
 */
function validateSQL(sql, allowedTables) {
  const trimmed = sql.trim();

  // Must start with SELECT or WITH (CTE)
  if (!/^(SELECT|WITH)\s/i.test(trimmed)) {
    throw new Error('只允許 SELECT 查詢');
  }

  // Check forbidden keywords (word boundary)
  const upper = trimmed.toUpperCase();
  for (const kw of FORBIDDEN_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`);
    if (re.test(upper)) {
      throw new Error(`SQL 包含禁止的操作：${kw}`);
    }
  }

  // Block comments
  if (trimmed.includes('--') || trimmed.includes('/*')) {
    throw new Error('SQL 不允許包含註解');
  }

  // Extract table names from FROM / JOIN clauses
  const tablePattern = /(?:FROM|JOIN)\s+([a-z_][a-z0-9_]*)/gi;
  let match;
  const mentionedTables = [];
  while ((match = tablePattern.exec(trimmed)) !== null) {
    mentionedTables.push(match[1].toLowerCase());
  }

  // Verify all tables are allowed
  for (const table of mentionedTables) {
    if (!allowedTables.includes(table)) {
      throw new Error(`無此資料表的查詢權限：${table}`);
    }
  }

  return mentionedTables;
}

/**
 * Strip LIMIT clause from SQL (for unlimited export).
 */
function stripLimit(sql) {
  return sql.replace(/\bLIMIT\s+\d+\s*;?\s*$/i, '').trim();
}

/**
 * Execute a raw SQL query with optional row limit.
 * Returns { rows, total_count }.
 */
async function executeSQL(sql, limit = null) {
  // Get total count first (wrap in subquery)
  const countResult = await db.raw(`SELECT COUNT(*) FROM (${stripLimit(sql)}) AS _count_query`);
  const totalCount = parseInt(countResult.rows[0].count, 10);

  // Execute with limit for display
  const displaySQL = limit
    ? `${stripLimit(sql)} LIMIT ${limit}`
    : stripLimit(sql);

  const result = await db.raw(displaySQL);
  return { rows: result.rows, total_count: totalCount };
}

/**
 * Build and execute a query from visual filter conditions.
 */
async function executeVisualQuery(table, filters, sortBy, sortDir, limit) {
  let query = db(table).select('*');

  for (const f of filters) {
    if (!f.column || f.value === '') continue;
    switch (f.operator) {
      case '=':
        query = query.where(f.column, f.value);
        break;
      case '!=':
        query = query.whereNot(f.column, f.value);
        break;
      case '>':
        query = query.where(f.column, '>', f.value);
        break;
      case '>=':
        query = query.where(f.column, '>=', f.value);
        break;
      case '<':
        query = query.where(f.column, '<', f.value);
        break;
      case '<=':
        query = query.where(f.column, '<=', f.value);
        break;
      case 'contains':
        query = query.whereILike(f.column, `%${f.value}%`);
        break;
      case 'starts_with':
        query = query.whereILike(f.column, `${f.value}%`);
        break;
      case 'is_null':
        query = query.whereNull(f.column);
        break;
      case 'is_not_null':
        query = query.whereNotNull(f.column);
        break;
    }
  }

  if (sortBy) query = query.orderBy(sortBy, sortDir || 'desc');

  // Get total count
  const countQuery = query.clone().clearSelect().clearOrder().count('* as count');
  const [{ count }] = await countQuery;
  const totalCount = parseInt(count, 10);

  // Apply limit
  if (limit) query = query.limit(limit);

  const rows = await query;
  return { rows, total_count: totalCount };
}

/**
 * Get LLM config from system_settings.
 */
async function getLLMConfig() {
  const [provider, model, apiKeyEncrypted] = await Promise.all([
    getSetting('db_query_llm_provider'),
    getSetting('db_query_llm_model'),
    db('system_settings').where({ key: 'db_query_llm_api_key' }).first(),
  ]);

  let apiKey = '';
  if (apiKeyEncrypted?.value) {
    try { apiKey = decrypt(apiKeyEncrypted.value); } catch { apiKey = ''; }
  }

  return {
    provider: provider || 'gemini',
    model: model || 'gemini-2.5-flash',
    apiKey: apiKey || '',
  };
}

/**
 * Save LLM config to system_settings.
 */
async function saveLLMConfig({ provider, model, apiKey }) {
  const upsert = async (key, value) => {
    const exists = await db('system_settings').where({ key }).first();
    if (exists) {
      await db('system_settings').where({ key }).update({ value, updated_at: new Date() });
    } else {
      await db('system_settings').insert({ key, value, updated_at: new Date() });
    }
    invalidate(key);
  };

  await upsert('db_query_llm_provider', provider || 'gemini');
  await upsert('db_query_llm_model', model || 'gemini-2.5-flash');

  if (apiKey && apiKey !== '***') {
    await upsert('db_query_llm_api_key', encrypt(apiKey));
  }
}

/**
 * Build base URL for a given provider (OpenAI-compatible).
 */
function getBaseURL(provider) {
  switch (provider) {
    case 'gemini':
      return 'https://generativelanguage.googleapis.com/v1beta/openai/';
    case 'openai':
      return 'https://api.openai.com/v1/';
    default:
      return 'https://generativelanguage.googleapis.com/v1beta/openai/';
  }
}

/**
 * Call LLM (Gemini / OpenAI) with schema + user query.
 * Returns { sql, columns }.
 */
async function callLLMForSQL(userQuery, schema) {
  const config = await getLLMConfig();
  if (!config.apiKey) throw new Error('尚未設定 LLM API Key，請至系統設定配置。');

  const schemaText = Object.entries(schema)
    .map(([table, cols]) => {
      const colDefs = cols.map((c) => `  ${c.column_name} (${c.data_type})`).join('\n');
      return `### ${table}\n${colDefs}`;
    })
    .join('\n\n');

  const prompt = `你是一個 PostgreSQL SQL 查詢助理。根據以下資料庫 schema，將用戶的需求轉換為 SQL 查詢。

## 規則
1. 只能輸出 SELECT 語句（允許 WITH CTE）
2. 禁止使用 DROP、DELETE、INSERT、UPDATE、CREATE、ALTER、TRUNCATE
3. 加上 LIMIT 500（用於網頁顯示）
4. 使用繁體中文思考，但欄位名稱保持原樣
5. 回傳純 JSON，格式如下：
   { "sql": "SELECT ...", "columns": ["col1", "col2"] }
   columns 為最相關的 8 個欄位名稱（原始欄位名，非別名）

## 可查詢的資料表 Schema
${schemaText}

## 用戶需求
${userQuery}`;

  let content;

  if (config.provider === 'gemini') {
    // Use @google/genai SDK directly for Gemini
    const ai = new GoogleGenAI({ apiKey: config.apiKey });
    const result = await ai.models.generateContent({
      model: config.model || 'gemini-2.5-flash',
      contents: prompt,
      config: { temperature: 0.1 },
    });
    content = result.text;
  } else {
    // OpenAI or other OpenAI-compatible providers
    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: getBaseURL(config.provider),
    });
    const response = await client.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: '你是 SQL 查詢助理，只回傳純 JSON，不要有任何說明文字、不要用 markdown code block。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
    });
    content = response.choices[0].message.content;
  }

  // Strip markdown code blocks if present
  const cleaned = content.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to extract JSON object from text
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* fall through */ }
    }
    throw new Error('LLM 回傳格式錯誤，請重試');
  }
}

module.exports = {
  getAllowedTables,
  getHiddenColumns,
  getSchemaForTables,
  applyHiddenColumns,
  validateSQL,
  stripLimit,
  executeSQL,
  executeVisualQuery,
  getLLMConfig,
  saveLLMConfig,
  callLLMForSQL,
  getAllPublicTables,
};
