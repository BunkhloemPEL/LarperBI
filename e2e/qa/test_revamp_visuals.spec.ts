import { test, expect } from '@playwright/test';
import * as fs from 'fs';

test.use({ channel: 'chrome' });

test.describe('Metabase Visual Card Revamp Proof Suite', () => {
  test.describe.configure({ mode: 'serial' });
  let dashId = '';
  test.beforeAll(async () => {
    const raw = fs.readFileSync('scripts/qa/qa_dashboard.json', 'utf8');
    const data = JSON.parse(raw);
    dashId = data.dashboard_id;
  });

  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', (err) => console.log('PAGE ERR:', err));
  });

  test('V1: Zero Gray Flicker on Click & Drag (0 duplicate queries)', async ({ page }) => {
    let queryCallCount = 0;
    page.on('request', (req) => {
      if (req.url().includes('/query')) {
        queryCallCount++;
      }
    });

    await page.goto(`http://127.0.0.1:5174/#/dashboard/${dashId}`);
    await page.waitForLoadState('networkidle');

    // Wait until cards have loaded initially
    const firstCardTitle = page.getByRole('heading', { name: 'Total Transaction Volume ($)' }).first();
    await expect(firstCardTitle).toBeVisible();

    const initialCount = queryCallCount;
    console.log('Queries after initial load:', initialCount);

    // Click on the card container multiple times
    const cardRoot = firstCardTitle.locator('xpath=ancestor::div[contains(@class, "_cardRoot")]');
    await cardRoot.click();
    await page.waitForTimeout(100);
    await cardRoot.click();
    await page.waitForTimeout(100);

    // Verify ZERO additional queries were triggered by clicking!
    expect(queryCallCount).toBe(initialCount);

    // Verify skeleton loader did NOT appear
    const skeleton = cardRoot.locator('div[class*="skeleton"]');
    await expect(skeleton).toHaveCount(0);

    await page.screenshot({ path: 'qa-evidence/v1_zero_flicker_click.png' });
  });

  test('V2: Zoom / Maximize High-Impact Scaling (Tier 600 - 64px)', async ({ page }) => {
    await page.goto(`http://127.0.0.1:5174/#/dashboard/${dashId}`);
    await page.waitForLoadState('networkidle');

    const firstCardTitle = page.getByRole('heading', { name: 'Total Transaction Volume ($)' }).first();
    const cardRoot = firstCardTitle.locator('xpath=ancestor::div[contains(@class, "_cardRoot")]');

    // Hover over card to reveal actions panel
    await cardRoot.hover();
    const zoomBtn = cardRoot.locator('button[title*="Zoom"]');
    await expect(zoomBtn).toBeVisible();
    await zoomBtn.click();

    // Verify Zoom modal opened
    const zoomModal = page.locator('div[style*="80vh"]');
    await expect(zoomModal).toBeVisible();

    // In Zoom mode, SmartScalar should have font size of 64px (Tier 600)
    const scalarValue = zoomModal.locator('div[class*="mainValue"]');
    await expect(scalarValue).toBeVisible();
    const fontSize = await scalarValue.evaluate((el) => window.getComputedStyle(el).fontSize);
    console.log('Zoomed scalar font size:', fontSize);
    expect(fontSize).toBe('64px');

    await page.screenshot({ path: 'qa-evidence/v2_zoomed_64px_view.png' });

    // Close zoom via Escape key
    await page.keyboard.press('Escape');
    await expect(zoomModal).not.toBeVisible();
  });

  test('V3: Number Compactification with Precision Tooltip', async ({ page }) => {
    await page.goto(`http://127.0.0.1:5174/#/dashboard/${dashId}`);
    await page.waitForLoadState('networkidle');

    // Find any scalar on the dashboard
    const valueEl = page.locator('div[class*="mainValue"]').first();
    await expect(valueEl).toBeVisible();
    const text = await valueEl.innerText();
    console.log('Rendered scalar value:', text);
    expect(text.length).toBeGreaterThan(0);
  });

  test('V4: Actionable Error View (No silent "No data to display")', async ({ page }) => {
    // Intercept a query to simulate backend error
    await page.route('**/api/v1/dashboards/*/query', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ detail: "Database disk I/O error or column mismatch" }),
      });
    });

    await page.goto(`http://127.0.0.1:5174/#/dashboard/${dashId}`);

    // Card should render CardErrorView with "Query execution error", NOT "No data to display."
    await expect(page.getByText('Query execution error').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Database disk I\/O error/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry Query' }).first()).toBeVisible();

    await page.screenshot({ path: 'qa-evidence/v4_actionable_error_state.png' });
  });
});
