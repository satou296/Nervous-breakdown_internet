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
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  return errors;
}

async function openAndWaitTutorial(page, path = '/') {
  await page.goto(path);
  await expect(page.locator('#loading')).toBeHidden({ timeout: 30_000 });
  await expect(page.locator('#tutorial')).toBeVisible();
}

/**
 * カードの位置はページの外からは分からないので、画面を格子状にクリックしていき、
 * 説明文が変わる（＝カードがめくれて進行した）まで続ける。
 */
async function clickUntil(page, isReached, { timeoutMs = 60_000 } = {}) {
  const { width, height } = page.viewportSize();
  const deadline = Date.now() + timeoutMs;
  // 左側は説明パネルがあるので避ける。カードは画面の上半分あたりに浮かんでいる
  const xs = [0.32, 0.4, 0.48, 0.56, 0.64, 0.72, 0.8, 0.88];
  const ys = [0.08, 0.16, 0.24, 0.32, 0.4, 0.48, 0.56];
  const points = ys.flatMap(y => xs.map(x => [x, y]));
  while (Date.now() < deadline) {
    // 毎回同じ順だと同じ組み合わせばかりめくるので、順番を混ぜる
    for (const [x, y] of points.sort(() => Math.random() - 0.5)) {
      if (await isReached()) return;
      await page.mouse.click(Math.round(width * x), Math.round(height * y));
      await page.waitForTimeout(50);
    }
  }
  throw new Error('時間内に進みませんでした');
}

test('開くとチュートリアルが始まり、本物のゲーム画面でカードをめくって最後まで進められる', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = collectErrors(page);
  await openAndWaitTutorial(page);
  await expect(page.locator('#tutorialText')).toContainText(STEP_TEXT.pickFirst);
  await expect(page.locator('#tutorialProgress')).toHaveText('チュートリアル 1 / 5');
  await expect(page.locator('#tutorialSkip')).toBeVisible();
  await expect(page.locator('#menu')).toBeHidden();
  await expect(page.locator('#hud')).toBeVisible();
  // 配り終わるまで待ってからめくる
  await page.waitForTimeout(1500);

  const text = page.locator('#tutorialText');
  await clickUntil(page, async () => !(await text.textContent()).includes(STEP_TEXT.pickFirst));
  await expect(text).toContainText(STEP_TEXT.pickSecond);
  await page.screenshot({ path: 'test-results/tutorial-revealed.png' });

  // 最後までそろえると「ゲームをはじめる」が出て、押すとスタート画面へ
  const finish = page.locator('#tutorialFinish');
  await clickUntil(page, () => finish.isVisible(), { timeoutMs: 240_000 });
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
  await page.waitForTimeout(1200);
  await page.mouse.move(700, 330);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(700);
  await page.keyboard.up('KeyW');
  const now = Number(await page.locator('#reachMeter').getAttribute('aria-valuenow'));
  expect(now).toBeGreaterThan(0);
  await page.screenshot({ path: 'test-results/expert-reach.png' });
  expect(errors).toEqual([]);
});

test('招待URLで開いたときも、チュートリアルのスキップ後は参加画面になる', async ({ page }) => {
  await openAndWaitTutorial(page, '/?room=ABCDE');
  await page.locator('#tutorialSkip').click();
  await expect(page.locator('#lobby')).toBeVisible();
  await expect(page.locator('#lobbyFormTitle')).toContainText('ABCDE');
  await expect(page.locator('#menu')).toBeHidden();
});
