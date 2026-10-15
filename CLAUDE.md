# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 概要

浮遊トランプ神経衰弱（three.js r149 の 3D 神経衰弱＋オンライン対戦サーバー）。
リポジトリ直下がそのままアプリ本体（`package.json`・`Dockerfile`・`render.yaml`・`.github/workflows/` はすべて直下）。GitHub Actions と Render の Blueprint は直下に無いと検出されないので、フォルダを一段はさむ配置にしない。

名称は `Nervous-breakdown_internet` に統一している。小文字しか使えない所（`package.json` の name、Docker イメージ名）は `nervous-breakdown_internet`、アンダースコアが URL に使えない Render のサービス名だけ `nervous-breakdown-internet`。

## コマンド

リポジトリ直下で実行。Node.js 20 以上。依存は `ws` のみ（開発用に E2E の `@playwright/test`）で、ビルド・lint・型チェックの工程は無い（ブラウザは `src/` の ES モジュールをそのまま読む）。

```bash
npm install
npm start                      # サーバー起動 → http://localhost:8080（画面の配信＋/ws）
npm run dev                    # node --watch で起動（サーバー側の変更で自動再起動）
npm test                       # node --test tests/*.mjs（ブラウザ不要）
node --test tests/domain.test.mjs                       # 1ファイルだけ
node --test --test-name-pattern="ペア" tests/*.mjs       # テスト名で絞る
npx playwright install chromium   # 初回だけ（E2E 用のブラウザ）
npm run test:e2e               # 実際のブラウザでゲームを動かす確認（サーバーも自動で起動。e2e/）
docker compose up --build      # 本番（Render）と同じコンテナ
python3 -m http.server 8000    # 画面だけ（オンライン対戦なしの静的配信）
```

サーバーの環境変数は `server/config/ServerConfig.js`（`PORT` / `ALLOWED_ORIGINS` / `TURN_TIMEOUT_SEC` / `MAX_ROOMS`、監視用に `LOG_LEVEL` / `STATS_TOKEN` / `LOKI_URL` / `LOKI_USER` / `LOKI_TOKEN`）。本番公開の手順は `docs/DEPLOY_RENDER.md`、監視の手順は `docs/MONITORING.md` と `docs/MONITORING_DOCKER.md`。

## アーキテクチャ

### 層と依存の向き

```
src/main.js（コンポジションルート）
  └─ app/ ─┬─→ domain/  ルール（three.js にも DOM にも依存しない）
           ├─→ ai/      CPU の思考（domain だけに依存）
           ├─→ render/  3D（three.js に依存）
           ├─→ physics/ 腕とカードの当たり判定（three.js 非依存）
           ├─→ input/ , ui/
           └─→ online/  WebSocket・待合室・オンラインの1試合
server/index.js（サーバー側のコンポジションルート）
  └─ src/domain, src/net/Protocol.js, src/config/GameConfig.js, src/core をそのまま import
```

守るべき前提：

- **`src/domain`・`src/ai`・`src/core`・`src/physics`・`src/net`・`src/config` は Node.js でもそのまま動かす**。サーバーとテストが直接 import するので、ここに `window`・DOM・three.js への依存を入れない。
- **依存性の注入**：各クラスは依存先を自分で `new` せず、`main.js`（サーバーは `server/index.js` の `createGameServer`）で組み立てて渡す。新しい部品を足したらここに配線する。
- **three.js は CDN の `<script>`（グローバル）で読み込み**、`src/lib/three.js` だけが `window.THREE` に触れる。他のモジュールは必ずそこから import する。
- **調整値と文言は `src/config/GameConfig.js` と `src/config/strings.js` に集約**（マジックナンバー・直書き文字列を置かない）。難易度は `Difficulties.js`、遊び方は `domain/GameModes.js` に宣言的に定義し、メニューの選択肢は `index.html` 側にも足す。
- 差し替え可能な振る舞いは Strategy＋Factory の `register()` で拡張する（`DriftFactory`・`AnchorTravelFactory`・`PileFactory`・`CardSelectionFactory`、`MatchRule`、`CpuStrategy`）。

### ルールと演出の分離

`ConcentrationGame` は状態遷移してイベントを発行するだけ。判定（`resolve()`）と確定（`endResolution()`）が分かれており、その間に演出（`CardChoreographer`）が入る。`GamePresenter`（`src/app/session/`）が「見せ方」を一手に持ち、ルールが手元にある `LocalGameSession` と、ルールがサーバーにある `OnlineGameSession` の両方から使われる。見た目の変更は `GamePresenter`／`CardChoreographer`、進行の変更は各 Session に入れる。

### 2つの時間軸（ポーズ）

`main.js` のフレームループは二重になっている。カード・進行・判定待ち・CPU・腕の物理は `PausableTimeline`（ゲーム内時計 `PausableClock`）の中で動き、ポーズで止まる。視点・手・描画は外側の `GameLoop` に直接登録され、ポーズ中も動く。遅延処理は `setTimeout` ではなくゲーム内時計の `Scheduler` を使うこと。登録順が更新順。

### オンライン対戦

- 通信の約束事は `src/net/Protocol.js` が唯一の定義（`{ t, d }` の JSON）。メッセージを足す／変えるときは、`Protocol.js`・`server/net/MessageValidator.js`（受信の検証）・`server/net/MessageDispatcher.js`・画面側の `OnlineGameSession`／`OnlineLobby` をそろえて直す。
- **判定はサーバーだけ**（`server/match/OnlineMatch.js` が `ConcentrationGame` を保持）。裏向きカードの中身は画面へ送らず、めくられた瞬間に `card_revealed` でその1枚だけ送る。カード id はシャッフル後に振るので id から中身は推測できない。この秘匿を崩す変更をしない（再接続用の snapshot も表のカードだけ）。
- **動きの同期**：サーバーが配る `seed` から `core/random.js`（`createRandom`／`deriveSeed`）でカードごとの乱数を作り、`ServerClock` で合わせた時刻で動かす。カードの動きに `Math.random()` や端末の時刻を混ぜると画面間でずれる。腕で弾いた出来事だけは `knock` で全員に伝える。
- 達人・極の「手のひらが触れているか」は各自の画面で判定（サーバーは手番とカードの状態だけ確認）。
- 部屋はサーバーのメモリ上のみ。1台構成が前提で、再起動で進行中の部屋は消える。
- 静的配信は `StaticFileServer` の `publicEntries`（`index.html`・`css`・`src`）に限定。配信対象を増やすときは `Dockerfile` の `COPY` も合わせる。
- 画面は `/api/online` を叩いてサーバー配信かどうかを判定し（`OnlineAvailability.js`）、GitHub Pages などの静的配信ではオンラインの選択肢を隠す。静的配信でも動く状態を保つこと。

### 監視

`server/monitoring/` が記録と数値を持ち、配線は `server/index.js` だけで行う（`Room`・`OnlineMatch` は監視を知らない。`RoomManager` の `onRoomOpened`／`onRoomClosed` と `MatchEvent.Finished` に掛ける）。記録は `Logger` 経由で「1行＝1つの JSON」（`console.log` を直接使わない）、`LOKI_URL` があれば `LokiSink` がまとめて送る。数値は `GET /api/stats`（`ServerMetrics.snapshot()`）で、非公開（`Authorization: Bearer $STATS_TOKEN` が必要。`STATS_TOKEN` 未設定なら 404 で閉じる。手元で見るときは `STATS_TOKEN=x npm start`）。**プレイヤーの名前・部屋番号・token は記録にも数値にも出さない**。`/health` の形は Render と外形監視が使っているので変えない。

`monitoring/` は、自分のパソコンで動かす監視用の Docker 一式（Zabbix 7.0＋Grafana。Loki は Grafana Cloud）で、ゲーム本体のイメージには入らない。`/api/stats` の項目や記録の `event` を足す／変えるときは、`monitoring/zabbix/template_nervous_breakdown_internet.yaml`（項目とトリガー）、`monitoring/grafana/dashboards/overview.json`（項目名とホスト名 `nervous-breakdown-internet` で探す）、`docs/MONITORING.md` の表をそろえて直す。合言葉は `monitoring/.env`（git 管理外）にだけ置く。

### チュートリアル

URL を開くと、毎回まずチュートリアル（`GAME_MODES.tutorial`：決まった6枚を1人でめくる本物のゲーム）が始まる。`TutorialGuide`（`src/app/tutorial/`、DOM 非依存）がルールのイベントから説明の段階を決め、`TutorialScreen` が表示する。スキップ／完了で、URL を開いたときに本来出す画面（招待URLなら参加画面、それ以外はスタート画面）へ進む。

### カードと手の見た目

- カードは本物と同じく、おもて面（+Z）に数字、うら面（-Z）に模様。浮遊中は `FloatBehavior` がうら面をプレイヤー（`viewer`）へ向けたまま面内で回し、傾きを `MOTION.float.maxTilt`（π/2 未満）に抑えて、おもて面を見せない。浮遊中に裏返る動きを入れない。
- 手は素手。腕は `BareArm` が画面の外の肩から前腕までつなぎ、どこまでも続いて見えるようにしている。

### テスト

**main へのマージは、`npm test` と `npm run test:e2e` が両方通ってから**（GitHub Actions の `unit`・`e2e` ジョブ）。E2E（`e2e/game.spec.mjs`）はヘッドレス Chromium で、チュートリアルを最後まで進める・スキップ・ゲーム開始・達人の腕・招待URL を確かめる。

`node:test` で、時間は偽のスケジューラ／時計を注入して進める（`tests/online.test.mjs` の `FakeScheduler`）。`server/index.js` は直接実行時だけ listen し、テストは `createGameServer()` で実サーバーを立てて WebSocket 2接続で通す。時刻や乱数に依存するクラスは `now`・`random`・`scheduler` を引数で受け取る形にそろえる。

## 書き方の慣習

- コメント・テスト名・UI 文言・コミット対象のドキュメントは日本語。
- プレーンな ES モジュール（`"type": "module"`、TypeScript・バンドラなし）。クラスは `#private` フィールド、定数は `Object.freeze` した列挙（`GameEvent`・`ServerMessage` など）、部品間の通知は `core/EventEmitter`。
