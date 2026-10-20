import { ClientMessage, LIMITS } from '../../src/net/Protocol.js';
import { DIFFICULTIES } from '../../src/config/Difficulties.js';
import { DECK_OPTIONS, ARM } from '../../src/config/GameConfig.js';

export class ValidationError extends Error {}

const fail = (message) => { throw new ValidationError(message); };

function cleanName(value) {
  if (typeof value !== 'string') fail('名前がありません');
  // 制御文字を取り除き、前後の空白を詰める
  const name = value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, LIMITS.nameMaxLength);
  if (!name) fail('名前を入力してください');
  return name;
}

function finiteNumber(value, { min = -Infinity, max = Infinity } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail('数値が正しくありません');
  return Math.min(max, Math.max(min, value));
}

function vector3(value, maxLength) {
  if (!Array.isArray(value) || value.length !== 3) fail('ベクトルが正しくありません');
  const v = value.map(n => finiteNumber(n, { min: -maxLength, max: maxLength }));
  const length = Math.hypot(...v);
  return length > maxLength ? v.map(n => (n / length) * maxLength) : v;
}

function cardId(value) {
  if (!Number.isInteger(value) || value < 0 || value > 200) fail('カード番号が正しくありません');
  return value;
}

function roomCode(value) {
  if (typeof value !== 'string') fail('部屋番号がありません');
  const code = value.toUpperCase().trim();
  const pattern = new RegExp(`^[${LIMITS.roomCodeAlphabet}]{${LIMITS.roomCodeLength}}$`);
  if (!pattern.test(code)) fail('部屋番号が正しくありません');
  return code;
}

/** 種類ごとに、受け取ってよい形かを確かめて、安全な形に整える */
const RULES = {
  [ClientMessage.CreateRoom]: p => {
    // Object.hasOwn で調べる（"constructor" などのキーで Object.prototype のものを拾わない）
    if (typeof p.difficultyId !== 'string' || !Object.hasOwn(DIFFICULTIES, p.difficultyId)) fail('難易度が正しくありません');
    if (!Number.isInteger(p.deckSize) || !Object.hasOwn(DECK_OPTIONS, p.deckSize)) fail('枚数が正しくありません');
    return { name: cleanName(p.name), difficultyId: p.difficultyId, deckSize: Number(p.deckSize) };
  },
  [ClientMessage.JoinRoom]: p => ({
    code: roomCode(p.code),
    name: cleanName(p.name),
    token: typeof p.token === 'string' && p.token.length <= 64 ? p.token : null
  }),
  [ClientMessage.LeaveRoom]: () => ({}),
  [ClientMessage.StartMatch]: () => ({}),
  [ClientMessage.SelectCard]: p => ({ cardId: cardId(p.cardId) }),
  [ClientMessage.Presence]: p => ({
    dir: vector3(p.dir, 1),
    reach: finiteNumber(p.reach, { min: 0, max: ARM.maxReach })
  }),
  [ClientMessage.Knock]: p => ({
    cardId: cardId(p.cardId),
    impulse: vector3(p.impulse, ARM.maxImpulse * 1.5),
    spin: finiteNumber(p.spin, { min: 0, max: ARM.spinKick * 2 })
  }),
  [ClientMessage.Ping]: p => ({ t: finiteNumber(p.t) })
};

/**
 * @returns {object} 整えた中身
 * @throws {ValidationError} 知らない種類・形が正しくないとき
 */
export function validateClientMessage(type, payload) {
  const rule = typeof type === 'string' && Object.hasOwn(RULES, type) ? RULES[type] : null;
  if (!rule) fail(`知らないメッセージです: ${type}`);
  return rule(payload ?? {});
}
