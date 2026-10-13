/**
 * 画面に出す文言。表示ロジックから文言を切り離しておく。
 */
export const TEXT = Object.freeze({
  you: 'あなた',
  cpu: 'CPU',
  player: n => `プレイヤー${n}`,
  pickPrompt: 'めくるカードを選んでください',
  turnOf: name => `${name}の番`,
  remaining: n => `残り ${n} ペア`,
  turnsSuffix: n => ` ・ ${n} 手`,
  pairUnit: 'ペア',
  clock: 'タイム',
  pair: 'ペア！',
  pairBy: name => `${name}：ペア！`,
  miss: 'ざんねん',
  startFailed: msg => `開始できませんでした：${msg}`,
  help: {
    point: 'カードをクリック（タップ）でめくる ・ ドラッグか矢印キーで見回す ・ Esc で一時停止',
    reach: 'カーソルで狙い W 長押しで腕を伸ばす ・ S で縮める ・ 手のひらがカードに触れたら左クリックでめくる ・ Esc で一時停止'
  },
  lobby: {
    createTitle: 'オンライン対戦の部屋を作る',
    joinTitle: code => `部屋 ${code} に参加する`,
    createAction: '部屋を作る',
    joinAction: '参加する',
    nameRequired: '名前を入力してください',
    connectFailed: 'サーバーにつながりませんでした。少し待ってからもう一度お試しください',
    settings: (difficulty, deckSize) => `難易度：${difficulty} ・ ${deckSize}枚`,
    hostTag: 'ホスト',
    youTag: 'あなた',
    offlineTag: '接続待ち',
    needMore: n => `あと${n}人以上そろうと開始できます。招待URLを送ってください`,
    readyToStart: 'そろったら「対戦を始める」を押してください',
    waitForHost: '部屋を作った人が開始するまでお待ちください',
    copy: 'コピー',
    copied: 'コピーしました',
    selectToCopy: '選択しました。手動でコピーしてください'
  },
  online: {
    youSuffix: name => `${name}（あなた）`,
    turnPassed: '時間切れ・次の人へ',
    playerLost: name => `${name} の接続が切れました`,
    playerBack: name => `${name} が戻りました`,
    connectionLost: '接続が切れました。再接続しています…',
    connectionRestored: '再接続しました',
    connectionGaveUp: 'サーバーにつながらないため、部屋を出ました',
    pauseNote: 'オンライン対戦中は時間は止まりません',
    unavailable: 'サーバー版でのみ'
  },
  result: {
    clearedEyebrow: 'Cleared',
    gameOverEyebrow: 'Game Over',
    cleared: 'クリア！',
    draw: '引き分け',
    winnerIs: name => `${name}の勝ち！`,
    turns: '手数',
    time: 'タイム',
    misses: 'ミス',
    difficulty: '難易度',
    turnsValue: n => `${n} 手`,
    missesValue: n => `${n} 回`,
    pairsValue: n => `${n} ペア`
  }
});
