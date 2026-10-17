import { expect } from '@playwright/test';

// Shared steps for browser tests.

export async function chooseAudience(page, audience = 'adults') {
  await page.goto('/#/welcome');
  await page.locator(`input[name="audience"][value="${audience}"]`).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).not.toHaveURL(/#\/welcome/);
}

export async function onboard(page, { days = '7' } = {}) {
  await chooseAudience(page, 'adults');
  await page.goto('/#/onboarding');
  await page.getByLabel('Your first name (optional)').fill('Alex');
  await page.getByRole('radio', { name: /Build muscle/ }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: /^Intermediate/ }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Home with dumbbells' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: days, exact: true }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Build my programme' }).click();
  await expect(page).toHaveURL(/#\/today/);
}

export function watchErrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  return errors;
}
