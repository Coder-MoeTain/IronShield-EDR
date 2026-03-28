const { test, expect } = require('@playwright/test');
const { MOCK_JWT, installDashboardApiMocks } = require('./mockApi');

test.describe('dashboard smoke', () => {
  test('login page renders', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Sign in/);
    await expect(page.getByRole('heading', { name: 'IronShield' })).toBeVisible();
    await expect(page.getByPlaceholder('Username')).toBeVisible();
  });

  test('home dashboard shows Activity and SOC posture strip', async ({ page }) => {
    await installDashboardApiMocks(page);
    await page.addInitScript((token) => {
      localStorage.setItem('edr_token', token);
    }, MOCK_JWT);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('region', { name: 'SOC posture' })).toBeVisible();
    await expect(page.getByText('Online 15m: 2/3')).toBeVisible();
    await expect(page.getByText('Alert queue: 1')).toBeVisible();
  });
});
