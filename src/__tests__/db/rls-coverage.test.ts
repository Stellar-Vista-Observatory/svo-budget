import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

const PRISMA_DIR = join(process.cwd(), 'prisma')
const MIGRATIONS_DIR = join(PRISMA_DIR, 'migrations')

// Tables that live in the public schema (and are therefore exposed to
// PostgREST) but are not declared as models in schema.prisma. Prisma's own
// migration-tracking table needs RLS too, or the Supabase advisor flags it.
const NON_MODEL_PUBLIC_TABLES = ['_prisma_migrations']

function mappedTables(): string[] {
  const schema = readFileSync(join(PRISMA_DIR, 'schema.prisma'), 'utf8')
  const matches = schema.matchAll(/@@map\("([^"]+)"\)/g)
  return [...[...matches].map((m) => m[1]), ...NON_MODEL_PUBLIC_TABLES]
}

function rlsEnabledTables(): Set<string> {
  const tables = new Set<string>()
  for (const entry of readdirSync(MIGRATIONS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const sql = readFileSync(join(MIGRATIONS_DIR, entry.name, 'migration.sql'), 'utf8')
    const matches = sql.matchAll(
      /ALTER TABLE\s+"?([A-Za-z_][A-Za-z0-9_]*)"?\s+ENABLE ROW LEVEL SECURITY/gi
    )
    for (const m of matches) tables.add(m[1])
  }
  return tables
}

describe('RLS coverage', () => {
  it('finds tables to check (guards against a broken parser silently passing)', () => {
    expect(mappedTables().length).toBeGreaterThan(0)
    expect(rlsEnabledTables().size).toBeGreaterThan(0)
  })

  it('enables Row-Level Security on every public table', () => {
    const enabled = rlsEnabledTables()
    const missing = mappedTables().filter((t) => !enabled.has(t))
    expect(missing).toEqual([])
  })
})
