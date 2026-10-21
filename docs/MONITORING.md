# 本番（Render）を監視する手順（Zabbix・Loki・Grafana）

Render で動いているゲームサーバーを、外から監視するための設定をまとめています。
Zabbix・Grafana の画面のボタン名は、版によって少し違うことがあります。その場合は近い名前のものを選んでください。

---

## 全体像

```
Render（ゲームサーバー）
  ├─ GET /api/stats ←── Zabbix が1分ごとに読みに来る（接続数・部屋数・累計）
  └─ 記録（1行＝1つの JSON）──→ Loki へ送る（設定したときだけ）
                                    ↓
                    Grafana … Loki の記録と Zabbix の数値をグラフや一覧で見る
```

| 役割 | 使うもの | サーバー側の準備 |
|---|---|---|
| 数値（今何人つながっているか、など） | Zabbix | Render に環境変数 `STATS_TOKEN`（合言葉）を設定する |
| 記録（いつ部屋ができ、いつ試合が終わったか、エラー） | Loki | Render に環境変数を3つ設定する |
| 見る画面 | Grafana | なし |

**Render の中には監視用のプログラムを入れません。** Zabbix は外から HTTP で読みに来るだけ、Loki へはゲームサーバーが自分で送ります。
Zabbix・Loki・Grafana は、Render とは別の場所で動かします（下の「どこで動かすか」）。

> **自分のパソコンの Docker で動かす場合は、[MONITORING_DOCKER.md](MONITORING_DOCKER.md) の手順をそのまま進めてください。**
> Zabbix の項目やトリガー、Grafana のダッシュボードが用意済みなので、この文書の手順3・4を手で行う必要はありません。この文書は、数値と記録の中身の説明と、手で設定する場合の手引きです。

### どこで動かすか

| | 手軽な置き場所 | 補足 |
|---|---|---|
| Loki と Grafana | **Grafana Cloud の無料枠** | 自分でサーバーを用意しなくてよい。この手順はこれを前提に書いています |
| Zabbix | 自分のパソコンや VPS（Docker） | 外へ出ていく通信だけで足りるので、自宅のパソコンでも Render を監視できる |

- Grafana Cloud から Zabbix の数値を見るには、Zabbix がインターネットから見える場所にある必要があります。自宅のパソコンの Zabbix は、Zabbix 自身の画面でグラフを見るのが簡単です。
- 無料枠の条件は変わることがあります。登録前に各サービスの料金ページを確認してください。

---

## 1. サーバーが出している情報

### 1-1. `/api/stats`（数値）

`/api/stats` は **非公開** です。合言葉（`STATS_TOKEN`）を設定し、その合言葉をヘッダーに付けて読んだときだけ、次のような JSON が返ります。
合言葉を設定していない間は、この入口そのものが閉じています（404）。ブラウザでそのまま開いても見られません。

```json
{"status":"ok","uptimeSec":120,"connections":2,"rooms":1,"roomsPlaying":1,"players":2,
 "connectionsTotal":5,"roomsCreatedTotal":2,"matchesStartedTotal":1,"matchesFinishedTotal":0,
 "errorsTotal":0,"memoryRssBytes":70516736}
```

| 項目 | 意味 | 種類 |
|---|---|---|
| `status` | `ok` なら正常 | 現在の値 |
| `uptimeSec` | 起動してからの秒数（急に小さくなったら再起動した） | 現在の値 |
| `connections` | つながっている画面の数（WebSocket） | 現在の値 |
| `rooms` | 部屋の数 | 現在の値 |
| `roomsPlaying` | 対戦中の部屋の数 | 現在の値 |
| `players` | 部屋に入っていて、つながっている人数 | 現在の値 |
| `connectionsTotal` | 接続された回数 | 累計 |
| `roomsCreatedTotal` | 部屋が作られた回数 | 累計 |
| `matchesStartedTotal` / `matchesFinishedTotal` | 試合が始まった／最後まで終わった回数 | 累計 |
| `errorsTotal` | サーバーで起きたエラーの回数 | 累計 |
| `memoryRssBytes` | 使っているメモリ（バイト） | 現在の値 |

- **累計は、サーバーが再起動すると 0 に戻ります。** 無料プランは予告なく再起動されるので、グラフが 0 に落ちても故障ではありません。
- プレイヤーの名前や部屋番号は含みません。
- `/health`（Render と UptimeRobot が使う）は今までどおりです。

### 1-2. 記録（ログ）

Render の **Logs** 画面に、次のような行が出ます。

```
{"ts":"2026-10-14T00:25:12.356Z","level":"info","event":"room_created","difficultyId":"normal","deckSize":20,"rooms":1}
```

| `event` | いつ出るか | 一緒に出る内容 |
|---|---|---|
| `server_started` / `server_stopped` | 起動・停止 | ポート、Loki へ送る設定の有無 |
| `ws_connected` / `ws_closed` | 画面がつながった／切れた | その時点の接続数 |
| `room_created` / `room_closed` | 部屋ができた／空の部屋を片付けた | 難易度・枚数・部屋数 |
| `match_started` / `match_finished` | 試合の開始／終了 | 難易度・枚数・人数・かかった秒数 |
| `dispatch_error` / `http_error` / `connection_error` | サーバーでエラーが起きた（`level` は `error`。`connection_error` はその接続だけを切る） | エラーの内容と発生場所 |
| `uncaught_exception` | 思わぬ例外でサーバーが止まる直前（`level` は `error`。Render が起動し直す） | エラーの内容と発生場所 |

プレイヤーの名前は記録しません。

---

## 2. 設定できる環境変数

Render のサービス画面 → **Environment** で追加します。保存するとサーバーが再起動して反映されます。

| 変数 | 意味 | 未設定のとき |
|---|---|---|
| `STATS_TOKEN` | `/api/stats` を見るための合言葉 | `/api/stats` は閉じたまま（404）。Zabbix で数値を取るなら**必須** |
| `LOKI_URL` | 記録の送り先（末尾が `/loki/api/v1/push`） | Loki へは送らない（Logs 画面には出る） |
| `LOKI_USER` | Loki の利用者番号 | 認証なしで送る |
| `LOKI_TOKEN` | Loki の合言葉 | 同上 |
| `LOG_LEVEL` | 記録する重さの下限（`debug` / `info` / `warn` / `error` / `silent`） | `info` |

- `STATS_TOKEN` と `LOKI_TOKEN` は **GitHub に書かないでください**（`render.yaml` にも書かない）。Render の Environment 画面にだけ入れます。
- `STATS_TOKEN` は、長いでたらめな文字列にします。例：ターミナルで `openssl rand -hex 24` を実行して出た文字。

---

## 3. Zabbix で数値を監視する

Zabbix がすでに動いている前提です（まだなら、Zabbix 公式の Docker 用の手順で用意します）。

### 3-0. 合言葉を決めて、Render に設定する

1. ターミナルで次を実行し、出てきた文字列を控えます（これが合言葉です）。

   ```
   openssl rand -hex 24
   ```

2. Render のサービス画面 → **Environment** → **Add Environment Variable** で、Key に `STATS_TOKEN`、Value に控えた文字列を入れて **Save Changes** を押します（サーバーが再起動します）。
3. 手元のターミナルで確かめます。JSON が返れば成功です。

   ```
   curl -H "Authorization: Bearer （合言葉）" https://（公開URL）/api/stats
   ```

   - `{"error":"unauthorized"}` … 合言葉が違います。
   - `{"error":"not_found"}` … Render に `STATS_TOKEN` が設定されていないか、まだ再起動が終わっていません。

### 3-1. 監視対象（ホスト）を作り、合言葉を登録する

1. **Data collection → Hosts → Create host** を開きます。
2. Host name に `nervous-breakdown-internet`、Host groups に好きなグループ（例：`Applications`）を入れます。
   - 外から HTTP で読むだけなので、Interfaces（エージェントの接続先）は空のままでかまいません。
3. 同じ画面の **Macros** タブを開き、次の1行を追加して保存します。

   | Macro | Value | 種類 |
   |---|---|---|
   | `{$GAME_STATS_TOKEN}` | Render に設定した合言葉 | 値の欄の右のボタンで **Secret text** を選ぶ |

   Secret text にすると、保存後は Zabbix の画面にも合言葉が表示されなくなります。項目には合言葉を直接書かず、このマクロの名前を書きます。

### 3-2. `/api/stats` を読む項目（親）を作る

作ったホストの **Items → Create item** で、次のとおり入力します。

| 項目 | 入力する値 |
|---|---|
| Name | `Game stats (raw)` |
| Type | **HTTP agent** |
| Key | `game.stats.raw` |
| Type of information | **Text** |
| URL | `https://（公開URL）/api/stats` |
| Request type | GET |
| Headers | 名前 `Authorization`、値 `Bearer {$GAME_STATS_TOKEN}`（**必須**。`Bearer` の後ろは半角の空白1つ） |
| Update interval | `1m` |
| History | `1d`（生の JSON は長く残さなくてよい） |

**Test** を押して JSON が返れば正しく読めています。`unauthorized` や `not_found` が返る場合は、3-0 の確認に戻ってください。

> 1分ごとに読みに来るので、無料プランのサーバーは停止しなくなります（UptimeRobot と同じ効果です）。

### 3-3. 数値ごとの項目（子）を作る

親の項目から値を取り出す項目を、見たい数値の分だけ作ります。

| 項目 | 入力する値 |
|---|---|
| Type | **Dependent item** |
| Master item | `Game stats (raw)` |
| Type of information | **Numeric (unsigned)** |
| Preprocessing | **JSONPath**、パラメータは下の表 |

| Name | Key | JSONPath |
|---|---|---|
| Connections | `game.connections` | `$.connections` |
| Rooms | `game.rooms` | `$.rooms` |
| Rooms playing | `game.rooms.playing` | `$.roomsPlaying` |
| Players | `game.players` | `$.players` |
| Uptime | `game.uptime`（Units に `uptime`） | `$.uptimeSec` |
| Memory | `game.memory`（Units に `B`） | `$.memoryRssBytes` |
| Errors total | `game.errors.total` | `$.errorsTotal` |
| Matches started total | `game.matches.started.total` | `$.matchesStartedTotal` |

### 3-4. 異常を知らせる条件（トリガー）を作る

**Triggers → Create trigger** で、まず次の3つを作ると実用になります。

| Name | Severity | Expression |
|---|---|---|
| ゲームサーバーから応答がない | High | `nodata(/nervous-breakdown-internet/game.connections,5m)=1` |
| ゲームサーバーが再起動した | Information | `last(/nervous-breakdown-internet/game.uptime)<180` |
| ゲームサーバーでエラーが起きた | Warning | `change(/nervous-breakdown-internet/game.errors.total)>0` |

- 「応答がない」は、Render の再起動（約1分）では鳴らないよう、5分にしています。
- 「エラーが起きた」は、再起動で累計が 0 に戻った瞬間には鳴りません（増えたときだけ）。

---

## 4. Loki に記録を送る（Grafana Cloud）

### 4-1. 送り先を用意する

1. https://grafana.com で無料のアカウントを作り、スタック（自分用の環境）を作ります。
2. Grafana Cloud の管理画面で、スタックの **Loki** の **Details**（または Send Logs）を開きます。
3. 次の3つを控えます。
   - **URL**：`https://logs-prod-XXX.grafana.net` のような形
   - **User**：数字の番号
   - **トークン**：その画面で作ります（権限は「ログを書き込む（logs:write）」だけで足ります）。作った直後にしか表示されないので、必ず控えます。

### 4-2. Render に設定する

Render のサービス画面 → **Environment** で、次の3つを追加して **Save Changes** を押します。

| 変数 | 値 |
|---|---|
| `LOKI_URL` | 控えた URL の末尾に `/loki/api/v1/push` を付けたもの<br>例：`https://logs-prod-XXX.grafana.net/loki/api/v1/push` |
| `LOKI_USER` | 控えた番号 |
| `LOKI_TOKEN` | 控えたトークン |

再起動後、Render の Logs に `"event":"server_started"` の行があり、その中が `"lokiEnabled":true` になっていれば、送る設定が有効です。

- 記録は5秒ごとにまとめて送ります。
- 送れなかったときは Logs に `[loki] …` と1回だけ出ます。URL・番号・トークンを確認してください。送れなくてもゲームは止まりません（その間の記録は Loki に残りません）。

### 4-3. Grafana で見る

Grafana の **Explore** を開き、データの元に Loki（`grafanacloud-…-logs`）を選んで、次の検索文を入れます。

| 見たいもの | 検索文（LogQL） |
|---|---|
| すべての記録 | `{app="nervous-breakdown-internet"}` |
| エラーだけ | `{app="nervous-breakdown-internet", level="error"}` |
| 試合の終了だけ | `{app="nervous-breakdown-internet"} \| json \| event="match_finished"` |
| 出来事ごとの件数（5分あたり） | `sum by (event) (count_over_time({app="nervous-breakdown-internet"} \| json [5m]))` |
| 接続数の移り変わり | `max(max_over_time({app="nervous-breakdown-internet"} \| json \| event=~"ws_.*" \| unwrap connections [5m]))` |

気に入った検索は、**Add to dashboard** でダッシュボードに貼り付けられます。

### 4-4. Zabbix の数値を Grafana で見る（任意）

Grafana に **Zabbix** プラグインを入れ、データの元として Zabbix の API の URL と利用者を登録すると、Zabbix の数値も同じダッシュボードに並べられます。
Grafana から Zabbix に届く必要があるので、Grafana Cloud を使う場合は Zabbix がインターネットから見える場所にあることが条件です。

---

## うまくいかないとき

| 症状 | 原因と対処 |
|---|---|
| `/api/stats` が `{"error":"unauthorized"}` を返す | 合言葉が付いていないか、違っています。ヘッダー `Authorization: Bearer （合言葉）` を確認（ブラウザでそのまま開いても見られません）。Zabbix では、マクロ `{$GAME_STATS_TOKEN}` の値と Render の `STATS_TOKEN` が同じか確認 |
| `/api/stats` が `{"error":"not_found"}` を返す | Render に `STATS_TOKEN` が設定されていません（未設定の間は閉じています）。3-0 の手順で設定 |
| 合言葉を変えたい・漏れたかもしれない | Render の `STATS_TOKEN` を新しい値に変え、Zabbix のマクロ `{$GAME_STATS_TOKEN}` も同じ値に変える |
| Zabbix の項目が「Not supported」になる | 親の項目の **Test** で JSON が返るか確認。子の項目は JSONPath の綴り（大文字・小文字）を確認 |
| Grafana に記録が出ない | Render の Logs で `"lokiEnabled":true` か、`[loki]` の行が出ていないか確認。Grafana 側は表示する期間（右上）を「Last 1 hour」などに広げる |
| 累計の数値が急に 0 になった | サーバーが再起動しました（無料プランでは起こります）。故障ではありません |
| Render の Logs が JSON だらけで読みにくい | `LOG_LEVEL` を `warn` にすると、エラーと警告だけになります（Loki へ送る内容も同じく減ります） |
