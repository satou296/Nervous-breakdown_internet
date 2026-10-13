# オンライン対戦を公開する手順（Render）

URL を開けばいつでもオンライン対戦ができる状態にするまでの、すべての作業を順番に書いています。
この手順は **Render の無料プラン（Free）** で公開する前提です。クレジットカードの登録は不要です。
上から順に進めてください。所要時間の目安は 30〜60 分です。
GitHub や Render の画面のボタン名は、変更されて少し違うことがあります。その場合は近い名前のボタンを選んでください。

---

## 全体の流れ

| 手順 | やること | 必要なもの |
|---|---|---|
| 1 | （任意）自分のパソコンで動作を確かめる | Node.js |
| 2 | GitHub のリポジトリを新しいファイルに入れ替える | GitHub アカウント |
| 3 | GitHub で自動テストが通ることを確かめる | なし |
| 4 | Render のアカウントを作り、GitHub とつなぐ | メールアドレス |
| 5 | Render にゲームサーバーを作る（無料プラン） | なし |
| 6 | いつでも開ける状態にする（停止を防ぐ設定） | UptimeRobot の無料アカウント |
| 7 | 公開された URL で動作を確かめる | ブラウザ2つ（またはスマホ） |
| 8 | （任意）独自ドメインを付ける | ドメイン |

---

## 1.（任意）自分のパソコンで動作を確かめる

公開する前に、手元で正しく動くかを確かめる手順です。飛ばしてもかまいません。

### 1-1. Node.js を入れる

1. https://nodejs.org/ を開きます。
2. 「LTS」と書かれた版（バージョン 20 以上）をダウンロードしてインストールします。
3. インストールできたか確かめます。
   - Mac：「ターミナル」アプリを開く
   - Windows：スタートメニューで「PowerShell」を開く
   - 次の命令を入力して Enter を押し、`v22.x.x` のように番号が出れば成功です。

   ```
   node -v
   ```

### 1-2. ゲームサーバーを起動する

1. `Nervous-breakdown.zip` を展開します（例：デスクトップに `Nervous-breakdown` フォルダができる）。
2. ターミナル（PowerShell）で、そのフォルダに移動します。

   ```
   cd ~/Desktop/Nervous-breakdown
   ```

   Windows の例：`cd $HOME\Desktop\Nervous-breakdown`
3. 必要な部品を入れます（初回だけ。1分ほどかかります）。

   ```
   npm install
   ```

4. テストを実行します。最後に `# pass 41` `# fail 0` と出れば正常です。

   ```
   npm test
   ```

5. サーバーを起動します。`浮遊トランプ神経衰弱サーバー: http://localhost:8080` と表示されます。

   ```
   npm start
   ```

6. ブラウザで http://localhost:8080 を開きます。
7. 「あそびかた」で **オンライン** を選んで「ゲーム開始」→ 名前を入れて「部屋を作る」。
8. 表示された招待URL（`http://localhost:8080/room/XXXXX`）を、**シークレットウィンドウ**（Chrome は Ctrl+Shift+N、Mac は Cmd+Shift+N）で開き、別の名前で参加します。
9. 最初のウィンドウで「対戦を始める」を押し、交互にカードをめくれれば成功です。
10. 終わったら、ターミナルで Ctrl+C を押してサーバーを止めます。

> Docker Desktop を入れている場合は、`npm install` と `npm start` の代わりに `docker compose up --build` でも同じように確かめられます（Render と同じ仕組みのコンテナで動きます）。止めるときは `docker compose down`。

---

## 2. GitHub のリポジトリを入れ替える

GitHub の画面だけで作業する方法です。

### 2-1. 古いファイルを整理する

https://github.com/satou296/Nervous-breakdown を開き、次のファイルが残っていれば削除します。
（ファイルを開く → 右上の「…」→ **Delete file** → **Commit changes**）

- `src/app/GameSession.js`（`src/app/session/` に移動したため不要）
- `src/render/cards/behaviors/RevealBehavior.js`
- `src/render/cards/behaviors/CollectBehavior.js`
- `src/physics/ArmContactSystem.js`
- `.DS_Store`、`READMEのコピー.md`（あれば）

### 2-2. 新しいファイルをアップロードする

1. `Nervous-breakdown.zip` を展開します。
2. リポジトリのトップ画面で **Add file → Upload files** を押します。
3. 展開したフォルダの **中身すべて** をドラッグします（フォルダそのものではなく、中身）。
   - Mac の Finder では、`.github` や `.dockerignore` のように「.」で始まるファイルが隠れています。Finder で **Cmd + Shift + .（ピリオド）** を押すと表示されるので、それも一緒にドラッグしてください。
   - Windows では、エクスプローラーの「表示」→「隠しファイル」にチェックを入れてください。
4. 下の欄に「オンライン対戦に対応」などと書いて **Commit changes** を押します。

### 2-3. 正しく置けたか確かめる

リポジトリのトップに、次がすべて**直接**並んでいれば正しいです。

```
.github/      css/      docs/      server/      src/      tests/
.dockerignore  .gitignore  .nojekyll  Dockerfile  docker-compose.yml
index.html  package.json  README.md  render.yaml
```

- `node_modules` フォルダは **アップロードしません**（あれば削除してください）。
- `Nervous-breakdown/` のようなフォルダが一段はさまっていたら、置き方が間違っています（以前と同じ原因）。

> Git を使える場合は、`git add -A && git commit -m "オンライン対戦に対応" && git push` でも同じです。

---

## 3. GitHub で自動テストが通ることを確かめる

1. リポジトリ上部の **Actions** タブを開きます。
2. 「test」という処理が動いているので、1〜2分待ちます。
3. **緑のチェック** が付けば成功です。
   - 赤い × の場合は、その行を開いて赤くなっている部分の文字をコピーし、Claude に送ってください。

---

## 4. Render のアカウントを作る

1. https://render.com を開き、**Get Started**（または Sign Up）を押します。
2. **GitHub** でサインアップを選び、GitHub の画面で **Authorize Render** を押します。
3. 画面の案内に従って、名前などを入力します。
4. 無料プランで使うので、**クレジットカードの登録はしなくてかまいません**。
   - 登録しないままにしておくと、無料枠を超えたときに「請求」ではなく「停止」になるので安心です（下の「無料プランについて」参照）。

---

## 5. Render にゲームサーバーを作る

### 5-1. Blueprint（設計図）から作る（おすすめ）

リポジトリに入っている `render.yaml` を Render が読み取り、設定を自動で入れてくれます。

1. Render の画面右上の **New +** → **Blueprint** を選びます。
2. 「Connect a repository」で **Configure account**（または Connect GitHub）を押します。
3. GitHub の画面で、Render に見せるリポジトリを選びます。
   - **Only select repositories** を選び、`Nervous-breakdown` だけを選ぶのが安全です。
   - **Install**（または Save）を押します。
4. Render に戻り、`satou296/Nervous-breakdown` の **Connect** を押します。
5. 「Blueprint Name」に好きな名前（例：`nervous-breakdown`）を入れます。
6. 下に `floating-concentration`（Web Service）が表示され、プランが **Free** になっていることを確認し、**Apply**（または Deploy Blueprint）を押します。
7. もし支払い方法の登録を求められた場合は、`render.yaml` が `plan: free` になっているか（古いファイルのままでないか）を GitHub で確認してください。
8. サービス名をクリックすると **Logs** に作業の様子が流れます。5分ほどで次のように表示されれば起動完了です。

   ```
   浮遊トランプ神経衰弱サーバー: http://localhost:10000
   ```

   （ここに表示される localhost は Render の中の話なので気にしなくて大丈夫です）
9. 画面上部に `https://floating-concentration-xxxx.onrender.com` のような **公開 URL** が表示されます。これがゲームの URL です。

### 5-2. Blueprint を使わない場合（手動で設定）

**New + → Web Service** → リポジトリを選んで、次のとおり入力し **Create Web Service** を押します。

| 項目 | 入力する値 |
|---|---|
| Name | `floating-concentration`（好きな名前でよい） |
| Language / Runtime | **Docker** |
| Branch | `main` |
| Region | **Singapore**（日本から近い） |
| Root Directory | 空欄のまま |
| Dockerfile Path | `./Dockerfile` |
| Instance Type | **Free** |
| Health Check Path（Advanced の中） | `/health` |
| Auto-Deploy | **Yes** |
| Environment Variables | `TURN_TIMEOUT_SEC` = `45`（任意） |

---

## 6. いつでも開ける状態にする（停止を防ぐ設定）

無料プランのサーバーは、**15分間アクセスがないと自動で停止**します。停止中に誰かが URL を開くと、起動までの **約1分** 待たされます。
そこで、無料の監視サービスに **10分ごとにサーバーを見に行ってもらい**、停止しないようにします。

### 6-1. UptimeRobot に登録する

1. https://uptimerobot.com を開き、**Register for FREE**（または Sign Up）を押します。
2. メールアドレスとパスワードを入れて登録し、届いたメールの確認リンクを押します。

### 6-2. 監視を追加する

1. ログイン後の画面で **+ New monitor**（または Add New Monitor）を押します。
2. 次のとおり入力します。

   | 項目 | 入力する値 |
   |---|---|
   | Monitor Type | **HTTP(s)** |
   | Friendly Name | `神経衰弱`（好きな名前でよい） |
   | URL (or IP) | `https://（手順5で表示された公開URL）/health`<br>例：`https://floating-concentration-xxxx.onrender.com/health` |
   | Monitoring Interval | **10 minutes**（5〜14分ならどれでも可） |

3. **Create Monitor**（または Save）を押します。
4. 数分後、監視の一覧で **Up**（緑）になっていれば完了です。
   - 赤（Down）の場合は、URL の末尾が `/health` になっているか、Render のサービスが **Live** か確認してください。
   - Down になったときに UptimeRobot からメールが届くので、サーバーの異常にも気づけます。

> UptimeRobot の代わりに https://cron-job.org でも同じことができます（URL と「10分ごと」を設定するだけ）。

### 6-3. この設定について知っておくこと

- **無料時間の上限**：Render の無料プランは、アカウント（ワークスペース）全体で **月750時間** まで動かせます。
  24時間 × 31日 = 744時間なので、**このサーバー1つだけなら** ずっと起動したままでも枠内に収まります。
  同じアカウントで他の無料サービスも起動したままにすると、月の途中で枠を使い切り、その月の残りは **すべての無料サービスが停止** します。
- **予告なしの再起動**：無料プランは Render の都合でいつでも再起動されることがあります。そのとき進行中の部屋はなくなります（1分ほどで元に戻るので、部屋を作り直してください）。
- **ルールの変更**：この「定期的に開いて起こしておく」方法は、Render の公式ドキュメントに書かれた機能ではありません。Render の仕様が変わると使えなくなる可能性があります。
- **通信量の上限**：無料プランには毎月の通信量の上限があり、支払い方法を登録していないと、超えた時点でサービスが停止します。数人で遊ぶ程度ならまず問題ありません。
- 使い方は Render の画面の **Billing**（または Usage）で確認できます。

---

## 7. 公開された URL で動作を確かめる

1. 公開 URL の末尾に `/health` を付けて開きます。
   例：`https://floating-concentration-xxxx.onrender.com/health`
   → `{"status":"ok","rooms":0}` と表示されれば、サーバーは正常です。
2. 公開 URL を開き、「あそびかた」で **オンライン** を選んで「ゲーム開始」。
3. 名前を入れて **部屋を作る** → 招待URL が表示されます。**コピー** を押して友だちに送ります。
4. 招待URLを別のブラウザ（シークレットウィンドウやスマホ）で開き、名前を入れて **参加する**。
5. 部屋を作った人が **対戦を始める** を押せば対戦開始です。
6. 1人用（ひとり・CPU・2人交代）も、これまでどおり同じ URL で遊べます。

> GitHub Pages の URL（`https://satou296.github.io/Nervous-breakdown/`）は、サーバーがない場所なので **オンラインは選べません**（1人用はこれまでどおり遊べます）。オンライン対戦は必ず Render の URL で開いてください。

---

## 8.（任意）独自ドメインを付ける

1. ドメインを取得します（お名前.com、Cloudflare など）。
2. Render のサービス画面 → **Settings → Custom Domains → Add Custom Domain** に、使いたいアドレス（例：`game.example.com`）を入れます。
3. Render が表示する **CNAME**（または A レコード）の値を、ドメイン会社の「DNS 設定」画面に登録します。
4. 数分〜数時間で反映され、Render が HTTPS の証明書を自動で発行します。
5. 以後はそのアドレスで遊べます。招待URLも自動でそのアドレスになります。

---

## 更新するとき

1. 新しいファイルを GitHub にアップロードします（手順2と同じ）。
2. Render が自動でビルドして入れ替えます（Logs で確認できます）。
3. **入れ替えの瞬間、進行中の部屋はなくなります。** 遊んでいない時間に更新するのがおすすめです。

## うまくいかないとき

| 症状 | 原因と対処 |
|---|---|
| Render の Logs に `npm ERR!` が出てビルドが止まる | `package.json` がトップにあるか確認。直らなければ Logs の赤い部分を Claude に送る |
| `Health check failed` と出て起動しない | Health Check Path が `/health` になっているか確認。Logs に `Error` があれば Claude に送る |
| メニューの「オンライン」が灰色で選べない | GitHub Pages の URL を開いている。Render の URL を開く |
| 「サーバーにつながりませんでした」と出る | サーバーが停止から起動している途中です。**1分ほど待って再読み込み** してください。何度も起きる場合は、手順6の UptimeRobot が **Up** になっているか確認 |
| ページを開くと Render の読み込み画面が出る | 同上（停止中のサーバーが起動している途中）。1分ほどで自動的にゲーム画面に切り替わります |
| サービスが **Suspended**（停止）になっている | 月の無料時間（750時間）か通信量の上限を使い切っています。翌月に自動で戻ります。急ぐ場合は Starter（有料）に切り替える |
| 独自ドメインにしたらつながらない | Render の Environment に `ALLOWED_ORIGINS` を設定しているなら、`https://game.example.com` を追加する（未設定なら不要） |
| 対戦中に「接続が切れました」 | 自動で再接続します（約23秒の間に5回）。それでもつながらないとスタート画面に戻ります。通信の安定した場所で再度参加してください |
| 招待URLを開くと「部屋が見つかりません」 | 全員が抜けて10分たった部屋や、サーバー更新前の部屋は消えています。新しく部屋を作る |
| 2人で同じ部屋に入れない | Render の **Scaling（Instances）** が 1 になっているか確認（2以上だと別々のサーバーに入ってしまう） |

## 設定を変えたいとき（Render の Environment 画面）

| 変数 | 意味 | 既定値 |
|---|---|---|
| `TURN_TIMEOUT_SEC` | 1手番の持ち時間（秒） | 45 |
| `MAX_ROOMS` | 同時に作れる部屋の上限 | 300 |
| `ALLOWED_ORIGINS` | 接続を許すサイトのURL（カンマ区切り）。未設定なら「同じサイトからだけ」 | 未設定 |

変更して **Save Changes** を押すと、サーバーが再起動して反映されます。

## 無料プランについて

| | Free（今の設定） | Starter（有料） |
|---|---|---|
| 料金 | 無料 | 月額料金あり |
| アクセスがないとき | 15分で停止（手順6の設定で防げる） | 常に起動 |
| 停止中に開いたとき | 約1分の起動待ち | 待ちなし |
| 動かせる時間 | 月750時間まで（アカウント全体） | 制限なし |
| 予告なしの再起動 | あり | 基本なし |

まずは Free で始め、遊ぶ人が増えて安定性が必要になったら Starter に切り替えるのがおすすめです。

### Starter に切り替えるとき

1. Render の **Billing** でクレジットカードを登録します。
2. 次のどちらかで切り替えます。
   - GitHub の `render.yaml` の `plan: free` を `plan: starter` に書き換えて保存する
   - Render のサービス画面 → **Settings → Instance Type** で **Starter** を選ぶ
3. Starter は常に起動しているので、手順6の UptimeRobot の監視は不要です（異常を知らせるメール用に残しておいてもかまいません）。

料金や無料枠の条件は変わることがあるので、Render の料金ページ（https://render.com/pricing）と無料プランの説明（https://render.com/docs/free）で最新の内容を確認してください。

---

## さらに先へ（今回は実装していないもの）

今回の構成で2〜4人の対戦は完結していますが、規模が大きくなったときに必要になる作業です。

### A. サーバーを2台以上にする（同時に遊ぶ人がとても多くなったら）

部屋の情報を、サーバーのメモリではなく共有の保存場所に置く必要があります。

1. Render で **New + → Key Value**（Redis 互換）を作り、接続用 URL を控える。
2. `npm install redis` で部品を追加する。
3. `server/rooms/RoomManager.js` の部屋の一覧（`#rooms`）を、Redis に保存する形の `RedisRoomRepository` クラスに置き換える（部屋番号 → 部屋の設定・席・試合の状態）。
4. サーバー間でメッセージを届けるため、Redis の Pub/Sub で「部屋ごとのチャンネル」を作り、`Room.#broadcast` をそのチャンネルへの送信に置き換える。
5. 試合の進行（`OnlineMatch`）は部屋ごとに1台が担当するよう、部屋番号から担当サーバーを決める（または Redis のロックで担当を決める）。
6. Render の Instances を 2 以上にする。

### B. 達人・極の「手のひらが触れているか」をサーバーでも確かめる（不正対策を強めたい場合）

1. `src/render/cards/behaviors/FloatBehavior.js` から three.js を使わない計算部分を `src/physics/FloatMotion.js` に切り出す（種・時刻からカードの位置を計算できるようにする）。
2. サーバーの `OnlineMatch.select()` で、プレイヤーから送られた「手のひらの位置」とカードの計算上の位置の距離を `PalmContactSensor` と同じ式で調べ、離れすぎていたら受け付けない。
3. 弾かれたカードの位置もサーバーで記録し、全員に配る。

### C. アカウントや戦績

1. Render で **New + → PostgreSQL** を作る。
2. ログインには、Google などの外部ログイン（OAuth）か、メールでのログインを使う。
3. `server/` に `PlayerRepository`（戦績の保存）を追加し、`OnlineMatch` の試合終了時に記録する。
