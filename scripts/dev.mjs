// Runs Expo and the backend behind a single ngrok address on your own account,
// so physical phones (on any network) and emulators can use the app.
//
//   <your-domain>/api/*, /socket.io/*  ->  backend on localhost:3000
//   <your-domain>/* (everything else)  ->  Metro on localhost:8081
//
// The domain is served over both https (used by the app's API calls) and plain
// http: Expo's QR code is an exp:// link, which Expo Go fetches over http. With
// an https proxy URL Expo would print exp://<domain>:443 instead, which fails.
//
// We don't use `expo start --tunnel`: its built-in ngrok v2 runs on Expo's
// shared account and often fails with "remote gone away" / "session closed".
// Android emulators skip the tunnel and reach the backend at 10.0.2.2:3000.
//
// Usage: npm run dev            (extra args go to expo, e.g. npm run dev -- -c)
import { execFileSync, spawn } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BACKEND_PORT = 3000;
const METRO_PORT = 8081;

function apiUrlFromEnvFile() {
  for (const file of ['.env.local', '.env']) {
    try {
      const match = readFileSync(file, 'utf8').match(/^EXPO_PUBLIC_API_URL=(.+)$/m);
      if (match) return match[1].trim().replace(/\/+$/, '');
    } catch {
      // File not present.
    }
  }
  return null;
}

// Passing --config replaces ngrok's default config (which holds the authtoken),
// so look up where it lives and pass it along too.
function defaultNgrokConfig() {
  try {
    const output = execFileSync('ngrok', ['config', 'check'], { encoding: 'utf8' });
    return output.match(/configuration file at (.+)$/m)?.[1].trim() ?? null;
  } catch {
    return null;
  }
}

// The authtoken from ngrok's own config, so our config's `agent:` section can
// carry it next to dns_resolver_ips (two `agent:` sections might not merge).
// The Microsoft Store build of ngrok reports %LOCALAPPDATA%\ngrok\ngrok.yml but
// really keeps it under %LOCALAPPDATA%\Packages\ngrok.ngrok_*\LocalCache\...
function ngrokAuthtoken(configPath) {
  const candidates = [configPath];
  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) {
    try {
      for (const dir of readdirSync(join(localAppData, 'Packages'))) {
        if (dir.startsWith('ngrok.ngrok_')) {
          candidates.push(join(localAppData, 'Packages', dir, 'LocalCache', 'Local', 'ngrok', 'ngrok.yml'));
        }
      }
    } catch {
      // No Store packages folder.
    }
  }
  for (const file of candidates.filter(Boolean)) {
    try {
      const token = readFileSync(file, 'utf8').match(/^\s*authtoken:\s*["']?([^"'\s]+)/m)?.[1];
      if (token) return token;
    } catch {
      // Not there; try the next place.
    }
  }
  return null;
}

const publicUrl = apiUrlFromEnvFile();
if (!publicUrl?.includes('ngrok')) {
  console.error('[dev] Set EXPO_PUBLIC_API_URL in .env.local to your ngrok domain (https://<name>.ngrok-free.dev).');
  process.exit(1);
}

const httpUrl = publicUrl.replace(/^https:/, 'http:');
const defaultConfig = defaultNgrokConfig();
const authtoken = ngrokAuthtoken(defaultConfig);
// Look up ngrok's servers through public DNS. Some networks' DNS (e.g. a phone
// hotspot) intermittently fails, which shows up as "lookup
// connect.ngrok-agent.com: no such host / i/o timeout" and drops the tunnel.
// Only set when the authtoken was found, so the agent section stays complete.
const agentSection = authtoken
  ? `agent:
  authtoken: ${authtoken}
  dns_resolver_ips: ["8.8.8.8", "1.1.1.1"]
`
  : '';
const ngrokConfig = join(tmpdir(), 'kashmemo-ngrok.yml');
writeFileSync(
  ngrokConfig,
  `version: 3
${agentSection}endpoints:
  - name: metro
    url: https://kashmemo-metro.internal
    upstream: { url: ${METRO_PORT} }
  - name: public
    url: ${publicUrl}
    upstream: { url: ${BACKEND_PORT} }
    traffic_policy: &routing
      on_http_request:
        - expressions:
            - "!req.url.path.startsWith('/api') && !req.url.path.startsWith('/socket.io')"
          actions:
            - type: forward-internal
              config: { url: "https://kashmemo-metro.internal" }
  - name: public-http
    url: ${httpUrl}
    upstream: { url: ${BACKEND_PORT} }
    traffic_policy: *routing
`,
);

const configs = [defaultConfig, ngrokConfig].filter(Boolean).flatMap((file) => ['--config', file]);
const MAX_ATTEMPTS = 6;
let ngrok = null;
let stopping = false;

// After a quick restart ngrok's servers can still list the previous session's
// endpoints for a few seconds (ERR_NGROK_334 "already online"), so retry.
function startNgrok(attempt = 1) {
  let alreadyOnline = false;
  let tunnelReported = false;
  // No shell, so kill() stops ngrok itself rather than a wrapping cmd.exe.
  ngrok = spawn('ngrok', ['start', '--all', ...configs, '--log', 'stdout', '--log-format', 'logfmt'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  ngrok.on('error', (error) => {
    console.error(`[dev] Could not start ngrok (${error.message}). Install it from https://ngrok.com/download.`);
  });

  const report = (chunk) => {
    for (const line of chunk.toString().split('\n')) {
      if (line.includes('ERR_NGROK_334')) {
        alreadyOnline = true;
      } else if (/msg="started tunnel".*name=public/.test(line) && !tunnelReported) {
        tunnelReported = true;
        console.log(`\n[dev] Tunnel ready: ${publicUrl} (/api -> :${BACKEND_PORT}, app -> :${METRO_PORT})\n`);
      } else if (/lvl=(eror|crit)|ERR_NGROK/.test(line) && !/session closing|terminating|command failed/.test(line)) {
        console.error(`[dev] ngrok: ${line.trim()}`);
      }
    }
  };
  ngrok.stdout.on('data', report);
  ngrok.stderr.on('data', report);
  ngrok.on('exit', (code) => {
    if (stopping || !code) return;
    if (alreadyOnline && attempt < MAX_ATTEMPTS) {
      console.log(`[dev] ngrok still sees the previous tunnel online; retrying (${attempt}/${MAX_ATTEMPTS - 1})...`);
      setTimeout(() => startNgrok(attempt + 1), 5000);
      return;
    }
    const reason = alreadyOnline
      ? 'the address is in use by another ngrok session (close other `ngrok` / `npm run dev` windows)'
      : `code ${code}`;
    console.error(`[dev] ngrok stopped: ${reason}. Phones can't reach the app; emulators still can.`);
  });
}
startNgrok();

// EXPO_PACKAGER_PROXY_URL makes the QR code and manifest point at the tunnel
// (http, see the note at the top).
const expo = spawn('npx', ['expo', 'start', '--port', String(METRO_PORT), ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, EXPO_PACKAGER_PROXY_URL: httpUrl },
});

const stopNgrok = () => {
  stopping = true;
  if (ngrok?.exitCode === null) ngrok.kill();
};
expo.on('exit', (code) => {
  stopNgrok();
  process.exit(code ?? 0);
});
process.on('SIGINT', stopNgrok);
process.on('SIGTERM', stopNgrok);
