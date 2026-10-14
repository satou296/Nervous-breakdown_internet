export const Counter = Object.freeze({
  Connections: 'connectionsTotal',
  RoomsCreated: 'roomsCreatedTotal',
  MatchesStarted: 'matchesStartedTotal',
  MatchesFinished: 'matchesFinishedTotal'
});

/**
 * 監視用の数値を集める。/api/stats がこの内容をそのまま返す。
 * 「累計」（起動してからの回数）はここで数え、「現在の値」（接続数・部屋数など）は
 * gauges 関数で、問い合わせのたびに持ち主から取り出す。
 * サーバーが再起動すると累計は 0 に戻る。
 */
export class ServerMetrics {
  #counters = Object.fromEntries(Object.values(Counter).map(name => [name, 0]));
  #startedAt;

  /**
   * @param {object} p
   * @param {() => object} p.gauges  現在の値（{ connections, rooms, … }）
   * @param {() => number} [p.errorCount]  記録したエラーの累計
   */
  constructor({ gauges, errorCount = () => 0, now = () => Date.now(), memoryRss = () => process.memoryUsage().rss }) {
    Object.assign(this, { gauges, errorCount, now, memoryRss });
    this.#startedAt = now();
  }

  count(counter) {
    this.#counters[counter] += 1;
  }

  snapshot() {
    return {
      status: 'ok',
      uptimeSec: Math.floor((this.now() - this.#startedAt) / 1000),
      ...this.gauges(),
      ...this.#counters,
      errorsTotal: this.errorCount(),
      memoryRssBytes: this.memoryRss()
    };
  }
}
