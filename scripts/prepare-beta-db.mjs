import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function prepareBetaSql() {
  const root = new URL('../docs/technical/schema/', import.meta.url);
  const migrations = readdirSync(new URL('migrations/', root)).filter(name => name.endsWith('.sql')).sort();
  const sources = [['01_schema.sql', readFileSync(new URL('01_schema.sql', root), 'utf8')],
    ...migrations.map(name => [name, readFileSync(new URL(`migrations/${name}`, root), 'utf8')])];
  const source = sources.map(([name, sql]) => `-- SOURCE: ${name}\n${sql}`).join('\n\n');
  const tables = [...new Set([...source.matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+(\w+)/gi)].map(match => match[1]))];
  const functions = [...new Set([...source.matchAll(/CREATE(?: OR REPLACE)? FUNCTION\s+(\w+)\s*\(/gi)].map(match => match[1]))];
  const schema = `-- CHỈ chạy trên project beta mới, chưa có dữ liệu YSBK. Không chạy 02_seed.sql.
SET search_path = public, extensions;
DO $$ BEGIN
  IF to_regclass('public.book_titles') IS NOT NULL THEN
    RAISE EXCEPTION 'YSBK_BOOTSTRAP_REQUIRES_EMPTY_DATABASE';
  END IF;
END $$;
${source}
INSERT INTO funds (id, name, description) VALUES
 ('FUND_LOAN', 'Quỹ Hoạt Động Mượn – Trả', 'Tiền cọc và giao dịch bàn trực'),
 ('FUND_OPERATION', 'Quỹ Hoạt Động Chung CLB', 'Hội phí, bán sách và sự kiện')
ON CONFLICT (id) DO NOTHING;
`;
  const access = `-- Chỉ dành cho project beta YSBK riêng. Worker dùng ysbk_app; trình duyệt không dùng role này.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ysbk_app') THEN
    CREATE ROLE ysbk_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ysbk_app' AND (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole)) THEN
    RAISE EXCEPTION 'ysbk_app must be an unprivileged application role';
  END IF;
END $$;
ALTER ROLE ysbk_app SET search_path = public, extensions;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO ysbk_app;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'extensions') THEN
    GRANT USAGE ON SCHEMA extensions TO ysbk_app;
  END IF;
END $$;
${tables.map(table => `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.${table} FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON public.${table} FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON public.${table} FROM authenticated; END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.${table} TO ysbk_app;
DROP POLICY IF EXISTS ysbk_backend_access ON public.${table};
CREATE POLICY ysbk_backend_access ON public.${table} FOR ALL TO ysbk_app USING (true) WITH CHECK (true);`).join('\n')}
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ysbk_app;
${functions.map(name => `REVOKE ALL ON FUNCTION public.${name}() FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON FUNCTION public.${name}() FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON FUNCTION public.${name}() FROM authenticated; END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.${name}() TO ysbk_app;`).join('\n')}
`;
  return { schema, access, tables };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { schema, access } = prepareBetaSql();
  const out = resolve('.review-artifacts/beta-db');
  mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, '01-schema.sql'), schema);
  writeFileSync(resolve(out, '02-access.sql'), access);
  console.log(`Đã tạo SQL tại ${out}. Chưa kết nối hoặc sửa database nào.`);
}
