/**
 * オンライン対戦の通信の約束事（サーバーと画面の両方が使う）。
 * メッセージは JSON で { t: 種類, d: 中身 } の形。
 *
 * 秘密にすべき情報（裏向きカードの数字とマーク）は、めくられた瞬間に card_revealed で
 * そのカードの分だけ送る。山札そのものはカード番号（id）しか送らない。
 */

/** 画面 → サーバー */
export const ClientMessage = Object.freeze({
  CreateRoom: 'create_room',   // { name, difficultyId, deckSize }
  JoinRoom: 'join_room',       // { code, name, token? }（token があれば切断前の席に戻る）
  LeaveRoom: 'leave_room',     // {}
  StartMatch: 'start_match',   // {}（部屋を作った人だけ）
  SelectCard: 'select_card',   // { cardId }
  Presence: 'presence',        // { dir: [x,y,z], reach }（自分の狙いと腕の伸び）
  Knock: 'knock',              // { cardId, impulse: [x,y,z], spin }（腕でカードを弾いた）
  Ping: 'ping'                 // { t }（時計合わせ）
});

/** サーバー → 画面 */
export const ServerMessage = Object.freeze({
  RoomJoined: 'room_joined',             // { code, you: { index, token }, room }
  RoomUpdated: 'room_updated',           // { room }
  MatchStarted: 'match_started',         // { seed, deck, players, youIndex, difficultyId, deckSize, epoch, serverNow, state, snapshot }
  CardRevealed: 'card_revealed',         // { cardId, rank, suit, slot, playerIndex }
  PairResolved: 'pair_resolved',         // { matched, playerIndex, cardIds }
  PairSettled: 'pair_settled',           // { matched, playerIndex, cardIds, state }
  SelectionCancelled: 'selection_cancelled', // { cardIds }
  TurnStarted: 'turn_started',           // { playerIndex, continued, passed, state, turnEndsAt }
  MatchOver: 'match_over',               // { summary }
  PlayerStatus: 'player_status',         // { index, name, connected }
  Presence: 'presence',                  // { playerIndex, dir, reach }
  Knock: 'knock',                        // { playerIndex, cardId, impulse, spin }
  Pong: 'pong',                          // { t, serverNow }
  Error: 'error'                         // { code, message }
});

export const ErrorCode = Object.freeze({
  InvalidMessage: 'invalid_message',
  RateLimited: 'rate_limited',
  RoomNotFound: 'room_not_found',
  RoomFull: 'room_full',
  MatchInProgress: 'match_in_progress',
  NotInRoom: 'not_in_room',
  NotHost: 'not_host',
  NotEnoughPlayers: 'not_enough_players',
  NotYourTurn: 'not_your_turn',
  ServerBusy: 'server_busy'
});

export const LIMITS = Object.freeze({
  minPlayers: 2,
  maxPlayers: 4,
  nameMaxLength: 16,
  roomCodeLength: 5,
  /** 部屋番号に使う文字（見間違えやすい 0/O・1/I/L は使わない） */
  roomCodeAlphabet: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789',
  maxMessageBytes: 4096
});

/** 接続先のパス（同じサーバーの /ws に WebSocket でつなぐ） */
export const SOCKET_PATH = '/ws';

export function encode(type, payload = {}) {
  return JSON.stringify({ t: type, d: payload });
}

/** 壊れたメッセージは null を返す（例外は投げない） */
export function decode(text) {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed.t !== 'string' || typeof parsed.d !== 'object' || parsed.d === null) return null;
    return { type: parsed.t, payload: parsed.d };
  } catch {
    return null;
  }
}
