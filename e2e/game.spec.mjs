// 実際のブラウザでの動作確認：チュートリアル → スキップ／完了 → いつもの最初の画面 → ゲーム開始
import { test, expect } from '@playwright/test';

const STEP_TEXT = {
  pickFirst: '1枚めくってみましょう',
  pickSecond: 'もう1枚めくって',
  done: 'チュートリアル完了'
};

/** 画面で起きたエラーを集める（最後に1件もないことを確かめる） */
function collectErrors(page) {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => {
    if (msg.type() !== 'error') return;
    // 外部（フォント）の一時的な読み込み失敗は、ゲームの不具合ではないので数えない
    const external = !(msg.location().url ?? '').startsWith('http://localhost');
    if (external && msg.text().startsWith('Failed to load resource')) return;
    errors.push(msg.text());
  });
  return errors;
}

/** 腕の長さメーターの値（0〜100） */
async function reachLevel(page) {
  return Number(await page.locator('#reachMeter').getAttribute('aria-valuenow'));
}

async function openAndWaitTutorial(page, path = '/') {
  await page.goto(path);
  await expect(page.locator('#loading')).toBeHidden({ timeout: 30_000 });
  await expect(page.locator('#tutorial')).toBeVisible();
}

/** 場のカード（id・選べるか・狙える画面位置）。画面の src/app/AutomationProbe.js が答える */
function readCards(page) {
  return page.evaluate(() => window.__nervousBreakdownE2E.cards());
}

/**
 * カードを狙ってクリックし、選ばれる（選べなくなる）まで続ける。
 * カードはその場で回っているので、真横を向いている間は狙える位置が無く、少し待ってやり直す。
 * 前の2枚の判定中はクリックが受け付けられないので、それも同じく待つ。
 */
async function clickCard(page, id, { timeoutMs = 30_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const card = (await readCards(page)).find(c => c.id === id);
    if (!card?.pickable) return;
    if (card.x !== undefined) await page.mouse.click(card.x, card.y);
    await page.waitForTimeout(100);
  }
  throw new Error(`カード ${id} をめくれませんでした`);
}

/**
 * まだ試していない2枚の組を順にめくり、isDone() になるまで続ける。
 * テストはカードの中身を知らないので、組を総当たりする（6枚なら多くても十数手）。
 */
async function matchAllPairs(page, isDone, { afterFirstCard = async () => {} } = {}) {
  const tried = new Set();
  let first = true;
  while (!(await isDone())) {
    const ids = (await readCards(page)).filter(c => c.pickable).map(c => c.id).sort((a, b) => a - b);
    const pair = untriedPair(ids, tried);
    if (!pair) {
      await page.waitForTimeout(100);
      continue;
    }
    tried.add(pair.join('-'));
    await clickCard(page, pair[0]);
    if (first) await afterFirstCard();
    first = false;
    await clickCard(page, pair[1]);
  }
}

function untriedPair(ids, tried) {
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      if (!tried.has(`${ids[i]}-${ids[j]}`)) return [ids[i], ids[j]];
    }
  }
  return null;
}

test('開くとチュートリアルが始まり、本物のゲーム画面でカードをめくって最後まで進められる', async ({ page }) => {
  const errors = collectErrors(page);
  await openAndWaitTutorial(page);
  await expect(page.locator('#tutorialText')).toContainText(STEP_TEXT.pickFirst);
  await expect(page.locator('#tutorialProgress')).toHaveText('チュートリアル 1 / 5');
  await expect(page.locator('#tutorialSkip')).toBeVisible();
  await expect(page.locator('#menu')).toBeHidden();
  await expect(page.locator('#hud')).toBeVisible();

  // 最後までそろえると「ゲームをはじめる」が出て、押すとスタート画面へ
  const text = page.locator('#tutorialText');
  const finish = page.locator('#tutorialFinish');
  await matchAllPairs(page, () => finish.isVisible(), {
    afterFirstCard: async () => {
      await expect(text).toContainText(STEP_TEXT.pickSecond);
      await page.screenshot({ path: 'test-results/tutorial-revealed.png' });
    }
  });
  await expect(text).toContainText(STEP_TEXT.done);
  await expect(page.locator('#tutorialSkip')).toBeHidden();
  await finish.click();
  await expect(page.locator('#tutorial')).toBeHidden();
  await expect(page.locator('#menu')).toBeVisible();
  expect(errors).toEqual([]);
});

test('スキップを押すとスタート画面になり、そこからゲームを始められる', async ({ page }) => {
  const errors = collectErrors(page);
  await openAndWaitTutorial(page);
  await page.screenshot({ path: 'test-results/tutorial-start.png' });
  await page.locator('#tutorialSkip').click();
  await expect(page.locator('#tutorial')).toBeHidden();
  await expect(page.locator('#menu')).toBeVisible();
  await expect(page.locator('#hud')).toBeHidden();

  await page.locator('#startBtn').click();
  await expect(page.locator('#menu')).toBeHidden();
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#turn')).toContainText('残り 16 ペア');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/game-start.png' });
  expect(errors).toEqual([]);
});

test('達人モードでは素手の腕が伸ばせる', async ({ page }) => {
  const errors = collectErrors(page);
  await openAndWaitTutorial(page);
  await page.locator('#tutorialSkip').click();
  await page.locator('label[for="d-expert"]').click();
  await page.locator('#startBtn').click();
  await expect(page.locator('#reachMeter')).toBeVisible();
  await expect(page.locator('#reachPad')).toBeHidden(); // マウスで遊べる端末ではタッチ用のボタンを出さない
  await page.mouse.move(700, 330);
  // CI のソフトウェア描画はコマ送りが遅く、ゲーム内時計（1コマ最大0.25秒）で進む配り終えまでの時間がまちまち。
  // 決め打ちの時間ではなく、腕が伸び始めるまで W を押し続ける
  await page.keyboard.down('KeyW');
  await expect.poll(() => reachLevel(page), { timeout: 30_000 }).toBeGreaterThan(0);
  await page.keyboard.up('KeyW');
  await page.screenshot({ path: 'test-results/expert-reach.png' });
  expect(errors).toEqual([]);
});

test('招待URLで開いたときは、チュートリアルを飛ばしてすぐ参加画面になる', async ({ page }) => {
  await page.goto('/?room=ABCDE');
  await expect(page.locator('#loading')).toBeHidden({ timeout: 30_000 });
  await expect(page.locator('#tutorial')).toBeHidden();
  await expect(page.locator('#lobby')).toBeVisible();
  await expect(page.locator('#lobbyFormTitle')).toContainText('ABCDE');
  await expect(page.locator('#menu')).toBeHidden();
});

test('スクリプトはすべてこのサーバーから読み、外部の CDN に頼らない', async ({ page }) => {
  const external = [];
  page.on('request', req => {
    if (req.resourceType() === 'script' && !req.url().startsWith('http://localhost')) external.push(req.url());
  });
  await openAndWaitTutorial(page);
  expect(external).toEqual([]);
});

test('three.js が読み込めないときは、読み込み中のまま止まらず案内を出す', async ({ page }) => {
  await page.route('**/src/lib/vendor/three.min.js', route => route.abort());
  await page.goto('/');
  await expect(page.locator('#loading')).toContainText('読み込めませんでした', { timeout: 30_000 });
});

test('チュートリアルは初回だけ。開き直すとスタート画面になり、「遊び方を見る」で見直せる', async ({ page }) => {
  await openAndWaitTutorial(page);
  await page.locator('#tutorialSkip').click();
  await expect(page.locator('#menu')).toBeVisible();

  await page.reload();
  await expect(page.locator('#loading')).toBeHidden({ timeout: 30_000 });
  await expect(page.locator('#menu')).toBeVisible();
  await expect(page.locator('#tutorial')).toBeHidden();

  await page.locator('#tutorialBtn').click();
  await expect(page.locator('#tutorial')).toBeVisible();
  await expect(page.locator('#menu')).toBeHidden();
  await page.locator('#tutorialSkip').click();
  await expect(page.locator('#menu')).toBeVisible();
});

test.describe('スマホ（タッチのみ）', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });

  test('達人モードは画面のボタンで腕を伸ばし縮めでき、「めくる」ボタンがある', async ({ page }) => {
    const errors = collectErrors(page);
    await openAndWaitTutorial(page);
    await page.locator('#tutorialSkip').tap();
    await page.locator('label[for="d-expert"]').tap();
    await page.locator('#startBtn').tap();
    await expect(page.locator('#reachPad')).toBeVisible();
    await expect(page.locator('#reachFlip')).toBeVisible();
    await expect(page.locator('#help')).toContainText('「伸ばす」長押し');

    // ボタンを押したまま、メーターが変わるまで待つ（決め打ちの時間で待たない。達人のテストと同じ理由）
    const holdUntil = async (id, reached) => {
      const box = await page.locator(id).boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await expect.poll(async () => reached(await reachLevel(page)), { timeout: 30_000 }).toBe(true);
      await page.mouse.up();
    };
    await holdUntil('#reachExtend', level => level >= 30);
    await holdUntil('#reachRetract', level => level < 30);

    await page.locator('#reachFlip').tap(); // 触れていなければ何も起きない（エラーにならない）
    await page.screenshot({ path: 'test-results/expert-touch.png' });
    expect(errors).toEqual([]);
  });
});
