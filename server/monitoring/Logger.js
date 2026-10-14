const LEVELS = Object.freeze({ debug: 10, info: 20, warn: 30, error: 40, silent: 100 });

/**
 * 出来事を「1行＝1つの JSON」で記録する。
 *   {"ts":"2026-10-14T00:00:00.000Z","level":"info","event":"room_created","rooms":1}
 * 行き先（sink）は差し替えられる。標準出力（Render の Logs 画面）と、設定があれば Loki へ送る。
 * プレイヤーの名前など、個人が書いた内容は記録しない。
 */
export class Logger {
  #sinks;
  #threshold;
  #errorCount = 0;

  /**
   * @param {object} p
   * @param {{ write(entry: object, line: string): void, close?(): Promise<void> }[]} p.sinks
   * @param {string} [p.level]  これより軽い記録は捨てる（debug / info / warn / error / silent）
   */
  constructor({ sinks, level = 'info', now = () => new Date() }) {
    this.#sinks = sinks;
    this.#threshold = LEVELS[level] ?? LEVELS.info;
    this.now = now;
  }

  /** 記録したエラーの累計（監視の数値として使う） */
  get errorCount() { return this.#errorCount; }

  debug(event, fields) { this.#log('debug', event, fields); }
  info(event, fields) { this.#log('info', event, fields); }
  warn(event, fields) { this.#log('warn', event, fields); }

  /** @param {Error | object} [detail] Error を渡すと、内容と発生場所を記録する */
  error(event, detail) {
    this.#errorCount += 1;
    const fields = detail instanceof Error ? { message: detail.message, stack: detail.stack } : detail;
    this.#log('error', event, fields);
  }

  /** たまっている記録を送りきる（サーバーを止めるときに呼ぶ） */
  async close() {
    await Promise.all(this.#sinks.map(sink => sink.close?.()));
  }

  #log(level, event, fields = {}) {
    if (LEVELS[level] < this.#threshold) return;
    const entry = { ts: this.now().toISOString(), level, event, ...fields };
    const line = JSON.stringify(entry);
    for (const sink of this.#sinks) sink.write(entry, line);
  }
}

/** 標準出力へ書く（Render の Logs 画面に出る） */
export class ConsoleSink {
  constructor(out = console) {
    this.out = out;
  }

  write(entry, line) {
    if (entry.level === 'error') this.out.error(line);
    else this.out.log(line);
  }
}
