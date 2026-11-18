/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { iwsdkDev } from '@iwsdk/vite-plugin-dev';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/**
 * Dev server only: Director mode posts its finished recording (and the audio
 * timeline) here, saved into artifacts/ (git-ignored). Plain file names only,
 * 2 GB cap; does not exist in production builds.
 */
function directorSave(): Plugin {
  return {
    name: 'dreamlive-director-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__director-save', (req, res) => {
        const name = new URL(req.url ?? '', 'http://x').searchParams.get('name') ?? '';
        if (req.method !== 'POST' || !/^[a-z0-9][a-z0-9.-]{0,60}$/.test(name)) {
          res.statusCode = 400;
          res.end('bad request');
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        req.on('data', (c: Buffer) => {
          size += c.length;
          if (size > 2_000_000_000) req.destroy();
          else chunks.push(c);
        });
        req.on('end', () => {
          // Numbered frames of an offline render go in their own folder.
          const dir = resolve(process.cwd(), 'artifacts', name.startsWith('frame-') ? 'frames' : '');
          mkdirSync(dir, { recursive: true });
          writeFileSync(resolve(dir, name), Buffer.concat(chunks));
          res.end('saved ' + name);
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [iwsdkDev(), directorSave()],
  // (artifacts/ holds thousands of rendered frames: never watch it, or every saved frame wakes the dev server.)
  server: { host: '0.0.0.0', port: 8081, open: false, watch: { ignored: ['**/artifacts/**', '**/dist/**'] } },
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV !== 'production',
    target: 'esnext',
    rollupOptions: { input: './index.html' },
  },
  esbuild: { target: 'esnext' },
  // @drawcall/uikitml otherwise pulls a second three/@pmndrs/uikit graph
  // (three@0.185 vs app super-three@0.181). Duplicate Component classes break
  // instanceof checks → "Only pmndrs/uikit components can be added as children".
  resolve: {
    dedupe: [
      'three',
      '@pmndrs/uikit',
      '@pmndrs/uikit-horizon',
      '@pmndrs/uikit-lucide',
    ],
  },
  optimizeDeps: {
    exclude: ['@babylonjs/havok'],
    include: [
      'three',
      '@pmndrs/uikit',
      '@pmndrs/uikit-horizon',
      '@pmndrs/uikit-lucide',
      '@drawcall/uikitml',
    ],
    esbuildOptions: { target: 'esnext' },
  },
  publicDir: 'public',
  base: './',
});
