/** 部屋の操作ができないとき（部屋がない・満員など）に投げる。code は Protocol の ErrorCode */
export class RoomError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
