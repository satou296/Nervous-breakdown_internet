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
    // 外部（フォント・CDN）の一時的な読み込み失敗は、ゲームの不具合ではないので数えない
    const external = !(msg.location().url ?? '').startsWith('http://localhost');
    if (external && msg.text().startsWith('Failed to load resource')) return;
    errors.push(msg.text());
  });
  return errors;
}

async function openAndWaitTutorial(page, path = '/') {
  await page.goto(path);
  await expect(page.locator('#loading')).toBeHidden({ timeout: 30_000 });
  await expect(page.locator('#tutorial')).toBeVisible();
}

/**
 * カードの位置はページの外からは分からないので、画面のあちこちをランダムにクリックしていき、
 * 条件を満たす（＝カードがめくれて進行した）まで続ける。
 * 格子状だと、小さく遠いカードが格子の間にあるとずっと当たらないので、毎回ランダムな位置にする。
 */
async function clickUntil(page, isReached, { timeoutMs = 60_000 } = {}) {
  const { width, height } = page.viewportSize();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isReached()) return;
    // 左側は説明パネルがあるので避ける。チュートリアルのカードは画面の中央寄りに置かれ、動かない
    const x = width * (0.28 + Math.random() * 0.52);
    const y = height * (0.05 + Math.random() * 0.57);
    await page.mouse.click(Math.round(x), Math.round(y));
    await page.waitForTimeout(40);
  }
  throw new Error('時間内に進みませんでした');
}

test('開くとチュートリアルが始まり、本物のゲーム画面でカードをめくって最後まで進められる', async ({ page }) => {
  test.setTimeout(480_000);
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
  await clickUntil(page, () => finish.isVisible(), { timeoutMs: 420_000 });
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
