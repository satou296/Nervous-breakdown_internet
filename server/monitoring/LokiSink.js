/**
 * 記録を Loki（Grafana Cloud など）へ送る。
 * 1行ごとに送ると通信が増えるので、ためておいて一定間隔でまとめて送る。
 * 送れなかった分は捨てる（監視の不調でゲームを止めないため）。たまりすぎたら古い順に捨てる。
 */
export class LokiSink {
  #buffer = [];
  #timer;
  #sending = Promise.resolve();
  #failing = false;

  /**
   * @param {object} p
   * @param {string} p.url        送り先（…/loki/api/v1/push）
   * @param {string} [p.user]     利用者番号（Grafana Cloud の User）
   * @param {string} [p.token]    合言葉（Grafana Cloud の API トークン）
   * @param {object} p.labels     すべての行に付ける目印（{ app: '…' }）
   */
  constructor({
    url, user = '', token = '', labels, flushIntervalMs = 5000, maxBuffered = 1000, timeoutMs = 5000,
    fetchImpl = globalThis.fetch, onError = err => console.error('[loki]', err.message)
  }) {
    Object.assign(this, { url, user, token, labels, maxBuffered, timeoutMs, fetchImpl, onError });
    this.#timer = setInterval(() => this.flush(), flushIntervalMs);
    this.#timer.unref?.();
  }

  write(entry, line) {
    this.#buffer.push({ level: entry.level, timeNs: `${Date.parse(entry.ts)}000000`, line });
    if (this.#buffer.length > this.maxBuffered) this.#buffer.shift();
  }

  /** たまっている分を送る。前の送信が終わってから次を送る（順番を保つ） */
  flush() {
    if (this.#buffer.length === 0) return this.#sending;
    const batch = this.#buffer;
    this.#buffer = [];
    this.#sending = this.#sending.then(() => this.#push(batch));
    return this.#sending;
  }

  async close() {
    clearInterval(this.#timer);
    await this.flush();
  }

  async #push(batch) {
    try {
      const res = await this.fetchImpl(this.url, {
        method: 'POST',
        headers: this.#headers(),
        body: JSON.stringify({ streams: this.#toStreams(batch) }),
        signal: AbortSignal.timeout(this.timeoutMs)
      });
      if (!res.ok) throw new Error(`Loki が ${res.status} を返しました`);
      this.#failing = false;
    } catch (err) {
      // 失敗が続く間は、最初の1回だけ知らせる
      if (!this.#failing) this.onError(err);
      this.#failing = true;
    }
  }

  #headers() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.user || this.token) {
      headers.Authorization = `Basic ${Buffer.from(`${this.user}:${this.token}`).toString('base64')}`;
    }
    return headers;
  }

  /** Loki は「目印の組み合わせ」ごとに行をまとめて受け取る。重さ（level）で分ける */
  #toStreams(batch) {
    const byLevel = new Map();
    for (const { level, timeNs, line } of batch) {
      if (!byLevel.has(level)) byLevel.set(level, []);
      byLevel.get(level).push([timeNs, line]);
    }
    return [...byLevel].map(([level, values]) => ({ stream: { ...this.labels, level }, values }));
  }
}
