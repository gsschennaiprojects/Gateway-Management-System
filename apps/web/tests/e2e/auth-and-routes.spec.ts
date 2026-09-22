import { test, expect } from '@playwright/test';

test.describe('Authentication & Dashboard Routes Flow', () => {
  test('Super Admin login and core route navigation', async ({ page }) => {
    // 1. Visit Login Page
    await page.goto('/login');
    await expect(page).toHaveTitle(/GSS Management System/i);

    // 2. Fill Super Admin credentials
    await page.fill('input[type="email"], input[type="text"]', 'gateway.managercbe@gmail.com');
    await page.fill('input[type="password"]', 'GatewaySS@2013#');
    await page.click('button[type="submit"]');

    // 3. Verify successful redirection past login
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
    expect(page.url()).not.toContain('/login');

    // 4. Test Navigation across core pages
    const routesToTest = [
      '/dashboard',
      '/worklog',
      '/my-students',
      '/students',
      '/tasks',
      '/admin/directory',
      '/admin/attendance',
      '/leads',
      '/reports',
      '/admin/users',
      '/account',
    ];

    for (const route of routesToTest) {
      await page.goto(route);
      await expect(page.locator('body')).toBeVisible();
      // Ensure page does not crash or show 404
      await expect(page.locator('text=404')).not.toBeVisible();
    }
  });
});
