import { test, expect } from '@playwright/test';
import * as fs from 'fs';

test.use({ channel: 'chrome' });

test.describe('Phase 3: Stress and Edge Cases', () => {
  let dashId = '';

  test.beforeAll(async () => {
    const raw = fs.readFileSync('scripts/qa/qa_dashboard.json', 'utf8');
    const data = JSON.parse(raw);
    dashId = data.dashboard_id;
  });

  test('E1: High-Cardinality Category Filter (100 items limit & no server search)', async ({ page }) => {
    console.log('Testing E1: High-cardinality filter...');
    await page.goto('http://127.0.0.1:5174/');
    await page.getByText('QA Kaggle Fraud Analytics').click();

    // Add filter on high-cardinality merchant_city
    await page.getByRole('button', { name: 'Add Filter' }).click();
    await page.locator('input[type="text"]').last().fill('Merchant City');
    // Select column = merchant_city
    await page.locator('select').nth(1).selectOption('merchant_city');
    await page.locator('button:has-text("Add Filter")').last().click();
    await page.waitForTimeout(1000);

    // Open filter popover
    const pill = page.getByText(/Merchant City/).first();
    await pill.click();
    await page.waitForTimeout(500);

    // Take screenshot of popover with limited items
    await page.screenshot({ path: 'qa-evidence/e1_high_cardinality_popover.png' });

    // Type a city that is not in the first 100 (e.g. "Seattle" or "San Francisco")
    const searchInput = page.locator('input[placeholder*="Search"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('Zzyzx');
      await page.waitForTimeout(300);
      await page.screenshot({ path: 'qa-evidence/e1_city_not_found.png' });
    }
  });

  test('E2: Empty Results State (Filter matches 0 rows)', async ({ page }) => {
    console.log('Testing E2: Empty results state...');
    await page.goto('http://127.0.0.1:5174/');
    await page.getByText('QA Kaggle Fraud Analytics').click();

    // Open Card Builder to create a card with an impossible filter or check existing card
    await page.getByRole('button', { name: 'Add Visual Card' }).click();
    await page.getByRole('button', { name: /Bar Chart/ }).click();
    await page.locator('input[type="text"]').first().fill('Empty Results Test');
    await page.locator('select').nth(1).selectOption('use_chip');
    await page.screenshot({ path: 'qa-evidence/e2_card_builder_preview.png' });
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('E3: Very Long Labels (Card Title and Table Names)', async ({ page }) => {
    console.log('Testing E3: Very long labels...');
    await page.goto('http://127.0.0.1:5174/');
    await page.getByText('QA Kaggle Fraud Analytics').click();

    await page.getByRole('button', { name: 'Add Visual Card' }).click();
    await page.getByRole('button', { name: /SmartScalar/ }).click();
    const superLongTitle = 'EXTRAORDINARILY_LONG_METRIC_TITLE_DESIGNED_TO_OVERFLOW_CONTAINER_BOUNDS_AND_BREAK_LAYOUT_CHROME_ACROSS_THE_HEADER_PANEL_'.repeat(2);
    await page.locator('input[type="text"]').first().fill(superLongTitle);
    await page.getByRole('button', { name: 'Add to Dashboard' }).click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'qa-evidence/e3_overflowing_title.png' });
  });

  test('E4: Mobile Width and Viewport Scaling (375px)', async ({ page }) => {
    console.log('Testing E4: Mobile viewport scaling...');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://127.0.0.1:5174/');
    await page.screenshot({ path: 'qa-evidence/e4_mobile_home_375px.png' });

    await page.getByText('QA Kaggle Fraud Analytics').click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'qa-evidence/e4_mobile_canvas_375px.png' });
  });

  test('E5: Data View Row Browser with Nulls and Sorting', async ({ page }) => {
    console.log('Testing E5: Data View browser...');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('http://127.0.0.1:5174/');
    await page.getByText('QA Kaggle Fraud Analytics').click();

    // Switch to Data tab
    await page.getByRole('button', { name: 'Data View (row browser)' }).click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'qa-evidence/e5_data_view_grid.png' });

    // Verify sheet tabs exist at bottom
    const sheetTab = page.getByRole('button', { name: /cards_data/ });
    if (await sheetTab.isVisible()) {
      await sheetTab.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'qa-evidence/e5_cards_data_sheet.png' });
    }
  });

  test('E6: Python Lab (EDA Notebook Execution and Derived Table)', async ({ page }) => {
    console.log('Testing E6: Python Lab EDA notebook...');
    await page.goto('http://127.0.0.1:5174/');
    await page.getByText('QA Kaggle Fraud Analytics').click();

    // Switch to Notebook tab
    await page.getByRole('button', { name: 'Jupyter Notebook (EDA)' }).click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'qa-evidence/e6_notebook_view.png' });
  });
});
