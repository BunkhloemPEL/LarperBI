import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.use({ channel: 'chrome' });

// Ensure qa-evidence directory exists
const evidenceDir = path.resolve('qa-evidence');
if (!fs.existsSync(evidenceDir)) {
  fs.mkdirSync(evidenceDir, { recursive: true });
}

test.describe('LarperBI End-to-End QA Scenarios', () => {
  let dashId = '';

  test.beforeAll(async () => {
    const raw = fs.readFileSync('scripts/qa/qa_dashboard.json', 'utf8');
    const data = JSON.parse(raw);
    dashId = data.dashboard_id;
  });

  test('P1 & S1: Onboarding and Fraud Overview KPIs', async ({ page }) => {
    console.log('Testing P1 & S1...');
    await page.goto('http://127.0.0.1:5174/');
    await page.waitForLoadState('networkidle');

    // Click on QA dashboard
    const dashCard = page.getByText('QA Kaggle Fraud Analytics');
    await expect(dashCard).toBeVisible();
    await page.screenshot({ path: 'qa-evidence/p1_dashboard_list.png' });
    await dashCard.click();

    // Verify Canvas loaded
    await expect(page.getByRole('button', { name: 'Add Visual Card' })).toBeVisible();
    await page.screenshot({ path: 'qa-evidence/p1_canvas_empty.png' });

    // Step 1: Create Total Spend SmartScalar
    await page.getByRole('button', { name: 'Add Visual Card' }).click();
    await expect(page.getByText('Visual Card Builder')).toBeVisible();

    // Select SmartScalar
    await page.getByRole('button', { name: /SmartScalar/ }).click();
    // Select Measure = amount
    const measSelect = page.locator('select').nth(2); // table, dim, meas
    // Fill title
    const titleInput = page.locator('input[type="text"]').first();
    await titleInput.fill('Total Transaction Volume ($)');

    // Add to Dashboard
    await page.getByRole('button', { name: 'Add to Dashboard' }).click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'qa-evidence/s1_total_spend_card.png' });

    // Step 2: Navigate to Model view to create Fraud Rate metric
    await page.getByRole('button', { name: /Data Model/ }).click();
    await expect(page.getByText(/Tables & Relationships/)).toBeVisible();
    await page.screenshot({ path: 'qa-evidence/s1_model_view.png' });

    // Switch to Saved Metrics sub-tab
    await page.getByRole('button', { name: /Saved Metrics/ }).click();
    await page.screenshot({ path: 'qa-evidence/s1_saved_metrics_tab.png' });

    // Click New Metric
    await page.getByRole('button', { name: /Define New Metric/ }).click();
    // Configure Ratio Metric: sum(is_fraud) / count(is_fraud) * 100
    await page.locator('input[placeholder*="Fraud Loss Rate"]').fill('Fraud Rate (%)');
    // Formula Type: click Ratio / Rate button
    await page.getByRole('button', { name: 'Ratio / Rate' }).click();
    // Select Numerator Column = is_fraud
    await page.locator('select').nth(1).selectOption('is_fraud');
    // Select Denominator Column = is_fraud
    await page.locator('select').nth(3).selectOption('is_fraud');
    // Format = percentage (select index 5)
    await page.locator('select').nth(5).selectOption('percentage');

    await page.screenshot({ path: 'qa-evidence/s1_create_metric_modal.png' });
    await page.getByRole('button', { name: 'Save Metric' }).click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'qa-evidence/s1_metric_created.png' });

    // Return to Canvas
    await page.getByRole('button', { name: 'Dashboard Canvas' }).click();
    await expect(page.getByRole('button', { name: 'Add Visual Card' })).toBeVisible();

    // Create Fraud Rate Card using Saved Metric
    await page.getByRole('button', { name: 'Add Visual Card' }).click();
    await page.getByRole('button', { name: /SmartScalar/ }).click();
    await titleInput.fill('Portfolio Fraud Rate');
    // Select Saved Metric pill/button
    const metricPill = page.getByRole('button', { name: /Fraud Rate/ });
    if (await metricPill.isVisible()) {
      await metricPill.click();
    }
    await page.screenshot({ path: 'qa-evidence/s1_card_builder_metric.png' });
    await page.getByRole('button', { name: 'Add to Dashboard' }).click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'qa-evidence/s1_fraud_overview_complete.png' });
  });

  test('S2: Spend Trend by Month and Year (Date Grain Gap)', async ({ page }) => {
    console.log('Testing S2...');
    await page.goto('http://127.0.0.1:5174/');
    await page.getByText('QA Kaggle Fraud Analytics').click();

    // Open Card Builder
    await page.getByRole('button', { name: 'Add Visual Card' }).click();
    await page.getByRole('button', { name: 'Area Chart' }).click();

    // Fill title
    await page.locator('input[type="text"]').first().fill('Monthly Spend Trajectory');

    // Select Dimension = date
    const dimSelect = page.locator('select').nth(1);
    await dimSelect.selectOption('date');

    await page.screenshot({ path: 'qa-evidence/s2_date_dimension_selected.png' });

    // Check if Date Bucket selector appears
    const dateBucket = page.getByText('Date Bucket:');
    const isBucketVisible = await dateBucket.isVisible();
    console.log('S2 Date Bucket visible?', isBucketVisible);

    // Capture evidence of gap: date is treated as raw string dimension without bucketing
    await page.screenshot({ path: 'qa-evidence/s2_date_grain_missing.png' });

    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('S3: Top 10 Merchant Categories (Cross-Table Join Gap in Builder)', async ({ page }) => {
    console.log('Testing S3...');
    await page.goto('http://127.0.0.1:5174/');
    await page.getByText('QA Kaggle Fraud Analytics').click();

    await page.getByRole('button', { name: 'Add Visual Card' }).click();
    await page.getByRole('button', { name: 'Bar Chart' }).click();

    // Inspect available dimensions for transactions_100k
    const dimSelect = page.locator('select').nth(1);
    const options = await dimSelect.locator('option').allTextContents();
    console.log('Available dimensions in transactions table:', options);

    const hasMccCategory = options.some(opt => opt.includes('category_name'));
    console.log('S3 has category_name in transactions picker?', hasMccCategory);

    await page.screenshot({ path: 'qa-evidence/s3_joined_columns_missing.png' });

    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('S4: Fraud Rate by Card Brand / Type (Join to Cards Gap)', async ({ page }) => {
    console.log('Testing S4...');
    await page.goto('http://127.0.0.1:5174/');
    await page.getByText('QA Kaggle Fraud Analytics').click();

    await page.getByRole('button', { name: 'Add Visual Card' }).click();
    await page.getByRole('button', { name: /Donut/ }).click();

    // Inspect available dimensions
    const dimSelect = page.locator('select').nth(1);
    const options = await dimSelect.locator('option').allTextContents();
    const hasCardBrand = options.some(opt => opt.includes('card_brand'));
    const hasCardType = options.some(opt => opt.includes('card_type'));
    console.log('S4 has card_brand/type in transactions picker?', hasCardBrand, hasCardType);

    await page.screenshot({ path: 'qa-evidence/s4_card_brand_missing.png' });
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('S5: Interactive Filtering & Parameter Bar', async ({ page }) => {
    console.log('Testing S5...');
    await page.goto('http://127.0.0.1:5174/');
    await page.getByText('QA Kaggle Fraud Analytics').click();

    // Add filter on use_chip
    await page.getByRole('button', { name: 'Add Filter' }).click();
    await page.screenshot({ path: 'qa-evidence/s5_add_filter_modal.png' });
    await page.locator('input[type="text"]').last().fill('Transaction Channel');
    // Select column = use_chip
    await page.locator('select').nth(1).selectOption('use_chip');
    await page.locator('button:has-text("Add Filter")').last().click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'qa-evidence/s5_filter_pill_rendered.png' });

    // Click filter pill to open popover (pill is a div, not button role)
    const pill = page.getByText(/Transaction Channel/).first();
    await expect(pill).toBeVisible();
    await pill.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'qa-evidence/s5_filter_popover_open.png' });

    // Select Online Transaction
    const onlineOption = page.getByText('Online Transaction');
    if (await onlineOption.isVisible()) {
      await onlineOption.click();
      await page.screenshot({ path: 'qa-evidence/s5_filter_applied.png' });
    }

    // Reset filter
    const resetBtn = page.getByRole('button', { name: 'Reset' });
    if (await resetBtn.isVisible()) {
      await resetBtn.click();
      await page.screenshot({ path: 'qa-evidence/s5_filter_reset.png' });
    }
  });

  test('S6: Customer View & Age / Income Band (Join to Users Gap)', async ({ page }) => {
    console.log('Testing S6...');
    await page.goto('http://127.0.0.1:5174/');
    await page.getByText('QA Kaggle Fraud Analytics').click();

    // Navigate to Model View to check if calculated column can bin ages
    await page.getByRole('button', { name: /Data Model/ }).click();
    await page.screenshot({ path: 'qa-evidence/s6_model_view_users.png' });

    // Click + Column on users_data card
    const addColBtns = page.getByRole('button', { name: '+ Column' });
    if (await addColBtns.count() > 0) {
      // Users is 3rd table
      await addColBtns.nth(2).click();
      await page.screenshot({ path: 'qa-evidence/s6_add_column_modal.png' });
      // Try to create age band expression: current_age / 10
      await page.locator('input[placeholder="e.g. margin, total_price"]').fill('age_decade');
      await page.locator('input[placeholder="e.g. price * quantity, abs(profit)"]').fill('current_age / 10');
      await page.getByRole('button', { name: 'Save Column' }).click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'qa-evidence/s6_column_created.png' });
    }

    // Return to Canvas
    await page.getByRole('button', { name: 'Dashboard Canvas' }).click();
  });

  test('S7: Multi-visual Layout, Auto-Layout, Persistence and Reload', async ({ page }) => {
    console.log('Testing S7...');
    await page.goto('http://127.0.0.1:5174/');
    await page.getByText('QA Kaggle Fraud Analytics').click();

    // Create a 3rd card: Donut of use_chip
    await page.getByRole('button', { name: 'Add Visual Card' }).click();
    await page.getByRole('button', { name: /Donut/ }).click();
    await page.locator('input[type="text"]').first().fill('Channel Breakdown');
    await page.locator('select').nth(1).selectOption('use_chip');
    await page.getByRole('button', { name: 'Add to Dashboard' }).click();
    await page.waitForTimeout(1000);

    // Screenshot with 3 visuals
    await page.screenshot({ path: 'qa-evidence/s7_three_visuals_canvas.png' });

    // Test Auto Layout
    const autoLayoutBtn = page.getByRole('button', { name: 'Auto Layout' });
    if (await autoLayoutBtn.isVisible()) {
      await autoLayoutBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'qa-evidence/s7_auto_layout_applied.png' });
    }

    // Reload page to verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'qa-evidence/s7_reloaded_home.png' });

    // Finding: Reload resets activeDashboardId to null (no URL router)
    // Re-click into the dashboard to verify cards persisted in backend database
    await page.getByText('QA Kaggle Fraud Analytics').click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'qa-evidence/s7_reloaded_canvas.png' });

    // Verify 3 cards still present
    await expect(page.getByText('Total Transaction Volume ($)').first()).toBeVisible();
    await expect(page.getByText('Portfolio Fraud Rate').first()).toBeVisible();
    await expect(page.getByText('Channel Breakdown').first()).toBeVisible();
  });
});
