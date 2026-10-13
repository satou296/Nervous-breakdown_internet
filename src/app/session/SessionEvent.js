/**
 * ゲームセッション（1人で遊ぶ版・オンライン版）が App に知らせるイベント。
 *
 * GameSession インターフェース（App から見た約束事）：
 *   mode, difficulty
 *   usesReach / usesHover / holdsTouchedCard / freezesTime : boolean
 *   start(), dispose(), update(dt, elapsed)
 *   canHumanAct(): boolean
 *   allowsReach(): boolean        … いま腕を伸ばしてよいか
 *   handleTap(ndc)
 *   reportKnock(view, impulse, spin) … 腕でカードを弾いた（オンラインでは全員に伝える）
 *   on(SessionEvent.*, handler)
 */
export const SessionEvent = Object.freeze({
  Finished: 'finished',  // payload: ゲーム結果（summary）
  Aborted: 'aborted'     // payload: { message } 続けられなくなった（接続が切れた等）
});
