import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { pathToFileURL } from 'node:url';

export function betaConfigurationErrors(config, env) {
  const errors = [];
  const id = config.hyperdrive?.find(binding => binding.binding === 'HYPERDRIVE')?.id;
  if (!/^[a-f0-9]{32}$/i.test(id || '') || /^0+$/.test(id)) errors.push('Thay Hyperdrive ID thật trong wrangler.beta.json.');
  const key = env.PUBLIC_TURNSTILE_SITE_KEY || '';
  if (!/^0x[\w-]+$/.test(key) || /0000000000/.test(key)) errors.push('Đặt Turnstile site key thật trong .env.beta.local.');
  const hostname = config.vars?.TURNSTILE_EXPECTED_HOSTNAME || '';
  if (!hostname.startsWith(`${config.name}.`) || !/^[a-z0-9.-]+\.workers\.dev$/.test(hostname)) errors.push('TURNSTILE_EXPECTED_HOSTNAME phải khớp tên Worker và hostname workers.dev, không có https:// hay đường dẫn.');
  if (config.vars?.NODE_ENV !== 'production') errors.push('Beta phải bật NODE_ENV=production.');
  if (!config.assets?.directory || config.assets?.not_found_handling !== '404-page') errors.push('Thiếu cấu hình static assets/404.');
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = JSON.parse(readFileSync('wrangler.beta.json', 'utf8'));
  const local = existsSync('.env.beta.local') ? parseEnv(readFileSync('.env.beta.local', 'utf8')) : {};
  const errors = betaConfigurationErrors(config, { ...local, ...process.env });
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
  else console.log('Cấu hình công khai hợp lệ. Cần kiểm tra secrets, Hyperdrive cache OFF và quyền DB trên dashboard trước deploy.');
}
