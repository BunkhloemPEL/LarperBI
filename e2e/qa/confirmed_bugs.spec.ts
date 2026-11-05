import { test, expect } from '@playwright/test';
import * as fs from 'fs';

test.use({ channel: 'chrome' });

test.describe('Confirmed Bugs and Gaps Suite (test.fail)', () => {
  let dashId = '';

  test.beforeAll(async () => {
    const raw = fs.readFileSync('scripts/qa/qa_dashboard.json', 'utf8');
    const data = JSON.parse(raw);
    dashId = data.dashboard_id;
  });

  test('B-001 [bug] Ingestion rejects reference JSON files (.json)', async ({ page }) => {
    test.fail(true, 'LarperBI backend rejects .json files with 400 Unsupported file type');

    await page.goto('http://127.0.0.1:5174/');
    await page.getByRole('heading', { name: 'QA Kaggle Fraud Analytics' }).click();

    // Attempting to upload mcc_codes.json should succeed
    const res = await page.request.post(`http://127.0.0.1:8001/api/v1/dashboards/${dashId}/upload/inspect`, {
      multipart: {
        file: {
          name: 'mcc_codes.json',
          mimeType: 'application/json',
          buffer: fs.readFileSync('archive/mcc_codes.json'),
        },
      },
    });

    // Should accept JSON reference files (currently fails with 400)
    expect(res.status()).toBe(200);
  });

  test('B-002 [bug] Date grain selector missing for timestamp string date columns', async ({ page }) => {
    test.fail(true, 'date column is classified as dimension instead of date, hiding date bucket selector');

    await page.goto('http://127.0.0.1:5174/');
    await page.getByRole('heading', { name: 'QA Kaggle Fraud Analytics' }).click();

    await page.getByRole('button', { name: 'Add Visual Card' }).click();
    await page.getByRole('button', { name: /Line \/ Area/ }).click();

    // Select date dimension
    await page.getByRole('combobox').nth(1).selectOption('date');

    // Expected: Date Bucket selector should be visible for timestamp date column
    await expect(page.getByText('Date Bucket:')).toBeVisible({ timeout: 3000 });
  });

  test('B-003 [missing] Card Builder does not expose joined table columns in dimension picker', async ({ page }) => {
    test.fail(true, 'CardBuilderModal only lists primary table columns, omitting joined table columns');

    await page.goto('http://127.0.0.1:5174/');
    await page.getByRole('heading', { name: 'QA Kaggle Fraud Analytics' }).click();

    await page.getByRole('button', { name: 'Add Visual Card' }).click();
    await page.getByRole('button', { name: /Bar Chart/ }).click();

    // Dimension select combobox
    const dimSelect = page.getByRole('combobox').nth(1);
    const options = await dimSelect.locator('option').allTextContents();

    // Expected: category_name from linked mcc_codes table should be available
    expect(options.some((opt) => opt.includes('category_name'))).toBe(true);
  });

  test('B-004 [missing] URL deep linking missing, page reload resets active dashboard', async ({ page }) => {
    test.fail(true, 'No URL routing in App.tsx; reload resets activeDashboardId to null');

    await page.goto('http://127.0.0.1:5174/');
    await page.getByRole('heading', { name: 'QA Kaggle Fraud Analytics' }).click();

    // URL should reflect dashboard ID
    expect(page.url()).toContain(`dashboard`);

    // Reloading should preserve the active dashboard view
    await page.reload();
    await expect(page.getByRole('button', { name: 'Add Visual Card' })).toBeVisible({ timeout: 3000 });
  });

  test('B-005 [friction] Category filter parameter popover limited to 100 values without search', async ({ page }) => {
    test.fail(true, 'Distinct values API hardcodes head(100), preventing search for non-top-100 values');

    const res = await page.request.get(
      `http://127.0.0.1:8001/api/v1/dashboards/${dashId}/tables/tbl_ce8b3a55/columns/merchant_city/distinct`
    );
    expect(res.status()).toBe(200);
    const body = await res.json();

    // merchant_city has thousands of unique values; expecting full/paginated search capability, not hardcapped 100
    expect(body.distinct_values.length).toBeGreaterThan(100);
  });

  test('B-007 [friction] Filter parameter pills are unsemantic divs lacking role button', async ({ page }) => {
    test.fail(true, 'ParameterWidget pill is rendered as a div without role="button" or keyboard accessibility');

    await page.goto('http://127.0.0.1:5174/');
    await page.getByRole('heading', { name: 'QA Kaggle Fraud Analytics' }).click();

    // Filter pill should be accessible as a button
    const pillBtn = page.getByRole('button', { name: /Transaction Channel/ });
    await expect(pillBtn).toBeVisible({ timeout: 3000 });
  });
});
