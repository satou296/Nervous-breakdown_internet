export const GateRejection = Object.freeze({
  Total: 'total',             // サーバー全体の接続数が上限
  PerAddress: 'per_address'   // 同じ住所からの接続数が上限
});

/**
 * 同時に受け付ける接続の数を、サーバー全体と住所ごとに制限する。
 * 住所が null（読み取れない・インターネット上の住所でない）の接続は、全体の上限だけで数える。
 */
export class ConnectionGate {
  #total = 0;
  #perAddress = new Map();

  constructor({ maxConnections, maxPerAddress }) {
    this.maxConnections = maxConnections;
    this.maxPerAddress = maxPerAddress;
  }

  /** 監視用：いまの接続数・住所の数・住所が分からない接続の数 */
  stats() {
    let identified = 0;
    for (const n of this.#perAddress.values()) identified += n;
    return { clientAddresses: this.#perAddress.size, connectionsUnidentified: this.#total - identified };
  }

  /** @returns {string|null} 受け付けられないときはその理由（GateRejection）、受け付けたら null */
  admit(address) {
    if (this.#total >= this.maxConnections) return GateRejection.Total;
    const current = address === null ? 0 : (this.#perAddress.get(address) ?? 0);
    if (address !== null && current >= this.maxPerAddress) return GateRejection.PerAddress;
    this.#total += 1;
    if (address !== null) this.#perAddress.set(address, current + 1);
    return null;
  }

  release(address) {
    this.#total -= 1;
    if (address === null) return;
    const left = (this.#perAddress.get(address) ?? 1) - 1;
    if (left > 0) this.#perAddress.set(address, left);
    else this.#perAddress.delete(address);
  }
}
