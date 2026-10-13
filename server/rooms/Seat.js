import { randomUUID } from 'node:crypto';

/**
 * 部屋の席（1人分）。名前・接続・再接続用の合言葉（token）を持つ。
 * token を知っている人だけが、切断後に同じ席へ戻れる。
 */
export class Seat {
  constructor({ index, name, connection }) {
    this.index = index;
    this.name = name;
    this.connection = connection;
    this.token = randomUUID();
  }

  get connected() { return this.connection !== null && this.connection.isOpen; }

  attach(connection) {
    this.connection = connection;
  }

  detach() {
    this.connection = null;
  }

  send(type, payload) {
    this.connection?.send(type, payload);
  }

  toPublic() {
    return { index: this.index, name: this.name, connected: this.connected };
  }
}
