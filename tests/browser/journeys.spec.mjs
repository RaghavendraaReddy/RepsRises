import { test, expect } from '@playwright/test';
import { chooseAudience, onboard, watchErrors } from './helpers.mjs';

// The five journeys from the product brief, run end to end against the real server.

const inDays = days => { const date = new Date(); date.setDate(date.getDate() + days); return date.toISOString().slice(0, 10); };

async function fillContact(page, name = 'Asha Rao') {
  await page.getByLabel(/name$/).first().fill(name);
  await page.getByLabel('Email').fill('asha@example.com');
  await page.getByLabel('The provider may contact me about this request.').check();
  await page.getByLabel(/I have read/).check();
}

test('Journey A: adult finds a gym by area and budget, compares 1 and 10 months, and enquires', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await chooseAudience(page, 'adults');

  // Location by typed area (no device permission needed).
  await page.getByLabel('Where do you want to train?').first().fill('Indiranagar');
  await page.getByRole('button', { name: 'Indiranagar, Bengaluru' }).first().click();
  await expect(page).toHaveURL(/#\/gyms\?.*lat=/);
  await expect(page.getByRole('status').filter({ hasText: /gyms? near Indiranagar/ })).toBeVisible();

  // Budget filter: effective monthly price up to ₹3,000.
  await page.getByLabel('Maximum monthly price').fill('3000');
  await page.getByRole('button', { name: 'Show gyms' }).click();
  await expect(page).toHaveURL(/max=3000/);
  const cards = page.locator('.gym-card');
  await expect(cards.first()).toBeVisible();
  for (const price of await page.locator('.gym-card .price .numeral').allTextContents()) expect(Number(price.replace(/[^\d.]/g, ''))).toBeLessThanOrEqual(3000);
  await expect(page.locator('.gym-card .badge.demo').first()).toHaveText('Demo listing');

  // Open the nearest gym and compare its 1-month and 10-month plans.
  await page.getByRole('link', { name: 'Forge Athletic Club' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Forge Athletic Club');
  await page.getByLabel('First plan').selectOption({ label: 'Monthly (1 month)' });
  await page.getByLabel('Second plan').selectOption({ label: '10-month (10 months)' });
  const table = page.locator('.duration-compare table');
  await expect(table.locator('thead')).toContainText('Monthly');
  await expect(table.locator('thead')).toContainText('10-month');
  await expect(table.getByRole('row', { name: /Per month/ })).toContainText('₹3,500');
  await expect(table.getByRole('row', { name: /Saving vs paying monthly/ })).toContainText('₹7,700');
  await expect(table.getByRole('row', { name: /Cancellation/ })).toBeVisible();

  // Enquire about the 10-month plan.
  await page.locator('.membership-card').filter({ hasText: '10-month' }).getByRole('link', { name: 'Enquire' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ask about this membership');
  await expect(page.locator('.enquiry-summary')).toContainText('₹27,300');
  // Validation first.
  await page.getByRole('button', { name: 'Send membership enquiry' }).click();
  await expect(page.locator('.field-error').first()).toBeVisible();
  await fillContact(page);
  await page.getByRole('button', { name: 'Send membership enquiry' }).click();

  await expect(page).toHaveURL(/#\/requests\/ICR-\d{6}-[0-9A-F]{6}/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('We have your request.');
  await expect(page.locator('.status-card')).toContainText('Received, not yet confirmed');
  await expect(page.locator('.status-card')).not.toContainText(/\bconfirmed booking\b/i);
  await expect(page.locator('.quote')).toContainText('₹27,300');
  expect(errors).toEqual([]);
});

test('Journey B: combined coaching package with team, price and an accurate booking-request confirmation', async ({ page }) => {
  const errors = watchErrors(page);
  await chooseAudience(page, 'adults');
  await page.getByRole('link', { name: 'Find My Coaching Team' }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('coaching team');
  await page.locator('.package-card').filter({ hasText: 'Complete Transformation' }).getByRole('link', { name: 'Choose this package' }).click();

  // 1. Package (preselected).
  await expect(page.getByText('Step 1 of 7 · Package')).toBeVisible();
  await expect(page.getByRole('radio', { name: /Complete Transformation/ })).toBeChecked();
  await page.getByRole('button', { name: 'Continue' }).click();
  // 2. Team: validation, then choose both professionals.
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alert').first()).toContainText('Choose a trainer');
  await page.locator('fieldset[data-field="trainerId"] .pro-card').first().click();
  await page.locator('fieldset[data-field="nutritionistId"] .pro-card').first().click();
  await expect(page.locator('.wizard-side .quote-total')).toContainText('₹');
  await page.getByRole('button', { name: 'Continue' }).click();
  // 3. Location and format.
  await page.getByRole('radio', { name: 'Online', exact: true }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  // 4. Dates.
  await page.getByLabel('Preferred start date').fill(inDays(7));
  await page.getByLabel('Preferred time of day').selectOption('morning');
  await page.getByRole('button', { name: 'Continue' }).click();
  // 5. Details.
  await fillContact(page, 'Dev Shah');
  await page.getByRole('button', { name: 'Continue' }).click();
  // 6. Review and submit.
  await expect(page.getByText('Step 6 of 7 · Review')).toBeVisible();
  const estimate = await page.locator('.wizard-main .quote-total dd').textContent();
  await expect(page.locator('.wizard-main')).toContainText('This is a booking request, not a confirmed booking.');
  await page.getByRole('button', { name: 'Send booking request' }).click();

  // 7. Confirmation states exactly what happened.
  await expect(page).toHaveURL(/#\/requests\/ICR-/);
  await expect(page.locator('.status-card')).toContainText('Received, not yet confirmed');
  await expect(page.locator('.quote-total dd')).toHaveText(estimate);
  await expect(page.getByText('This demonstration does not forward requests to real providers.')).toBeVisible();
  // The request is listed in the profile and can be withdrawn.
  await page.getByRole('link', { name: 'Your requests' }).click();
  await expect(page.locator('.profile .list-row').filter({ hasText: 'Coaching request: Complete Transformation' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Journey C: search shoulder exercises, open a demonstration, read the steps and add it to a plan', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await page.goto('/#/library');
  await page.getByLabel('Search exercises').fill('shoulder');
  const results = page.locator('.exercise-grid .exercise-card');
  await expect(results.first()).toBeVisible();
  await expect(page.locator('.exercise-grid')).toContainText('Dumbbell Shoulder Press');
  await page.getByRole('link', { name: /Dumbbell Shoulder Press/ }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Dumbbell Shoulder Press');
  // Real two-frame photo demonstration with manual controls.
  const demo = page.locator('.detail-media .demo');
  await expect(demo.locator('img.demo-frame.f0')).toHaveJSProperty('complete', true);
  expect(await demo.locator('img.demo-frame.f0').evaluate(img => img.naturalWidth)).toBeGreaterThan(300);
  await demo.getByRole('button', { name: 'Finish' }).click();
  await expect(demo).toHaveAttribute('data-frame', '1');
  await expect(page.getByRole('heading', { name: 'Step by step' })).toBeVisible();
  await expect(page.locator('.cue-list li').first()).not.toBeEmpty();
  await expect(page.getByRole('heading', { name: 'Safety' })).toBeVisible();
  await page.getByRole('button', { name: 'Add to plan' }).click();
  await page.getByRole('dialog').getByRole('button').filter({ hasText: /Day|Upper|Push|Full/ }).first().click();
  await expect(page.getByText(/^Added to /)).toBeVisible();
  // Saved exercises are kept.
  await page.locator('.exercise-detail').getByRole('button', { name: 'Save' }).click();
  await page.goto('/#/library?saved=1');
  await expect(page.locator('.exercise-grid .exercise-card')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('Journey D: begin a workout, log sets, rest, pause and resume, finish and see history', async ({ page }) => {
  const errors = watchErrors(page);
  await onboard(page);
  await page.getByRole('button', { name: /Begin session|anyway/ }).click();
  await expect(page).toHaveURL(/#\/workout/);
  await expect(page.locator('.stage-figure .demo img').first()).toBeVisible();
  await page.getByRole('button', { name: 'Log set 1' }).click();
  await expect(page.getByRole('region', { name: 'Rest timer' })).toBeVisible();
  await page.getByRole('button', { name: 'Pause workout' }).click();
  const frozen = await page.getByRole('timer').textContent();
  await page.waitForTimeout(1300);
  expect(await page.getByRole('timer').textContent()).toBe(frozen);
  await page.getByRole('dialog').getByRole('button', { name: 'Resume' }).click();
  await page.getByRole('button', { name: 'Skip rest' }).click();
  await page.getByRole('button', { name: 'Log set 2' }).click();
  // Finish early: the logged sets are saved, the rest are left out.
  await page.getByRole('button', { name: 'End workout' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save and finish' }).click();
  await expect(page).toHaveURL(/#\/summary\//);
  await page.goto('/#/progress?tab=workouts');
  await expect(page.locator('.history-row')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('Journey E (kids): supervised content only, guardian-led requests, no meal plans', async ({ page }) => {
  const errors = watchErrors(page);
  await chooseAudience(page, 'kids');
  await expect(page.getByRole('heading', { name: /Gyms for kids/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /young athletes/ })).toBeVisible();
  await expect(page.locator('.package-tile')).toHaveCount(1);
  await expect(page.locator('.program-list li')).toHaveCount(1);
  await expect(page.locator('.program-list')).toContainText('Play & Move');

  await page.goto('/#/library');
  await expect(page.locator('.exercise-grid')).not.toContainText('Barbell Back Squat');
  await page.goto('/#/nutrition');
  await expect(page.getByText('The meal organiser is for adults.')).toBeVisible();
  await expect(page.locator('.organiser')).toHaveCount(0);

  await page.goto('/#/gyms');
  for (const card of await page.locator('.gym-card .price').allTextContents()) expect(card).toMatch(/junior/i);

  await page.goto('/#/coaching/young-athlete');
  await expect(page.getByRole('radio', { name: /Young Athlete Foundations/ })).toBeChecked();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('fieldset[data-field="nutritionistId"]')).toHaveCount(0);
  await page.locator('fieldset[data-field="trainerId"] .pro-card').first().click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('radio', { name: 'Online', exact: true })).toHaveCount(0);
  await page.getByRole('radio', { name: 'In person' }).check();
  await page.getByLabel('Area for in-person sessions').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Preferred start date').fill(inDays(10));
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('a parent or guardian must make it')).toBeVisible();
  await expect(page.getByLabel('Parent or guardian’s name')).toBeVisible();
  await expect(page.getByLabel(/child.s name/i)).toHaveCount(0);
  await fillContact(page, 'Priya Menon');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('[data-field="guardian.consent"] .field-error')).toContainText('Guardian consent is required');
  await page.getByLabel('Your relationship to the child').fill('Parent');
  await page.getByLabel('Child’s age range').selectOption('8–10');
  await page.getByLabel(/I am the child’s parent or legal guardian/).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Send booking request' }).click();
  await expect(page.locator('.status-card')).toContainText('Received, not yet confirmed');
  expect(errors).toEqual([]);
});

test('Journey E (older adults): balance and mobility programme, suitable gyms and safety guidance', async ({ page }) => {
  const errors = watchErrors(page);
  await chooseAudience(page, 'older');
  await expect(page.locator('.program-list')).toContainText('Active Ageing');
  await page.goto('/#/onboarding');
  await expect(page.locator('.notice.safety')).toContainText('older adults');
  await page.getByRole('radio', { name: /All-round fitness/ }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: /^Beginner/ }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('.recommend')).toContainText('Active Ageing');
  await page.getByRole('button', { name: 'Build my programme' }).click();
  await expect(page).toHaveURL(/#\/today/);

  await page.goto('/#/gyms?accessible=1');
  await expect(page.locator('.gym-card').first()).toBeVisible();
  await page.locator('.gym-card').first().getByRole('heading').getByRole('link').click();
  await expect(page.locator('.notice.safety').last()).toContainText('doctor or physiotherapist');
  await expect(page.getByText('Step-free entrance')).toBeVisible();
  expect(errors).toEqual([]);
});

test('new pages: every control is named, no horizontal scroll on phones, menu works by keyboard', async ({ page }) => {
  await chooseAudience(page, 'adults');
  const routes = ['#/', '#/gyms', '#/gyms/forge-athletic-club', '#/memberships', '#/coaching', '#/coaching/complete-transformation', '#/pros/aarav-rao', '#/nutrition', '#/library', '#/library/plank', '#/profile', '#/privacy', '#/terms', '#/support', '#/enquire?kind=membership&gym=forge-athletic-club&plan=1m', '#/workouts'];
  for (const route of routes) {
    await page.goto('/' + route);
    await page.waitForTimeout(250);
    const unnamed = await page.evaluate(() => [...document.querySelectorAll('button, a[href], input, select, textarea')]
      .filter(node => !node.closest('[hidden], .hp') && node.getAttribute('type') !== 'hidden')
      .filter(node => !(node.getAttribute('aria-label') || node.textContent?.trim() || node.labels?.length || node.getAttribute('placeholder') || node.getAttribute('aria-hidden') === 'true' || node.getAttribute('tabindex') === '-1'))
      .map(node => node.outerHTML.slice(0, 100)));
    expect(unnamed, route).toEqual([]);
    expect(await page.locator('h1').count(), `${route} has one h1`).toBe(1);
    const broken = await page.evaluate(() => [...document.images].filter(img => img.complete && img.naturalWidth === 0 && img.getAttribute('src')).map(img => img.src));
    expect(broken, `${route} images`).toEqual([]);
  }
  await page.setViewportSize({ width: 375, height: 800 });
  for (const route of routes) {
    await page.goto('/' + route);
    await page.waitForTimeout(250);
    const overflow = await page.evaluate(() => ({ by: document.documentElement.scrollWidth - window.innerWidth, culprits: [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1 && !e.closest('svg, .table-wrap, .wizard-steps, .gallery-thumbs, .organiser-grid')).slice(0, 3).map(e => e.className) }));
    expect(overflow.by, `${route} ${JSON.stringify(overflow.culprits)}`).toBeLessThanOrEqual(1);
  }
  // Mobile menu: opens, traps focus in a modal dialog, closes with Escape and returns focus.
  await page.goto('/#/');
  await page.getByRole('button', { name: 'Open menu' }).click();
  const menu = page.getByRole('dialog', { name: 'Menu' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('link', { name: /Discover Gyms/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open menu' })).toBeFocused();
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('dialog', { name: 'Menu' }).getByRole('link', { name: /Nutrition/ }).click();
  await expect(page).toHaveURL(/#\/nutrition/);
});

test('location permission: declined device location falls back to typed search', async ({ page, context }) => {
  await context.clearPermissions();
  await chooseAudience(page, 'adults');
  await page.goto('/#/gyms');
  await page.locator('.gyms-location').getByRole('button', { name: 'Use my location' }).click();
  await expect(page.getByRole('dialog', { name: 'Use your current location?' })).toContainText('Rounded to about 1 km');
  await page.getByRole('button', { name: 'Not now' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  // Granted location is rounded before use.
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 19.0596123, longitude: 72.8295456 });
  await page.locator('.gyms-location').getByRole('button', { name: 'Use my location' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/lat=19\.06&lng=72\.83/);
  await expect(page.getByRole('status').filter({ hasText: /near Near you, Mumbai/ })).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('icarus.v1.marketplace')).location);
  expect(stored).toMatchObject({ lat: 19.06, lng: 72.83, source: 'device' });
});
