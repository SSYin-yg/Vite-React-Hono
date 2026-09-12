import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { cpSync, existsSync, readFileSync, statSync } from 'node:fs';

// 旧站设备图片目录（复用，URL 与旧站一致：/assets/images/equipment/...）
const legacyImagesRoot = path.resolve(
  fileURLToPath(new URL('../../../assets/images', import.meta.url))
);
const configDir = fileURLToPath(new URL('.', import.meta.url));

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
};

// 开发时由中间件按需服务，构建时整体拷入 dist/assets/images
function legacyImages(): Plugin {
  return {
    name: 'legacy-images',
    configureServer(server) {
      server.middlewares.use('/assets/images', (req, res, next) => {
        const rel = decodeURIComponent((req.url ?? '').split('?')[0]);
        const target = path.resolve(legacyImagesRoot, '.' + rel);
        // 边界校验：解析后的绝对路径必须仍位于图片根目录内
        if (!target.startsWith(legacyImagesRoot + path.sep)) return next();
        if (!existsSync(target) || !statSync(target).isFile()) return next();
        res.setHeader(
          'Content-Type',
          MIME[path.extname(target).toLowerCase()] ?? 'application/octet-stream'
        );
        res.end(readFileSync(target));
      });
    },
    closeBundle() {
      cpSync(legacyImagesRoot, path.resolve(configDir, 'dist/assets/images'), {
        recursive: true,
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), legacyImages()],
  // 本地开发：API 转发给 wrangler dev（D1/R2 本地模拟）
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8787',
    },
  },
});
