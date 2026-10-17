import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { chooseAudience, onboard, watchErrors } from './helpers.mjs';

const CAPTURE = process.env.CAPTURE_SCREENSHOTS === '1';
const shots = 'docs/screenshots';

test('first visit asks for the audience, then the homepage leads to training set-up', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page).toHaveURL(/#\/welcome/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Who are you exploring for?');
  await page.locator('input[name="audience"][value="adults"]').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your fitness.');
  await expect(page.getByRole('link', { name: 'Explore Gyms' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Find My Coaching Team' }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Get Started' }).click();
  await expect(page.getByRole('heading', { name: 'What are you training for?' })).toBeVisible();
  // Validation: a goal is required before continuing.
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alert')).toContainText('Choose the goal');
  expect(errors).toEqual([]);
});

test('core journey: configure, build a plan, train with rest timers, finish, and see it in history after reload', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  // Build a small custom plan.
  await page.goto('/#/plans');
  await page.getByRole('button', { name: 'Blank plan' }).click();
  await expect(page.getByLabel('Plan name')).toBeVisible();
  await page.getByLabel('Plan name').fill('Test Block');
  await page.getByRole('button', { name: 'Add exercise' }).click();
  await page.getByRole('dialog').getByLabel('Search exercises').fill('goblet');
  await page.getByRole('dialog').getByRole('button', { name: /Goblet Squat/ }).click();
  await page.getByRole('button', { name: 'Add exercise' }).click();
  await page.getByRole('dialog').getByLabel('Search exercises').fill('plank');
  await page.getByRole('dialog').getByRole('button', { name: /Front Plank/ }).click();
  await expect(page.locator('.editor-row')).toHaveCount(2);
  // Edit sets, reorder and change rest.
  const sets = page.getByRole('spinbutton', { name: 'Sets for Goblet Squat', exact: true });
  await sets.fill('2'); await sets.press('Tab');
  await page.getByRole('spinbutton', { name: 'Sets for Front Plank' }).fill('1'); await page.getByRole('spinbutton', { name: 'Sets for Front Plank' }).press('Tab');
  await page.getByRole('spinbutton', { name: 'Seconds for Front Plank', exact: true }).fill('5'); await page.getByRole('spinbutton', { name: 'Seconds for Front Plank', exact: true }).press('Tab');
  await page.getByRole('button', { name: 'Move Front Plank up' }).click();
  await expect(page.locator('.editor-row').first()).toContainText('Front Plank');
  await page.getByRole('button', { name: 'Move Front Plank down' }).click();
  await page.getByRole('spinbutton', { name: 'Rest seconds for Goblet Squat' }).fill('15'); await page.getByRole('spinbutton', { name: 'Rest seconds for Goblet Squat' }).press('Tab');
  await expect(page.getByRole('status').filter({ hasText: 'All changes saved' })).toBeVisible();
  await page.getByRole('button', { name: 'Make active' }).click();

  // Train.
  await page.getByRole('button', { name: 'Start this session' }).click();
  await expect(page).toHaveURL(/#\/workout/);
  await expect(page.locator('.tabbar')).toBeHidden();
  await page.getByRole('spinbutton', { name: 'Load for set 1 in kg' }).fill('20'); await page.getByRole('spinbutton', { name: 'Load for set 1 in kg' }).press('Tab');
  await page.getByRole('spinbutton', { name: 'Reps for set 1' }).fill('12'); await page.getByRole('spinbutton', { name: 'Reps for set 1' }).press('Tab');
  await page.getByRole('button', { name: 'Log set 1' }).click();
  await expect(page.getByRole('region', { name: 'Rest timer' })).toBeVisible();
  // Pause freezes the rest timer.
  await page.getByRole('button', { name: 'Pause workout' }).click();
  await expect(page.getByRole('dialog', { name: /Take your/ })).toBeVisible();
  const frozen = await page.getByRole('timer').textContent();
  await page.waitForTimeout(1500);
  expect(await page.getByRole('timer').textContent()).toBe(frozen);
  await page.getByRole('dialog').getByRole('button', { name: 'Resume' }).click();
  await page.getByRole('button', { name: 'Skip rest' }).click();
  await expect(page.getByRole('region', { name: 'Rest timer' })).toBeHidden();
  // Recovery: reload mid-workout keeps progress.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Undo set 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Log set 2' }).click();
  // The plank hold runs on its own timer and logs itself.
  await expect(page.getByRole('heading', { name: 'Front Plank' })).toBeVisible();
  await page.getByRole('button', { name: 'Skip rest' }).click();
  await page.getByRole('button', { name: 'Start hold for set 1' }).click();
  await expect(page.getByRole('region', { name: 'Hold timer' })).toBeVisible();
  await expect(page.getByText('Every set is logged.')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Finish workout' }).click();

  // Summary, then history survives a reload.
  await expect(page).toHaveURL(/#\/summary\//);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('complete');
  await expect(page.locator('.summary-stats')).toContainText('3');
  await page.goto('/#/progress?tab=workouts');
  await page.reload();
  await expect(page.locator('.history-row')).toHaveCount(1);
  await expect(page.locator('.history-row')).toContainText('Day 1');
  await page.goto('/#/today');
  await expect(page.locator('.week-strip li.trained')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('ending early offers save or discard, and discard needs confirmation', async ({ page }) => {
  await onboard(page);
  await page.goto('/#/today');
  await page.getByRole('button', { name: /Begin session|anyway/ }).click();
  await page.getByRole('button', { name: 'End workout' }).click();
  await page.getByRole('button', { name: 'Discard' }).click();
  await page.getByRole('button', { name: 'Discard workout' }).click();
  await expect(page).toHaveURL(/#\/today/);
  await expect(page.locator('.resume-pill')).toHaveCount(0);
});

test('coach: offline replies with a startable session, errors recover, and the choice persists', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await page.goto('/#/coach');
  const select = page.getByRole('combobox', { name: 'Coach' });
  await expect(select).toHaveValue('offline');
  await expect(select.locator('option[value="openai-api"]')).toHaveAttribute('disabled', '');
  await page.getByLabel('Message the coach').fill('A 20 minute core workout');
  await page.getByLabel('Message the coach').press('Enter');
  await expect(page.locator('.coach-card')).toBeVisible();
  await page.reload();
  await expect(page.locator('.coach-card')).toBeVisible();
  await page.getByLabel('Message the coach').fill('My shoulder hurts');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.locator('.notice.warn')).toContainText('stop exercising');
  await expect(page.locator('.msg.assistant:not(.pending)')).toHaveCount(2);
  await page.getByLabel('Message the coach').fill('/fail please');
  await page.getByLabel('Message the coach').press('Enter');
  await expect(page.getByRole('alert')).toContainText('Simulated');
  await page.getByRole('button', { name: 'Start now' }).first().click();
  await expect(page).toHaveURL(/#\/workout/);
  expect(errors.filter(text => !text.includes('502'))).toEqual([]);
});

test('settings: profile edits, appearance, export and full reset', async ({ page }) => {
  await onboard(page);
  await page.goto('/#/settings');
  await page.getByRole('radio', { name: 'Pounds' }).check();
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByText('Profile saved.')).toBeVisible();
  await page.getByRole('radio', { name: 'Graphite' }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup' }).click();
  expect((await download).suggestedFilename()).toMatch(/^icarus-backup-.*\.json$/);
  await page.getByRole('button', { name: 'Delete all data' }).click();
  await page.getByRole('button', { name: 'Delete everything' }).click();
  await expect(page).toHaveURL(/#\/welcome/);
});

test('accessibility basics: keyboard onboarding, named controls, no horizontal scroll on phones', async ({ page }) => {
  await chooseAudience(page, 'adults');
  await page.goto('/#/onboarding');
  await page.getByLabel('Your first name (optional)').focus();
  await page.keyboard.type('Kai');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'How experienced are you?' })).toBeVisible();
  await onboard(page);
  for (const route of ['#/today', '#/plans', '#/progress', '#/library', '#/settings', '#/coach']) {
    await page.goto('/' + route);
    await page.waitForTimeout(150);
    const unnamed = await page.evaluate(() => [...document.querySelectorAll('button, a[href], input, select, textarea')]
      .filter(node => !node.closest('[hidden]') && node.getAttribute('type') !== 'hidden')
      .filter(node => !(node.getAttribute('aria-label') || node.textContent?.trim() || node.labels?.length || node.getAttribute('placeholder')))
      .map(node => node.outerHTML.slice(0, 80)));
    expect(unnamed, route).toEqual([]);
  }
  await page.setViewportSize({ width: 375, height: 800 });
  for (const route of ['#/welcome', '#/today', '#/plans', '#/progress', '#/library', '#/settings', '#/coach']) {
    await page.goto('/' + route);
    await page.waitForTimeout(150);
    const overflow = await page.evaluate(() => ({ by: document.documentElement.scrollWidth - window.innerWidth, culprits: [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1 && !e.closest('svg')).slice(0, 3).map(e => e.className) }));
    expect(overflow.by, `${route} ${JSON.stringify(overflow.culprits)}`).toBeLessThanOrEqual(1);
  }
});

test('reduced motion: photo demonstrations hold the start frame and can be stepped manually', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#/library/goblet-squat');
  const demo = page.locator('.detail-media .demo');
  await expect(demo).toHaveAttribute('data-frame', '0');
  await expect(demo.locator('.demo-frame.f1')).toHaveCSS('opacity', '0');
  await demo.getByRole('button', { name: 'Finish' }).click();
  await expect(demo.locator('.demo-frame.f1')).toHaveCSS('opacity', '1');
});

test('README screenshots', async ({ page }) => {
  test.skip(!CAPTURE, 'Set CAPTURE_SCREENSHOTS=1 to refresh docs/screenshots');
  await mkdir(shots, { recursive: true });
  const settle = async (ms = 900) => { await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } window.scrollTo(0, 0); }); await page.waitForTimeout(ms); };
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/welcome');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${shots}/audience.png` });
  await chooseAudience(page, 'adults');
  await page.goto('/#/');
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${shots}/home.png` });
  await page.goto('/#/gyms?lat=12.97&lng=77.64&city=bengaluru&label=Indiranagar%2C+Bengaluru');
  await settle();
  await page.screenshot({ path: `${shots}/gyms.png` });
  await page.goto('/#/gyms/forge-athletic-club');
  await settle(1200);
  await page.screenshot({ path: `${shots}/gym-detail.png` });
  await page.goto('/#/coaching/complete-transformation');
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.locator('fieldset[data-field="trainerId"] .pro-card').first().click();
  await page.locator('fieldset[data-field="nutritionistId"] .pro-card').first().click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${shots}/coaching.png` });
  await page.goto('/#/library/romanian-deadlift');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${shots}/exercise.png` });
  await onboard(page);
  await page.goto('/#/today');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${shots}/today.png` });
  await page.getByRole('button', { name: /Begin session|anyway/ }).click();
  await page.getByRole('button', { name: 'Log set 1' }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${shots}/workout.png` });
  await page.goto('/#/plans');
  await page.locator('.plan-main').first().click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${shots}/plan-builder.png` });
  await page.goto('/#/coach');
  await page.getByRole('button', { name: 'Build me a 45-minute full-body session' }).click();
  await page.waitForSelector('.coach-card');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${shots}/coach.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/');
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${shots}/mobile-home.png` });
  await page.goto('/#/workout');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${shots}/mobile-workout.png` });
});
