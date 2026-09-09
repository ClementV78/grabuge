import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === 'seatbelt';

const fullCloudflare = process.env.GRABUGE_FULL === '1';
const localBindingConfig = {
  ...(fullCloudflare
    ? {
        name: 'grabuge-pirates',
        durable_objects: {
          bindings: [
            { name: 'ROOMS', class_name: 'GameRoom' },
            { name: 'REGISTRY', class_name: 'RoomRegistry' },
          ],
        },
        migrations: [
          { tag: 'v1', new_sqlite_classes: ['GameRoom'] },
          { tag: 'v2', new_sqlite_classes: ['RoomRegistry'] },
        ],
        vars: { MAX_PLAYERS: '4' },
      }
    : {}),
  main: fullCloudflare ? 'server/full.ts' : 'vinext/server/fetch-handler',
  compatibility_flags: ['nodejs_compat'],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import('@cloudflare/vite-plugin');

  return {
    css: { postcss: { plugins: [tailwindcss()] } },
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : {
          proxy: {
            '/api/rooms': { target: 'http://127.0.0.1:8788', ws: true },
          },
        },
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        config: localBindingConfig,
      }),
    ],
  };
});
