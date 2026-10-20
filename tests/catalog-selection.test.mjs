import test from 'node:test';
import assert from 'node:assert/strict';
import { compareCapacity, dimensionOptions, emptyProductFilters, familyKey, familyLabel, filterProducts, mergeVisibleSelection, storeArea } from '../src/lib/catalogSelection.ts';

const product = (partNumber, family, capacity, color, extra = {}) => ({ partNumber, family, capacity, color, category: 'iphone', title: `${family} ${capacity} ${color}`, ...extra });
const products = [product('A', 'iphone17', '256GB', '黑色'), product('B', 'iphone17', '512GB', '白色'), product('C', 'iphone17pro', '256GB', '黑色')];

test('容量按实际大小排序而不是把 1TB 放在 256GB 前面', () => {
  assert.deepEqual(dimensionOptions(['1TB', '256GB', '2TB', '512GB']).sort(compareCapacity).map(option => option.value), ['256GB', '512GB', '1TB', '2TB']);
});

test('系列筛选不会混入相同容量颜色的其他型号', () => {
  assert.deepEqual(filterProducts(products, { ...emptyProductFilters, family: 'iphone17', capacity: '256GB', color: '黑色' }).map(p => p.partNumber), ['A']);
});
test('缺失规格明确保留为未标注，不伪造容量或丢掉 SKU', () => {
  const data = [product('A', 'mac-studio', '', ''), product('B', 'mac-studio', '', '')];
  assert.equal(filterProducts(data, { ...emptyProductFilters, family: 'mac-studio' }).length, 2);
  assert.deepEqual(dimensionOptions(['', undefined, '']), [{ value: '__unspecified__', label: '目录未标注' }]);
});
test('切换城市或配置后的全选和清空仅影响当前结果，保留其他选择', () => {
  assert.deepEqual(mergeVisibleSelection(['A', 'C'], ['A', 'B'], ['B']), ['C', 'B']);
  assert.deepEqual(mergeVisibleSelection(['A', 'C'], ['A', 'B'], []), ['C']);
  assert.deepEqual(mergeVisibleSelection(['C'], ['A', 'B'], ['A', 'B', 'A']), ['C', 'A', 'B']);
});
test('从完整门店名后缀提取区域，门店名称中的连字符不会被截断', () => {
  assert.equal(storeArea({ number: 'A', name: 'Saint-Germain', title: 'Paris-Saint-Germain' }), 'Paris');
  assert.equal(storeArea({ number: 'B', name: 'Apple Central', title: 'Apple Central' }), '未标注区域');
  assert.equal(storeArea({ number: 'C', name: '前海壹方城', title: '深圳-前海壹方城' }), '深圳');
});
test('不同 Watch 表壳尺寸保持独立，名称相同也不合并 SKU', () => {
  const data = [product('A', 'watch', '', '黑色', { watchCaseSize: '42mm' }), product('B', 'watch', '', '黑色', { watchCaseSize: '46mm' })];
  assert.deepEqual(filterProducts(data, { ...emptyProductFilters, size: '46mm' }).map(p => p.partNumber), ['B']);
});
test('营销名称与分组键分离，未知新系列仍可选择', () => {
  assert.equal(familyLabel(product('A', 'iphone17promax', '', '', { title: 'iPhone 17 Pro Max 256GB 黑色' })), 'iPhone 17 Pro Max');
  assert.equal(familyKey(product('A', 'future-device', '', '')), 'future-device');
});
