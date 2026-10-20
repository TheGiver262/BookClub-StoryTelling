import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, '../..');

test('G-secrets 1: .env.example contains only placeholders and no real secrets or production credentials', () => {
  const envExamplePath = path.join(WORKSPACE_ROOT, '.env.example');
  assert.ok(fs.existsSync(envExamplePath), '.env.example must exist');

  const content = fs.readFileSync(envExamplePath, 'utf-8');

  // Must not contain actual sensitive keys
  assert.ok(!content.includes('sbp_'), 'Must not contain Supabase personal tokens');
  assert.ok(!content.includes('eyJh'), 'Must not contain real JWT tokens');
  assert.ok(!content.includes('BEGIN PRIVATE KEY'), 'Must not contain private keys');
  assert.ok(!content.includes('password123'), 'Must not contain weak real passwords');

  // Must contain expected configuration placeholders
  assert.ok(content.includes('DATABASE_URL='), 'Must define DATABASE_URL placeholder');
  assert.ok(content.includes('SUPABASE_URL='), 'Must define SUPABASE_URL placeholder');
  assert.ok(content.includes('SUPABASE_ANON_KEY='), 'Must define SUPABASE_ANON_KEY placeholder');
  assert.ok(content.includes('JWT_SECRET='), 'Must define JWT_SECRET placeholder');
});

test('G-secrets 2: .gitignore properly ignores .env and credential files', () => {
  const gitignorePath = path.join(WORKSPACE_ROOT, '.gitignore');
  assert.ok(fs.existsSync(gitignorePath), '.gitignore must exist');

  const content = fs.readFileSync(gitignorePath, 'utf-8');
  assert.ok(content.includes('.env'), 'Must ignore .env');
  assert.ok(content.includes('.env*.local') || content.includes('.env.local'), 'Must ignore local env overrides');
});

test('G-secrets 3: Source files in src/ do not contain hardcoded private keys or live cloud API keys', () => {
  const srcDir = path.join(WORKSPACE_ROOT, 'src');

  function scanDir(dir: string): string[] {
    const findings: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        findings.push(...scanDir(fullPath));
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.astro'))) {
        const text = fs.readFileSync(fullPath, 'utf-8');

        if (text.includes('BEGIN RSA PRIVATE KEY') || text.includes('BEGIN PRIVATE KEY')) {
          findings.push(`${fullPath}: hardcoded private key`);
        }
        if (/sbp_[a-zA-Z0-9]{20,}/.test(text)) {
          findings.push(`${fullPath}: hardcoded Supabase token`);
        }
        if (/postgres:\/\/[^:]+:[^@]+@db\.[^/]+\.supabase\.co/.test(text)) {
          findings.push(`${fullPath}: hardcoded live Supabase database URL`);
        }
      }
    }
    return findings;
  }

  const findings = scanDir(srcDir);
  assert.deepStrictEqual(findings, [], 'No hardcoded credentials allowed in src/');
});

test('G-secrets 4: Error formatting strips internal stack traces, DB credentials, and sensitive headers', async () => {
  const { formatErrorResponse } = await import('../../src/server/errors.ts');

  // Simulated internal error with DB connection details in message
  const sensitiveError = new Error('Connection failed: postgresql://postgres:SuperSecretP@ss@127.0.0.1:5432/ysbk_prod');
  const response = formatErrorResponse(sensitiveError, 'req_test_123');

  assert.strictEqual(response.status, 500);
  const data: any = await response.json();

  assert.ok(data.error, 'Response must contain error object');
  assert.strictEqual(data.error.code, 'INTERNAL_SERVER_ERROR');
  // Error message presented to client must be sanitized
  assert.strictEqual(data.error.message, 'Lỗi hệ thống nội bộ. Vui lòng thử lại sau.');
  assert.strictEqual(data.error.requestId, 'req_test_123');
  // Must NOT include stack trace or raw error message containing DB credentials
  assert.strictEqual(data.error.stack, undefined);
  assert.ok(!JSON.stringify(data).includes('SuperSecretP@ss'));
});
