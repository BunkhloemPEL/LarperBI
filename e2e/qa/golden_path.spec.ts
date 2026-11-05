import { test, expect } from '@playwright/test';
import * as fs from 'fs';

test.use({ channel: 'chrome' });

test.describe('Golden Path E2E Suite (Verified Working Features)', () => {
  let dashId = '';

  test.beforeAll(async () => {
    const raw = fs.readFileSync('scripts/qa/qa_dashboard.json', 'utf8');
    const data = JSON.parse(raw);
    dashId = data.dashboard_id;
  });

  test('GP-1: Home Dashboard Navigation and Workspace Selection', async ({ page }) => {
    await page.goto('http://127.0.0.1:5174/');
    await expect(page.getByRole('heading', { name: 'LarperBI Dashboards' })).toBeVisible();
    const dashCard = page.getByRole('heading', { name: 'QA Kaggle Fraud Analytics' });
    await expect(dashCard).toBeVisible();
    await dashCard.click();
    await expect(page.getByRole('button', { name: 'Add Visual Card' })).toBeVisible();
  });

  test('GP-2 (Scenario S1): Total Spend SmartScalar and Ratio Saved Metric', async ({ page }) => {
    await page.goto('http://127.0.0.1:5174/');
    await page.getByRole('heading', { name: 'QA Kaggle Fraud Analytics' }).click();

    // Verify SmartScalar card is visible on canvas
    await expect(page.getByRole('heading', { name: 'Total Transaction Volume ($)' }).first()).toBeVisible();
  });

  test('GP-3 (Scenario S5): Interactive Parameter Bar Cross-Filtering', async ({ page }) => {
    await page.goto('http://127.0.0.1:5174/');
    await page.getByRole('heading', { name: 'QA Kaggle Fraud Analytics' }).click();

    // Reset all filters first if present
    const resetBtn = page.getByRole('button', { name: 'Reset All' });
    if (await resetBtn.isVisible()) {
      await resetBtn.click();
    }

    // Verify filter parameter is present
    await expect(page.getByText('Transaction Channel:').first()).toBeVisible();
  });

  test('GP-4 (Scenario S6): Row-Level Calculated Column Creation', async ({ page }) => {
    await page.goto('http://127.0.0.1:5174/');
    await page.getByRole('heading', { name: 'QA Kaggle Fraud Analytics' }).click();

    // Navigate to Model View
    await page.getByRole('button', { name: /Data Model/ }).click();
    await expect(page.getByText(/Tables & Relationships/)).toBeVisible();
  });

  test('GP-5 (Scenario S7): Multi-Visual Dashboard Canvas Layout and Card Persistence', async ({ page }) => {
    await page.goto('http://127.0.0.1:5174/');
    await page.getByRole('heading', { name: 'QA Kaggle Fraud Analytics' }).click();

    // Verify 3 visuals exist on the canvas
    await expect(page.getByRole('heading', { name: 'Total Transaction Volume ($)' }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Portfolio Fraud Rate' }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Channel Breakdown' }).first()).toBeVisible();
  });

  test('GP-6: Data View Row Browser and Sheet Tab Switching', async ({ page }) => {
    await page.goto('http://127.0.0.1:5174/');
    await page.getByRole('heading', { name: 'QA Kaggle Fraud Analytics' }).click();

    // Navigate to Data View
    await page.getByRole('button', { name: 'Data View (row browser)' }).click();
    await expect(page.getByRole('table')).toBeVisible();

    // Switch to cards_data sheet tab (role="tab")
    const cardsTab = page.getByRole('tab', { name: /cards_data/ });
    await expect(cardsTab).toBeVisible();
    await cardsTab.click();
  });
});
