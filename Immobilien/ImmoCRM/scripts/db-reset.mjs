// Drop public schema in linked Supabase project + re-apply all SQL migrations.
// Requires DATABASE_URL in .env.local (Supabase: Settings → Database → Connection string → URI, mode "Session").

import { Client } from 'pg'
import fs from 'node:fs'
import path from 'node:path'
import { config } from 'dotenv'

config({ path: '.env' })
config({ path: '.env.local', override: true })

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL not set in .env.local')
  process.exit(1)
}

const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await client.connect()

console.log('▶ DROP SCHEMA public CASCADE')
await client.query(`
  DROP SCHEMA IF EXISTS public CASCADE;
  CREATE SCHEMA public;
  GRANT ALL ON SCHEMA public TO postgres;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
`)

const dir = 'supabase/migrations'
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
for (const f of files) {
  const sql = fs.readFileSync(path.join(dir, f), 'utf8')
  console.log(`▶ Apply ${f} (${sql.length} bytes)`)
  await client.query(sql)
}

await client.end()
console.log('✓ db reset complete')
