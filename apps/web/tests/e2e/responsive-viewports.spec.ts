import { test, expect } from '@playwright/test';

test.describe('Responsive Viewports & Action Toolbars', () => {
  test('Mobile viewport (375x667) renders navigation and cards properly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/help');
    await expect(page.locator('text=GSS Help & Knowledge Center')).toBeVisible();

    // Check that cards stack without horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(385); // Allow minor margin
  });

  test('Tablet viewport (768x1024) renders cleanly', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/privacy');
    await expect(page.locator('text=Gateway Software Solutions Privacy Policy')).toBeVisible();

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(778);
  });
});
