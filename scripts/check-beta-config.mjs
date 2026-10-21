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
  let publicHost;
  for(const key of ['PUBLIC_ORIGIN','INTERNAL_ORIGIN']){
    try{
      const origin=new URL(config.vars?.[key]);
      if(origin.protocol!=='https:'||origin.origin!==config.vars[key]||/localhost|example\.invalid|your-/.test(origin.hostname)) throw Error();
      if(key==='PUBLIC_ORIGIN') publicHost=origin.hostname;
    }catch{errors.push(`Cấu hình ${key} bằng HTTPS origin thật, không có đường dẫn.`);}
  }
  if(config.vars?.PUBLIC_ORIGIN===config.vars?.INTERNAL_ORIGIN) errors.push('Public và nội bộ phải dùng hai origin riêng.');
  if(hostname!==publicHost) errors.push('TURNSTILE_EXPECTED_HOSTNAME phải khớp hostname của PUBLIC_ORIGIN.');
  if(!/^[-a-z0-9]+\.cloudflareaccess\.com$/.test(config.vars?.CF_ACCESS_TEAM_DOMAIN||'')||!/^[a-f0-9]{64}$/i.test(config.vars?.CF_ACCESS_AUD||'')) errors.push('Cấu hình Cloudflare Access team domain và Application AUD thật.');
  if(config.vars?.READER_GOOGLE_ENABLED!=='true') errors.push('Chỉ bật beta sau khi cấu hình Google và READER_GOOGLE_ENABLED=true.');
  if(config.workers_dev!==false||config.assets?.run_worker_first!==true) errors.push('Tắt workers.dev và chạy Worker trước toàn bộ assets để không bỏ qua cổng nội bộ.');
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
