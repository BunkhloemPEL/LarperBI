import { test, expect } from '@playwright/test';
import * as fs from 'fs';

test.use({ channel: 'chrome' });

test.describe('Milestone 1 Verified Features Suite', () => {
  let dashId = '';

  test.beforeAll(async () => {
    const raw = fs.readFileSync('scripts/qa/qa_dashboard.json', 'utf8');
    const data = JSON.parse(raw);
    dashId = data.dashboard_id;
  });

  test('VERIFIED: B-001 JSON Lookup Table Ingestion (mcc_codes.json)', async ({ page }) => {
    // Post mcc_codes.json to inspect endpoint
    const inspectRes = await page.request.post(`http://127.0.0.1:8001/api/v1/dashboards/${dashId}/upload/inspect`, {
      multipart: {
        file: {
          name: 'mcc_codes.json',
          mimeType: 'application/json',
          buffer: fs.readFileSync('archive/mcc_codes.json'),
        },
      },
    });
    expect(inspectRes.status()).toBe(200);
    const body = await inspectRes.json();
    expect(body.sheets[0].name).toBe('JSON');
    expect(body.sheets[0].columns).toContain('code');
    expect(body.sheets[0].columns).toContain('description');
  });

  test('VERIFIED: B-002 Timestamp Datetime Profiling and Date Bucketing', async ({ page }) => {
    await page.goto(`http://127.0.0.1:5174/#/dashboard/${dashId}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Add Visual Card' }).click();
    await page.getByRole('button', { name: /Line \/ Area/ }).click();

    // Select the newly profiled transactions table with date column
    // Dimension select combobox
    const dimSelect = page.getByRole('combobox').nth(1);
    const options = await dimSelect.locator('option').allTextContents();
    const hasDateCol = options.some(opt => opt.includes('date'));
    expect(hasDateCol).toBe(true);

    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('VERIFIED: B-003 Star-Schema Joined Table Columns in Card Builder', async ({ page }) => {
    await page.goto(`http://127.0.0.1:5174/#/dashboard/${dashId}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Add Visual Card' }).click();
    await page.getByRole('button', { name: /Bar Chart/ }).click();

    // Verify dimension select contains joined table optgroups
    const dimSelect = page.getByRole('combobox').nth(1);
    const options = await dimSelect.locator('option').allTextContents();

    // S3: category_name from linked mcc_codes table must be present!
    expect(options.some(opt => opt.includes('category_name'))).toBe(true);
    // S4: card_brand from linked cards_data table must be present!
    expect(options.some(opt => opt.includes('card_brand'))).toBe(true);

    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('VERIFIED: B-004 URL Hash Routing and Reload Survival', async ({ page }) => {
    await page.goto(`http://127.0.0.1:5174/#/dashboard/${dashId}`);
    await page.waitForLoadState('networkidle');

    // Canvas should load directly without dropping back to home list
    await expect(page.getByRole('button', { name: 'Add Visual Card' })).toBeVisible();

    // Browser reload
    await page.reload();
    await page.waitForLoadState('networkidle');

    // URL should retain hash and canvas should remain loaded!
    expect(page.url()).toContain(`#/dashboard/${dashId}`);
    await expect(page.getByRole('button', { name: 'Add Visual Card' })).toBeVisible();
  });

  test('VERIFIED: B-007 Accessible Filter Parameter Pills', async ({ page }) => {
    await page.goto(`http://127.0.0.1:5174/#/dashboard/${dashId}`);
    await page.waitForLoadState('networkidle');

    // Filter pill must be an accessible button element
    const pillBtn = page.getByRole('button', { name: /Transaction Channel/ }).first();
    await expect(pillBtn).toBeVisible();
    await pillBtn.click();

    // Popover dialog must open
    await expect(page.getByText('Online Transaction')).toBeVisible();
  });
});
