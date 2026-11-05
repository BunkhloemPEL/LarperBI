import { test, expect } from '@playwright/test';
import * as fs from 'fs';

test.use({ channel: 'chrome' });

test('Reproduce card visual bugs: Zoom obscured & Gray flick on click', async ({ page }) => {
  const raw = fs.readFileSync('scripts/qa/qa_dashboard.json', 'utf8');
  const data = JSON.parse(raw);
  const dashId = data.dashboard_id;

  // Track console logs and network requests
  const networkRequests: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('/query')) {
      networkRequests.push(req.url());
      console.log('Query requested:', req.url());
    }
  });

  await page.goto(`http://127.0.0.1:5174/#/dashboard/${dashId}`);
  await page.waitForLoadState('networkidle');

  // Find the first SmartScalar card
  const scalarTitle = page.getByRole('heading', { name: 'Total Transaction Volume ($)' }).first();
  await expect(scalarTitle).toBeVisible();

  // Test 1: Click on the card and observe if network query fires again and gray pulse appears
  console.log('--- Testing Click Gray Flicker ---');
  const initialQueries = networkRequests.length;
  console.log('Initial query count:', initialQueries);

  // Click on the card container
  const cardElement = scalarTitle.locator('xpath=ancestor::div[contains(@class, "_cardRoot")]');
  await cardElement.click();
  await page.waitForTimeout(100);
  await page.screenshot({ path: 'qa-evidence/bug_click_flicker.png' });

  // Test 2: Click Maximize (Zoom) button on the SmartScalar card
  console.log('--- Testing Zoom / Maximize Obscured ---');
  // Hover over the card to make header actions visible
  await cardElement.hover();
  const zoomBtn = cardElement.locator('button[title*="Zoom"]');
  await expect(zoomBtn).toBeVisible();
  await zoomBtn.click();
  await page.waitForTimeout(500);

  // Capture screenshot of the zoomed view
  await page.screenshot({ path: 'qa-evidence/bug_zoomed_view.png' });

  // Inspect the zoomed element layout
  const zoomedValue = page.locator('div[style*="80vh"]').locator('div[class*="mainValue"]');
  if (await zoomedValue.isVisible()) {
    const box = await zoomedValue.boundingBox();
    console.log('Zoomed value bounding box:', box);
  }

  // Close zoom
  const closeZoom = page.locator('div[style*="80vh"]').locator('button');
  await closeZoom.click();
  await page.waitForTimeout(300);

  // Test 3: Inspect small card scaling
  console.log('--- Testing Normal Card Scaling ---');
  await page.screenshot({ path: 'qa-evidence/bug_normal_card_scaling.png' });
});
