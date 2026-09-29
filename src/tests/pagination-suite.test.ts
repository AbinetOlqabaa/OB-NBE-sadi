/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { paginateList } from '../utils/paginationUtils.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`  ✓ ${message}`);
  }
}

export async function runPaginationSuiteTests(): Promise<void> {
  console.log('\n======================================================');
  console.log('--- 11. APPLICATION-WIDE PAGINATION SUITE TESTS ---');
  console.log('======================================================');

  // Test 1: Zero records
  console.log('\n--- 1. Zero records edge case ---');
  const emptyList: number[] = [];
  const emptyRes = paginateList(emptyList, 1, 10);
  assert(emptyRes.total === 0, 'Total is 0 for empty list');
  assert(emptyRes.items.length === 0, 'Items length is 0');
  assert(emptyRes.total_pages === 1, 'Total pages is 1 for empty list');
  assert(emptyRes.page === 1, 'Current page is 1');
  assert(emptyRes.has_next === false, 'has_next is false');
  assert(emptyRes.has_previous === false, 'has_previous is false');

  // Test 2: Exactly one record
  console.log('\n--- 2. Exactly one record ---');
  const singleList = ['ITEM_1'];
  const singleRes = paginateList(singleList, 1, 10);
  assert(singleRes.total === 1, 'Total is 1');
  assert(singleRes.items.length === 1, 'Items has 1 element');
  assert(singleRes.items[0] === 'ITEM_1', 'Item content matches');
  assert(singleRes.total_pages === 1, 'Total pages is 1');
  assert(singleRes.has_next === false, 'has_next is false');
  assert(singleRes.has_previous === false, 'has_previous is false');

  // Test 3: Exactly one full page
  console.log('\n--- 3. Exactly one full page ---');
  const fullPageList = Array.from({ length: 8 }, (_, i) => `ITEM_${i + 1}`);
  const fullPageRes = paginateList(fullPageList, 1, 8);
  assert(fullPageRes.total === 8, 'Total is 8');
  assert(fullPageRes.items.length === 8, 'Items length is 8');
  assert(fullPageRes.total_pages === 1, 'Total pages is 1');
  assert(fullPageRes.has_next === false, 'has_next is false');
  assert(fullPageRes.has_previous === false, 'has_previous is false');

  // Test 4: Exactly two pages
  console.log('\n--- 4. Exactly two pages ---');
  const twoPageList = Array.from({ length: 16 }, (_, i) => `ITEM_${i + 1}`);
  const page1Res = paginateList(twoPageList, 1, 8);
  assert(page1Res.total === 16, 'Total is 16');
  assert(page1Res.items.length === 8, 'Page 1 has 8 items');
  assert(page1Res.total_pages === 2, 'Total pages is 2');
  assert(page1Res.has_next === true, 'Page 1 has_next is true');
  assert(page1Res.has_previous === false, 'Page 1 has_previous is false');
  assert(page1Res.items[0] === 'ITEM_1', 'First item on page 1 is ITEM_1');

  const page2Res = paginateList(twoPageList, 2, 8);
  assert(page2Res.items.length === 8, 'Page 2 has 8 items');
  assert(page2Res.has_next === false, 'Page 2 has_next is false');
  assert(page2Res.has_previous === true, 'Page 2 has_previous is true');
  assert(page2Res.items[0] === 'ITEM_9', 'First item on page 2 is ITEM_9');

  // Test 5: Out of bounds page clamps safely to total_pages
  console.log('\n--- 5. Out of bounds page clamping ---');
  const clampedRes = paginateList(twoPageList, 999, 8);
  assert(clampedRes.page === 2, 'Clamped to page 2 (safe maximum)');
  assert(clampedRes.items.length === 8, 'Items on last page returned');
  assert(clampedRes.items[0] === 'ITEM_9', 'Items belong to last page');

  // Test 6: Many pages (Large dataset)
  console.log('\n--- 6. Large dataset with 1,250 records ---');
  const largeDataset = Array.from({ length: 1250 }, (_, i) => ({ id: i + 1, ref: `NBE-TX-${i + 1}` }));
  const p10Res = paginateList(largeDataset, 10, 50);
  assert(p10Res.total === 1250, 'Total is 1250');
  assert(p10Res.total_pages === 25, 'Total pages is 25');
  assert(p10Res.page === 10, 'Page is 10');
  assert(p10Res.items.length === 50, 'Page size 50 returned');
  assert(p10Res.has_next === true, 'Page 10 has_next is true');
  assert(p10Res.has_previous === true, 'Page 10 has_previous is true');
  assert(p10Res.items[0].id === 451, 'First record on page 10 has ID 451');
  assert(p10Res.items[49].id === 500, 'Last record on page 10 has ID 500');

  // Test 7: Page size change
  console.log('\n--- 7. Page size change behavior ---');
  const customSizeRes = paginateList(largeDataset, 1, 100);
  assert(customSizeRes.page_size === 100, 'Page size is 100');
  assert(customSizeRes.total_pages === 13, 'Total pages is 13 with page size 100');
  assert(customSizeRes.items.length === 100, 'Items count is 100');

  console.log('\n✓ All Application-Wide Pagination Suite tests passed successfully.');
}
