import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';

const MIME = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
});

/**
 * ゲーム画面のファイル（index.html・css・src）を配信する。
 * 公開してよいフォルダを明示し、それ以外（server フォルダや隠しファイル）は返さない。
 */
export class StaticFileServer {
  constructor({ root, publicEntries, indexFile = 'index.html' }) {
    this.root = root;
    this.publicEntries = new Set(publicEntries);
    this.indexFile = indexFile;
  }

  /** @returns {Promise<boolean>} 返せたら true */
  async serve(req, res, urlPath) {
    const file = this.#resolve(urlPath);
    if (!file) return false;
    let info;
    try {
      info = await stat(file);
    } catch {
      return false;
    }
    if (!info.isFile()) return false;
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Content-Length': info.size,
      // 画面のファイルは更新が反映されやすいよう、毎回確認させる
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff'
    });
    if (req.method === 'HEAD') {
      res.end();
      return true;
    }
    createReadStream(file).pipe(res);
    return true;
  }

  #resolve(urlPath) {
    let decoded;
    try {
      decoded = decodeURIComponent(urlPath);
    } catch {
      return null;
    }
    const relative = path.posix.normalize(decoded === '/' ? `/${this.indexFile}` : decoded).replace(/^\/+/, '');
    const segments = relative.split('/');
    if (segments.some(s => s === '..' || s.startsWith('.'))) return null;
    if (!this.publicEntries.has(segments[0])) return null;
    const full = path.resolve(this.root, relative);
    if (!full.startsWith(this.root + path.sep)) return null;
    return full;
  }
}
