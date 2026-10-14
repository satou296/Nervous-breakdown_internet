# 監視を自分のパソコンの Docker で動かす手順

Zabbix と Grafana を自分のパソコンの Docker で動かし、記録の保管（Loki）だけを Grafana Cloud の無料枠に任せる構成の手順です。
上から順に進めてください。所要時間の目安は 40〜60 分です。
サーバーが出している数値と記録の中身は [MONITORING.md](MONITORING.md) にまとめています。
Grafana Cloud・Zabbix・Grafana の画面のボタン名は、変更されて少し違うことがあります。その場合は近い名前のものを選んでください。

---

## 全体の流れ

```
Render（ゲームサーバー）
  │  記録を送る（5秒ごと）               数値を読みに行く（1分ごと）
  ▼                                        ▲
Grafana Cloud の Loki                  自分のパソコン（Docker）
  ▲                                     ├─ Zabbix   http://localhost:8081
  │  記録を読みに行く                   └─ Grafana  http://localhost:3000
  └────────────────────────────────────────┘
```

外から自分のパソコンへ入ってくる通信はありません。ルーターの設定は不要です。

| 手順 | やること | 場所 |
|---|---|---|
| 1 | Docker Desktop を入れる | パソコン |
| 2 | Loki の送り先とトークンを用意する | Grafana Cloud |
| 3 | 環境変数を4つ設定する | Render |
| 4 | 設定ファイル（`.env`）を作る | パソコン |
| 5 | 監視用のコンテナを起動する | パソコン |
| 6 | Zabbix を設定する（テンプレートの取り込み） | http://localhost:8081 |
| 7 | Grafana で見る | http://localhost:3000 |

扱う合言葉は次の3種類です。**どれも GitHub に上げません。**

| 名前 | 作る場所 | 入れる場所 |
|---|---|---|
| 数値を読むための合言葉（`STATS_TOKEN`） | 自分で作る | Render と、Zabbix のマクロ |
| Loki に**書く**ためのトークン | Grafana Cloud | Render |
| Loki を**読む**ためのトークン | Grafana Cloud | パソコンの `.env` |

---

## 1. Docker Desktop を入れる

1. https://www.docker.com/products/docker-desktop/ からダウンロードしてインストールします。
2. Docker Desktop を起動します（メニューバーのクジラのアイコンが止まっていれば起動完了）。
3. ターミナルで次を実行し、番号が出れば使えます。

   ```
   docker compose version
   ```

---

## 2. Grafana Cloud で Loki を用意する

1. https://grafana.com で無料のアカウントを作ります（スタックという自分用の環境が1つできます）。
2. Grafana Cloud の管理画面（Cloud Portal）で、自分のスタックの **Loki** の **Details**（または Send Logs）を開きます。
3. 次の2つを控えます。
   - **URL**：`https://logs-prod-XXX.grafana.net` のような形
   - **User**：数字の番号
4. トークンを **2つ** 作ります（同じ画面の「Generate now」、または **Access Policies** から）。

   | 用途 | 権限（Scope） | 名前の例 |
   |---|---|---|
   | 書き込み用 | `logs:write` | `nbi-render-write` |
   | 読み取り用 | `logs:read` | `nbi-local-read` |

   トークンは作った直後にしか表示されません。必ずその場で控えてください。

---

## 3. Render に環境変数を設定する

1. ターミナルで次を実行し、出てきた文字列を控えます（数値を読むための合言葉です）。

   ```
   openssl rand -hex 24
   ```

2. Render のサービス画面 → **Environment** で、次の4つを追加して **Save Changes** を押します。
   保存するとサーバーが再起動し、**進行中の部屋はなくなります**。遊んでいない時間に行ってください。

   | 変数 | 値 |
   |---|---|
   | `STATS_TOKEN` | 上で作った合言葉 |
   | `LOKI_URL` | 手順2の URL の末尾に `/loki/api/v1/push` を付けたもの<br>例：`https://logs-prod-XXX.grafana.net/loki/api/v1/push` |
   | `LOKI_USER` | 手順2の番号 |
   | `LOKI_TOKEN` | 手順2の **書き込み用** トークン |

3. 再起動が終わったら、ターミナルで確かめます。JSON が返れば成功です。

   ```
   curl -H "Authorization: Bearer （合言葉）" https://nervous-breakdown-internet.onrender.com/api/stats
   ```

4. Render の **Logs** に `"event":"server_started"` の行があり、`"lokiEnabled":true` になっていれば、記録を送る設定も有効です。

---

## 4. 設定ファイル（`.env`）を作る

1. ターミナルで、リポジトリの `monitoring` フォルダに移動します。

   ```
   cd ~/Nervous-breakdown_internet/monitoring
   ```

2. 見本をコピーします。

   ```
   cp .env.example .env
   ```

3. `.env` をエディタで開き、次のとおり書き換えます。

   | 項目 | 入れる値 |
   |---|---|
   | `ZABBIX_DB_PASSWORD` | 好きな文字列（自分で使うことはない。一度起動したら変えない） |
   | `GRAFANA_ADMIN_PASSWORD` | Grafana に入るときのパスワード（自分で決める） |
   | `ZABBIX_API_USER` / `ZABBIX_API_PASSWORD` | **今はそのまま**（`Admin` / `zabbix`）。手順6-1で変える |
   | `LOKI_URL` | 手順2の URL **そのまま**（こちらは `/loki/api/v1/push` を**付けない**） |
   | `LOKI_USER` | 手順2の番号 |
   | `LOKI_READ_TOKEN` | 手順2の **読み取り用** トークン |

`.env` は `.gitignore` に入っているので、GitHub には上がりません。

---

## 5. 監視用のコンテナを起動する

`monitoring` フォルダで実行します。

```
docker compose up -d
```

- 初回は部品のダウンロードで数分かかります。
- 起動後、Zabbix が中身を準備するのに **1〜2分** かかります。その間は画面を開いてもエラーになります。
- 動いているかは次で確かめられます。4つとも `Up`（または `running`）なら正常です。

  ```
  docker compose ps
  ```

---

## 6. Zabbix を設定する

### 6-1. 入ってパスワードを変える

1. http://localhost:8081 を開き、Username `Admin`、Password `zabbix` で入ります（`Admin` の A は大文字）。
2. 左下の **User settings → Profile → Change password** で、パスワードを変えます。
3. `.env` の `ZABBIX_API_PASSWORD` を、新しいパスワードと同じ値に書き換えます。
4. ターミナルで次を実行します（Grafana に新しいパスワードを伝えるため）。

   ```
   docker compose up -d
   ```

### 6-2. テンプレートを取り込む

項目とトリガーをまとめたテンプレートを用意してあるので、1つずつ作る必要はありません。

1. **Data collection → Templates** を開き、右上の **Import** を押します。
2. **Import file** で、リポジトリの `monitoring/zabbix/template_nervous_breakdown_internet.yaml` を選びます。
3. **Import** を押します（確認の画面が出たら、もう一度 **Import**）。

これで、テンプレート `Nervous breakdown internet` に次が入ります。

| 種類 | 中身 |
|---|---|
| 項目（親） | `/api/stats` を1分ごとに読む `Game stats (raw)` |
| 項目（子） | Connections / Players / Rooms / Rooms playing / Uptime / Memory と、各種の累計（`… total`） |
| トリガー | 「応答がない」（5分）・「再起動した」・「エラーが起きた」 |

### 6-3. 監視対象（ホスト）を作る

1. **Data collection → Hosts → Create host** を開きます。
2. 次のとおり入力します。

   | 項目 | 入力する値 |
   |---|---|
   | Host name | `nervous-breakdown-internet`（**この綴りのまま**。Grafana のダッシュボードがこの名前で探します） |
   | Templates | `Nervous breakdown internet` |
   | Host groups | `Applications`（入力して出てくる候補を選ぶ。なければ新しく作る） |

3. 同じ画面の **Macros** タブを開き、次を入れます。

   | Macro | Value |
   |---|---|
   | `{$GAME_STATS_TOKEN}` | 手順3で作った合言葉。値の欄の右のボタンで **Secret text** を選ぶ |
   | `{$GAME_URL}` | 公開 URL が `https://nervous-breakdown-internet.onrender.com` と違う場合だけ、自分の URL を入れる（末尾に `/` を付けない） |

4. **Add** を押して保存します。

### 6-4. 数値が入ってくるか確かめる

1. **Monitoring → Latest data** を開き、Hosts に `nervous-breakdown-internet` を選んで **Apply** を押します。
2. 1〜2分待って、`Connections` や `Uptime` に値が入っていれば成功です。

値が入らないときは、**Data collection → Hosts** → `nervous-breakdown-internet` の **Items** → `Game stats (raw)` を開き、下の **Test → Get value and test** を押すと、サーバーの返事がそのまま見られます。

### 6-5. 最初から入っている「Zabbix server」を止める（任意）

Zabbix には最初から `Zabbix server` というホストが入っていて、「Zabbix agent is not available」という警告を出します。今回の監視には関係ないので、**Data collection → Hosts** でそのホストの **Enabled** を押して **Disabled** にしておくと、警告が消えます。

---

## 7. Grafana で見る

1. http://localhost:3000 を開き、Username `admin`、Password に `.env` の `GRAFANA_ADMIN_PASSWORD` を入れます。
2. 左のメニューの **Dashboards** → **浮遊トランプ神経衰弱：サーバーの様子** を開きます。

データの元（Loki と Zabbix）とダッシュボードは、起動時に自動で登録されています。

| パネル | 元 | 見られるもの |
|---|---|---|
| つながっている画面／部屋にいる人数／部屋の数／対戦中の部屋／起動してからの時間 | Zabbix | いまの値 |
| 接続・人数・部屋の移り変わり、メモリ、累計 | Zabbix | 時間ごとのグラフ |
| 出来事の件数 | Loki | 部屋の作成・試合の開始などが5分あたり何件あったか |
| エラーの記録、すべての記録 | Loki | 記録の一覧（行を押すと中身が見られる） |

- ダッシュボードは自由に変えられます。変えたものを残すには、別の名前で保存してください（元のファイルから読み込み直されるため）。
- 自分で検索するときは、左のメニューの **Explore** で Loki を選びます。検索文の例は [MONITORING.md](MONITORING.md) の「4-3」にあります。

---

## ふだんの使い方

すべて `monitoring` フォルダで実行します。

| やりたいこと | 命令 |
|---|---|
| 止める（集めた数値は残る） | `docker compose down` |
| もう一度動かす | `docker compose up -d` |
| 様子を見る | `docker compose ps` |
| うまく動かないときに記録を見る | `docker compose logs --tail 50 zabbix-server`（`grafana` なども同じ） |
| すべて消して最初からやり直す | `docker compose down -v`（**集めた数値と Zabbix の設定がすべて消えます**） |

- Docker Desktop を起動すると、コンテナも自動で動き出します（`docker compose down` で止めた場合を除く）。
- **パソコンを止めている間は、数値は記録されず、通知も来ません。** 記録（Loki）は Grafana Cloud にたまり続けるので、後から見られます。
- Zabbix が1分ごとに読みに行く間は、Render のサーバーは停止しません。パソコンを止めるとこの効果もなくなるので、UptimeRobot の監視は残しておいてください。

## うまくいかないとき

| 症状 | 原因と対処 |
|---|---|
| `docker compose up -d` で「.env に … を設定してください」と出る | `.env` がないか、その項目が空です。手順4を確認 |
| http://localhost:8081 が開かない、エラーが出る | 起動直後は準備中です。1〜2分待って再読み込み。直らなければ `docker compose logs --tail 50 zabbix-server` |
| ポートが使われている（`port is already allocated`） | 8081 か 3000 をほかのアプリが使っています。`docker-compose.yml` の `"127.0.0.1:8081:8080"` の **左側の番号**を別の番号（例：8082）に変える |
| Zabbix の項目が `unauthorized` を返す | マクロ `{$GAME_STATS_TOKEN}` の値が、Render の `STATS_TOKEN` と違います |
| Zabbix の項目が `not_found` を返す | Render に `STATS_TOKEN` が設定されていないか、新しいコードがまだ反映されていません |
| Grafana の Zabbix のパネルが「No data」やエラー | ホスト名が `nervous-breakdown-internet` になっているか確認。Zabbix のパスワードを変えたあと、`.env` の `ZABBIX_API_PASSWORD` を直して `docker compose up -d` を実行したか確認 |
| Grafana の Loki のパネルがエラー | `.env` の `LOKI_URL`（`/loki/api/v1/push` を付けない）・`LOKI_USER`・`LOKI_READ_TOKEN`（読み取り用）を確認し、`docker compose up -d` を実行し直す |
| Grafana の Loki のパネルが「No data」 | Render 側の設定を確認（Logs の `"lokiEnabled":true`、`[loki]` の行が出ていないか）。誰も遊んでいない時間は記録が少ないので、右上の期間を広げる |
| Grafana のパスワードを忘れた | `docker compose exec grafana grafana cli admin reset-admin-password （新しいパスワード）` |
| `.env` の `GRAFANA_ADMIN_PASSWORD` を変えたのに入れない | このパスワードは初回の起動時にだけ使われます。上の命令で変えてください |
