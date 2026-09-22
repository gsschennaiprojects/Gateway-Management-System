import { test, expect } from '@playwright/test';

test.describe('Legal, Support & Help Center Pages', () => {
  test('Help Center loads with FAQs and branch support directory', async ({ page }) => {
    await page.goto('/help');
    await expect(page.locator('text=GSS Help & Knowledge Center')).toBeVisible();
    await expect(page.locator('text=Frequently Asked Questions')).toBeVisible();

    // Verify FAQ accordion click
    const firstFaq = page.locator('button:has-text("attendance recorded")');
    if (await firstFaq.isVisible()) {
      await firstFaq.click();
    }

    // Verify branch contacts
    await expect(page.locator('text=Coimbatore Head Office')).toBeVisible();
    await expect(page.locator('text=Chennai Tech Center')).toBeVisible();
  });

  test('Privacy Policy loads with role-scoped governance', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.locator('text=Gateway Software Solutions Privacy Policy')).toBeVisible();
    await expect(page.locator('text=Role-Scoped Privacy')).toBeVisible();
  });

  test('Terms of Service loads with acceptable use guidelines', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.locator('text=Gateway Software Solutions Terms of Service')).toBeVisible();
    await expect(page.locator('text=Authorized Use Only')).toBeVisible();
  });
});
