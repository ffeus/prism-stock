import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { productsFromSnapshot, storesFromSnapshot } from './fixtures/catalog-from-snapshot.ts';
import { familyLabel } from '../src/lib/catalogSelection.ts';
import { compareNewestProducts } from '../src/lib/productOrder.ts';

const data = new URL('../crates/apw-core/data/', import.meta.url);
const read = (name) => JSON.parse(readFileSync(new URL(name, data), 'utf8'));
const storeData = read('stores.json');

for (const file of readdirSync(data).filter(file => /^products_.*\.json$/.test(file))) {
  const locale = file.slice('products_'.length, -'.json'.length);
  test(`${locale}: preview preserves the original snapshot's complete SKU set, categories and Watch associations`, () => {
    const pages = read(file);
    const expected = new Set();
    for (const page of pages) for (const raw of page.data.products) {
      const dimensionalPart = Object.values(raw.dimensions ?? {}).some(value => typeof value === 'string' && value.trim()) && raw.part?.includes('/') ? raw.part : '';
      const part = raw.partNumber?.trim() || raw.btrOrFdPartNumber?.trim() || dimensionalPart?.trim();
      if (part) expected.add(part);
    }
    const products = productsFromSnapshot(pages);
    assert.deepEqual(new Set(products.map(product => product.partNumber)), expected);
    assert.equal(products.length, expected.size);
    assert.deepEqual(new Set(products.map(product => product.category)), new Set(pages.map(page => page.category)));
    for (const page of pages) {
      const accepted = page.data.products.map(raw => raw.partNumber || raw.btrOrFdPartNumber || raw.part).filter(part => expected.has(part));
      for (const part of accepted) {
        const product = products.find(product => product.partNumber === part);
        assert.ok(product.title.trim(), `${part} needs a visible title`);
        if (page.category === 'watch') {
          assert.equal(product.companionPart, page.data.companionPart);
          assert.equal(product.kitPart, page.data.kitPart);
        }
      }
    }
  });
}

test('mainland preview includes Duo, both 18 Pro sizes and the complete original product families', () => {
  const products = productsFromSnapshot(read('products_zh_CN.json'));
  const iphones = products.filter(product => product.category === 'iphone').sort(compareNewestProducts);
  assert.equal(iphones.length, 73);
  assert.equal(iphones[0].family, 'iphoneduo');
  assert.equal(iphones.filter(product => product.family === 'iphone18pro').length, 16);
  assert.equal(iphones.filter(product => product.family === 'iphone18promax').length, 16);
  assert.equal(iphones.filter(product => product.family === 'iphoneduo').length, 8);
  assert.equal(iphones.find(product => product.partNumber === 'MJT74CH/A').title, 'iPhone 18 Pro 256GB 黑色');
  for (const label of ['MacBook Neo', 'Studio Display XDR', 'Apple Watch Series 12', 'Apple Watch Ultra 4', 'Apple Watch Hermès Series 12', 'Apple Watch Hermès Ultra 4', 'iPad Air 11 英寸 (M4)']) {
    assert.ok(products.some(product => familyLabel(product) === label), `${label} should remain distinguishable in the redesigned picker`);
  }
});

test('all original store regions preserve every store ID without sample substitutions', () => {
  for (const region of storeData) {
    const expected = new Set([...(region.state ?? []).flatMap(state => state.store ?? []), ...(region.store ?? [])].map(store => store.id.trim()).filter(Boolean));
    const stores = storesFromSnapshot(storeData, region.locale);
    assert.deepEqual(new Set(stores.map(store => store.number)), expected);
    assert.equal(stores.length, expected.size);
  }
  assert.equal(storesFromSnapshot(storeData, 'zh_CN').length, 50);
  assert.ok(storesFromSnapshot(storeData, 'zh_CN').some(store => store.title === '大连-百年城'));
  assert.ok(storesFromSnapshot(storeData, 'zh_CN').some(store => store.title === '深圳-前海壹方城'));
});
