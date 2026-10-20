# 浮遊トランプ神経衰弱（オブジェクト指向版）

宙をくるくる舞うトランプを、一人称視点で指さしてめくる 3D 神経衰弱です（three.js r149）。

## 動かし方

### オンライン対戦サーバーとして動かす（おすすめ）

Node.js 20 以上が必要です。サーバーがゲーム画面の配信と対戦の両方を受け持ちます。

```bash
cd Nervous-breakdown_internet
npm install
npm start          # → http://localhost:8080
```

Docker の場合（本番の Render と同じコンテナ）：

```bash
docker compose up --build    # → http://localhost:8080
```

2つのブラウザ（片方はシークレットウィンドウ）で開き、片方で「オンライン」→「部屋を作る」、
表示された招待URLをもう片方で開くと対戦できます。

### 画面だけを動かす（1人・CPU・2人交代のみ）

GitHub Pages など、ファイルを置くだけの場所でも動きます。その場合オンライン対戦は選べません。

```bash
python3 -m http.server 8000      # → http://localhost:8000
```

初めて開いたときは、まずチュートリアル（6枚で神経衰弱の流れを体験）が始まります。「スキップ」でいつもの最初の画面へ進めます。2回目以降と招待URLではチュートリアルを飛ばし、スタート画面の「遊び方を見る」からいつでも見直せます。

### テスト

```bash
npm test                         # ルール・物理・サーバー（実際に起動して2人で通信）まで、ブラウザ不要
npx playwright install chromium  # 初回だけ
npm run test:e2e                 # 実際のブラウザでゲームを動かして確認（チュートリアル・スキップ・ゲーム開始など）
```

main へのマージは、GitHub Actions の `unit` と `e2e` の両方が通ってから行います。

本番への公開手順は [docs/DEPLOY_RENDER.md](docs/DEPLOY_RENDER.md)、本番の監視（Zabbix・Loki・Grafana）は [docs/MONITORING.md](docs/MONITORING.md)、監視を自分のパソコンの Docker で動かす手順は [docs/MONITORING_DOCKER.md](docs/MONITORING_DOCKER.md) を見てください。

## 層構成と依存の向き

```
main.js（組み立てのみ）
  └─ app/ ─────────┬─→ domain/   ルール（three.js にも DOM にも依存しない）
                   ├─→ ai/       CPU の思考（domain だけに依存）
                   ├─→ render/   3D の見た目（three.js に依存）
                   ├─→ input/    マウス・キーボード
                   └─→ ui/       HTML の画面
```

依存は常に上から下へ。`domain/` と `ai/` は描画を一切知らないので、Node.js だけでテストでき、
**オンライン対戦のサーバーでも同じコードをそのまま使っています**。

## オンライン対戦の仕組み

```
ブラウザ（画面）                                   サーバー（server/）
 OnlineLobby ── 部屋を作る／参加する ──┐        ┌─ RoomManager … 部屋の一覧（招待URLの番号）
 OnlineGameSession ─ カードを選ぶ・狙い ┼─ WebSocket ─┼─ Room ……… 席・ホスト・中継
   └ GamePresenter（1人用と共通の見せ方） │  /ws    └─ OnlineMatch … 判定（src/domain をそのまま利用）
 NetworkClient / ServerClock ───────────┘
```

- **判定はサーバーだけ**：裏向きのカードの中身はサーバーしか知らず、めくられた瞬間にその1枚分だけ送ります。山札の番号はシャッフル後に振るので、番号から中身は分かりません。
- **カードの動きをそろえる**：全員に同じ「乱数の種」を配り、カードごとに独立した乱数で動かします。時計もサーバーの時刻にそろえるので、全員の画面で同じ動きになります。腕で弾いたときは、その出来事を全員に伝えます。
- **自分の手番だけ操作できる**：カードを選ぶ・腕を伸ばす・弾くは、手番の人だけ。他の人の狙いは線と名札で表示します。
- **時間切れ・切断**：持ち時間（既定45秒）を過ぎるか、手番の人が切断して8秒たつと次の人へ。切断した人は合言葉（token）で同じ席に戻れます。
- **安全対策**：受け取るメッセージはすべて形と値を検証（`MessageValidator`）、1接続あたりの回数制限（`RateLimiter`）、他サイトからの接続を拒否（`OriginPolicy`）、公開するファイルを限定（`StaticFileServer`）。
- **制限**：部屋の情報はサーバーのメモリにあるので、サーバーは1台で動かします。サーバーが再起動すると、進行中の部屋はなくなります。達人・極の「手のひらが触れているか」は各自の画面で判定しています（サーバーは手番とカードの状態を確認）。

| フォルダ | 主なクラス | 責務 |
|---|---|---|
| `src/net/` | `Protocol` | 画面とサーバーで共通の、メッセージの種類と形 |
| `src/online/` | `NetworkClient`, `ServerClock` | WebSocket 接続と、サーバーの時計の推定 |
| | `OnlineLobby`, `RoomLink`, `PlayerIdentity` | 部屋の出入りと自動再接続、招待URL、名前と合言葉の保存 |
| | `OnlineGameSession`, `RemoteCard`, `PresenceBroadcaster` | オンラインの1試合、中身を後から知るカード、自分の狙いの送信 |
| `src/app/session/` | `LocalGameSession`, `GamePresenter` | 1台で遊ぶ版の進行と、両方で共通の見せ方 |
| `src/render/player/` | `RemotePlayers` | 他の人の狙い（線と名札） |
| `src/ui/` | `LobbyScreen` | 名前入力・待合室の画面 |
| `server/` | `index.js` | サーバーの組み立て（HTTP と WebSocket） |
| `server/http/` | `HttpRouter`, `StaticFileServer` | /health・/api/stats・招待URLの転送・画面ファイルの配信 |
| `server/monitoring/` | `Logger`, `ConsoleSink`, `LokiSink`, `ServerMetrics` | 記録（1行＝1つの JSON。標準出力と Loki へ）と、監視用の数値 |
| `server/net/` | `ClientConnection`, `MessageDispatcher`, `MessageValidator`, `RateLimiter`, `OriginPolicy` | 接続・振り分け・検証・回数制限・接続元の確認 |
| `server/rooms/` | `RoomManager`, `Room`, `Seat`, `RoomCodeGenerator` | 部屋の一覧・部屋・席・部屋番号 |
| `server/match/` | `OnlineMatch`, `TimerScheduler` | 1試合の判定と時間進行（持ち時間・切断時の自動パス） |

| フォルダ | 主なクラス | 責務 |
|---|---|---|
| `config/` | `GameConfig`, `strings` | 調整値と文言の置き場（マジックナンバー・文字列を排除） |
| `config/` | `Difficulties` | 難易度（漂い方・回転の速さ）の宣言的な定義 |
| `core/` | `EventEmitter`, `GameLoop` | 汎用の仕組み（通知・フレームループ） |
| | `PausableClock`, `PausableTimeline`, `Scheduler` | 一時停止できるゲーム内時計と、それで動く更新・遅延処理 |
| `domain/` | `ConcentrationGame` | 神経衰弱のルールと状態遷移。イベントを発行するだけ |
| | `Card`, `Player`, `TurnOrder`, `GameStats` | カードの状態、得点、手番、手数と時間 |
| | `DeckFactory`, `FisherYatesShuffler` | 山札の生成とシャッフル（乱数は注入可能） |
| | `SameRankRule` | ペア判定（Strategy。差し替え可能） |
| | `GameModes` | 遊び方の宣言的な定義 |
| `ai/` | `CpuMemory`, `MemoryCpuStrategy`, `CpuTurnRunner` | 記憶・選択・時間進行を分離 |
| `render/environment/` | `Room`, `CasinoTable`, `Lighting`, `DustParticles` | 部屋の各要素 |
| `render/textures/` | `SuitPainter`, `CardFacePainter`, `CardBackPainter`, `CardTextureLibrary` | カードの絵柄を描く／キャッシュする |
| `render/cards/` | `CardView` | 1枚の見た目。両面表／両面裏の切り替え |
| | `FloatBehavior`, `SequenceBehavior` | 動き方（State パターン）。浮遊と、手順の連続再生 |
| | `PoseTween`, `Wait` | 手順の部品（目標姿勢への移動・待機） |
| | `CalmDrift`, `RoamingDrift`, `DriftFactory` | 漂い方（Strategy）。むずかしいは範囲内を動き回る |
| | `StationaryAnchor`, `RandomWaypointTravel`, `AnchorTravelFactory` | 定位置そのものの動き方（Strategy）。極は浮遊範囲の中をランダムに渡り歩く |
| | `CardChoreographer` | めくる・取る・宙に戻すの振り付け |
| | `CardField`, `FloatLayout`, `CardPicker`, `RevealStage` | 場の管理、配置と範囲、クリック判定、中央表示と下部の位置 |
| `render/player/` | `FirstPersonRig`, `PointingHand`, `HoldingHand`, `HandModelFactory` | 目線のカメラと両手（右手は伸びた分だけ前へ出て、肩・手首・指先の位置を返す） |
| | `StretchArm` | 伸びた腕（袖）の見た目 |
| | `ArmVisibility` | 伸ばすほど右手と袖を透かす（視界を遮らない） |
| `render/piles/` | `HandPile`, `TablePile`, `PileFactory` | 取ったカードの置き場（Pile インターフェース） |
| `input/` | `PointerInput`, `KeyboardInput`, `KeyboardLookController` | 入力の解釈 |
| | `ReachController` | W / S の長押しを腕の伸び縮みに変換 |
| `physics/` | `ArmReach` | 腕の伸び具合（0〜最大） |
| | `PalmContactSensor` | 手のひらが触れているカードを1枚特定（少し離れるまで触れたままとみなす） |
| | `PalmHold` | 触れているカードをその場に押さえる（達人のみ。極では押さえない） |
| | `ArmCollisionResolver` | 腕に当たった他のカードを押し出して弾く（散らばる） |
| | `Knockback`, `vectorMath` | 弾かれたカードの勢いと減速、線分との距離計算（three.js 非依存でテスト可能） |
| `ui/` | `Hud`, `Toast`, `MenuScreen`, `ResultScreen`, `ResultFormatter` | HTML 表示 |
| | `PauseScreen`, `PauseButton` | ポーズ画面と一時停止ボタン |
| | `ReachMeter`, `ReachPad` | 達人モードの腕の長さメーターと、タッチ端末用の「伸ばす・縮める・めくる」ボタン |
| | `ContactIndicator` | 「手のひらがカードに触れています・左クリックでめくる」の表示 |
| `app/` | `App` | 画面遷移（メニュー → プレイ ⇄ ポーズ → 結果） |
| | `PauseController` | ポーズ状態・ゲーム内時計・画面表示をそろえて切り替える |
| | `PointSelection`, `ReachSelection` | カードの選び方（Strategy）。カーソルの先を選ぶ／手のひらが触れているカードを選ぶ（どちらも左クリック） |
| | `ContactFeedback` | 触れているカードを光らせ、表示を出す |
| | `GameSession` | ルールのイベントを演出・HUD・CPU につなぐ仲介役 |

## 1手の流れ

1. `PointerInput` が「タップ」を通知 → `App` → `GameSession.handleTap()`
2. `CardPicker` がカーソル下の `CardView` を特定 → `ConcentrationGame.select(card)`
3. ルールが `CardRevealed` を発行 → `CardChoreographer` が両面を表にし、中央に大きく見せてから画面下部へ寄せる（この間は次を選べない）
4. 2枚目で `SelectionComplete` → 下部に並んだら `resolve()` → `PairMatched` / `PairMissed`
5. 演出が終わったら `endResolution()` → 次の `TurnStarted`（CPU ならば `CpuTurnRunner` が動く）

ルールの判定（`resolve`）と確定（`endResolution`）を分けているので、演出に時間をかけてもルールの整合性は崩れません。

## 難易度

| 難易度 | カードの動き | 選び方 |
|---|---|---|
| ふつう | その場でゆらゆら | カーソルを合わせてクリック |
| むずかしい | 範囲内を上下左右に動き回る | カーソルを合わせてクリック |
| 達人 | 範囲内を動き回る | カーソルで狙い、**W 長押しで腕を伸ばし、S 長押しで縮める**。手のひらがカードに触れると表示が出るので、そこで**左クリック**するとめくれる。腕に当たった他のカードは弾かれて散らばる。スマホ・タブレットでは画面の「伸ばす」「縮める」「めくる」ボタンで操作する |
| 極 | むずかしいと同じ揺れ動きに加え、**定位置そのものが範囲内をランダムに渡り歩く** | 達人と同じ。ただし手のひらが触れて表示が出てもカードは**止まらず**、左クリックで選ばれて初めて止まる |

達人の当たり判定は、手のひらを点、腕を「肩→手首」「手首→指先」の2本のカプセル、カードを球として計算しています
（`PalmContactSensor` と `ArmCollisionResolver`）。伸ばした腕と手は半透明になり、視界を遮りにくくしています。
大きさや弾く強さは `config/GameConfig.js` の `ARM` で調整できます。

## ポーズの仕組み

カード・ゲーム進行・判定待ち・CPU の思考は、すべて `PausableTimeline`（ゲーム内時計）の中で動きます。
`PauseController.pause()` で時計を止めると、これらとタイマーがまとめて止まり、再開すると止まった所から続きます。
視点・手・描画は時計の外にあるので、ポーズ画面の背景も描かれ続けます。Esc キー、画面右上のボタン、別タブへの切り替えでポーズします。

## 拡張の例

- **難易度を増やす**：`config/Difficulties.js` にエントリを追加し、`index.html` のメニューに選択肢を足す。新しい動き方は `offsetAt(t, out)` を持つクラスを作り、`DriftFactory.register()` で登録する。
- **めくったときの見せ方を変える**：`CardChoreographer.reveal()` の手順（`PoseTween` / `Wait`）を組み替える。位置と大きさは `config/GameConfig.js` の `REVEAL_LAYOUT`。

- **ペアの条件を変える**：`isMatch(a, b)` を持つクラスを作り、`main.js` の `matchRule` を差し替える（例：`SameRankAndColorRule`）。
- **遊び方を増やす**：`domain/GameModes.js` にエントリを追加し、`index.html` のメニューに選択肢を足す。
- **CPU を強く／弱くする**：`CpuStrategy` インターフェース（`chooseFirst` / `chooseSecond`）を実装した別クラスを `GameSession#setUpCpu` で使う。記憶率は `config/GameConfig.js` の `CPU.rememberChance`。
- **取ったカードの置き場を増やす**：`nextSlot()` を持つ Pile クラスを作り、`PileFactory.register('名前', …)` で登録する。
- **カードの絵柄を変える**：`CardFacePainter` / `CardBackPainter` を差し替える（`paint(ctx, …)` を実装）。
- **テンポや見た目の数値**：すべて `config/GameConfig.js` にあります。
