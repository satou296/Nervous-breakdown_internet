/**
 * HTTP の入口。死活監視・オンライン対応の確認・招待URL・画面ファイルを振り分ける。
 *
 *   GET /health       … Render のヘルスチェック用（200 を返せば正常）
 *   GET /api/online   … 画面が「オンライン対戦できるサーバーか」を確かめる
 *   GET /room/XXXXX   … 招待URL。/?room=XXXXX へ転送する
 *                       （画面のファイルは相対パスで書かれているので、トップの階層で開く必要がある）
 *   それ以外          … index.html / css / src のファイル
 */
export class HttpRouter {
  constructor({ staticFiles, roomStats }) {
    this.staticFiles = staticFiles;
    this.roomStats = roomStats;
  }

  async handle(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return this.#send(res, 405, { error: 'method_not_allowed' });
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;

    if (p === '/health') return this.#send(res, 200, { status: 'ok', rooms: this.roomStats().rooms });
    if (p === '/api/online') return this.#send(res, 200, { online: true });
    const invite = p.match(/^\/room\/([A-Za-z0-9]{1,12})\/?$/);
    if (invite) return this.#redirect(res, `/?room=${encodeURIComponent(invite[1].toUpperCase())}`);
    if (await this.staticFiles.serve(req, res, p)) return;
    this.#send(res, 404, { error: 'not_found' });
  }

  #redirect(res, location) {
    res.writeHead(302, { Location: location, 'Cache-Control': 'no-store' });
    res.end();
  }

  #send(res, status, body) {
    const text = JSON.stringify(body);
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(text),
      'Cache-Control': 'no-store'
    });
    res.end(text);
  }
}
