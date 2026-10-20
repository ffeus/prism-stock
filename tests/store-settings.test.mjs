import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// Exercise the real store with a controllable IPC boundary, without a desktop app.
let invoke;
globalThis.__settingsTestInvoke = (...args) => invoke(...args);
registerHooks({
  resolve(specifier, context, nextResolve) {
    const stubs = {
      "@tauri-apps/api/core": "export const invoke = (...args) => globalThis.__settingsTestInvoke(...args);",
      "@tauri-apps/api/event": "export const listen = async () => () => {};",
      "@tauri-apps/plugin-opener": "export const openUrl = async () => {};",
    };
    if (specifier in stubs) {
      return { url: `data:text/javascript,${encodeURIComponent(stubs[specifier])}`, shortCircuit: true };
    }
    if (specifier.startsWith("./") && !specifier.endsWith(".ts") && context.parentURL?.includes("/src/lib/")) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const defaults = {
  locale: "zh_CN", targets: [], intervalSeconds: 30,
  deliveryRegion: null,
  barkUrl: "https://example.invalid/old", soundEnabled: true, openOnHit: "bag", stopOnHit: false,
  productBarkUrls: {},
  network: {
    mode: "system",
    clash: { controller: "http://127.0.0.1:9097", secret: "", group: "果到雷达", proxyPort: 7899, nodeFilter: "", pinnedNode: "DIRECT" },
  },
  checkout: {
    enabled: false, nationalIdSuffix: "", payment: "alipay",
    installmentBank: "招商银行", installmentPeriods: 24, placeOrder: false, acceptNearestStore: false, product: "",
    fillContact: false, contactLastName: "", contactFirstName: "", contactEmail: "", contactPhone: "",
  },
};
let generation = 0;
async function setup() {
  const store = await import(`../src/lib/store.ts?case=${++generation}`);
  let persisted = { ...defaults };
  let release;
  let blockNext = false;
  const calls = [];
  invoke = async (command, args) => {
    calls.push(command);
    if (blockNext) {
      blockNext = false;
      await new Promise((resolve) => { release = resolve; });
    }
    if (command === "save_settings") persisted = { ...args.settings };
    if (command === "set_interval") persisted.intervalSeconds = Math.max(5, args.seconds);
    if (command === "set_targets") persisted.targets = args.targets;
    if (command === "set_targets") return [];
    if (command === "set_interval") return persisted.intervalSeconds;
    return { ...persisted };
  };
  await store.saveSettings(defaults);
  calls.length = 0;
  return {
    store, calls, persisted: () => persisted,
    block: () => { blockNext = true; },
    release: () => release(),
  };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('编辑监控拒绝重复组合且不覆盖其他任务', async () => {
  const ctx = await setup();
  const a = {locale:'zh_CN',partNumber:'A',storeNumber:'R001',storeTitle:'一',productName:'A'};
  const b = {...a,storeNumber:'R002',storeTitle:'二'};
  await ctx.store.setTargets([a,b]);
  assert.equal(await ctx.store.replaceTarget(a,b),false);
  assert.deepEqual(ctx.persisted().targets,[a,b]);
  assert.equal(await ctx.store.replaceTarget(a,{...a,partNumber:'C'}),true);
  assert.equal(ctx.persisted().targets.length,2);
});

test('排队修改表带不复活先前删除的其他任务', async () => {
  const ctx = await setup();
  const a = {locale:'zh_CN',partNumber:'WATCH',storeNumber:'R001',storeTitle:'一',productName:'Watch',companionPart:'OLD'};
  const b = {...a,storeNumber:'R002'};
  await ctx.store.setTargets([a,b]);
  ctx.block();
  const remove = ctx.store.removeTarget(b); await tick();
  const band = ctx.store.updateWatchBand(a,'NEW','新表带');
  ctx.release(); await Promise.all([remove,band]);
  assert.deepEqual(ctx.persisted().targets,[{...a,companionPart:'NEW',companionName:'新表带'}]);
});

test("送货地区固定读取中国大陆官网且不跟随当前监控地区", async () => {
  let received;
  invoke = async (command, args) => {
    received = { command, args };
    return { states: [], cities: [], districts: [] };
  };
  const store = await import(`../src/lib/store.ts?delivery=${++generation}`);
  await store.loadDeliveryLocalities("四川", "成都");
  assert.deepEqual(received, {
    command: "list_delivery_localities",
    args: { locale: "zh_CN", stateName: "四川", cityName: "成都" },
  });
});

test("overlapping edits merge with the last saved settings", async () => {
  const ctx = await setup();
  ctx.block();
  const first = ctx.store.saveSettings({ barkUrl: "" });
  await tick();
  const second = ctx.store.saveSettings({ soundEnabled: false });
  const third = ctx.store.saveSettings({ openOnHit: "product" });
  await tick();
  assert.deepEqual(ctx.calls, ["save_settings"]);
  ctx.release();
  await Promise.all([first, second, third]);
  assert.deepEqual(ctx.persisted(), {
    ...defaults,
    barkUrl: "",
    soundEnabled: false,
    openOnHit: "product",
  });
});

test("interval and target commands cannot be overwritten by queued settings", async () => {
  const ctx = await setup();
  ctx.block();
  const interval = ctx.store.setIntervalSeconds(15);
  await tick();
  const targets = [{ locale: "zh_CN", storeNumber: "R390", storeTitle: "Test", partNumber: "TEST/A", productName: "Test" }];
  const updated = ctx.store.setTargets(targets);
  const saved = ctx.store.saveSettings({ soundEnabled: false });
  await tick();
  assert.deepEqual(ctx.calls, ["set_interval"]);
  ctx.release();
  await Promise.all([interval, updated, saved]);
  assert.deepEqual(ctx.persisted(), { ...defaults, intervalSeconds: 15, targets, soundEnabled: false });
});

test("rapid removals use the latest queued target list", async () => {
  const ctx = await setup();
  const target = (partNumber) => ({
    locale: "zh_CN", storeNumber: "R390", storeTitle: "Test",
    partNumber, productName: partNumber,
  });
  const firstTarget = target("FIRST/A");
  const secondTarget = target("SECOND/A");
  const retainedTarget = target("RETAINED/A");
  await ctx.store.setTargets([firstTarget, secondTarget, retainedTarget]);
  ctx.calls.length = 0;

  ctx.block();
  const firstRemoval = ctx.store.removeTarget(firstTarget);
  await tick();
  const secondRemoval = ctx.store.removeTarget(secondTarget);
  await tick();
  assert.deepEqual(ctx.calls, ["set_targets"]);

  ctx.release();
  await Promise.all([firstRemoval, secondRemoval]);
  assert.deepEqual(ctx.calls, ["set_targets", "get_settings", "set_targets", "get_settings"]);
  assert.deepEqual(ctx.persisted().targets, [retainedTarget]);
});

test("test notification waits for the cleared Bark address to finish saving", async () => {
  const ctx = await setup();
  ctx.block();
  const save = ctx.store.saveSettings({ barkUrl: "" });
  await tick();
  const notification = ctx.store.testNotify();
  await tick();
  assert.deepEqual(ctx.calls, ["save_settings"]);
  ctx.release();
  await Promise.all([save, notification]);
  assert.deepEqual(ctx.calls, ["save_settings", "test_notify"]);
  assert.equal(ctx.persisted().barkUrl, "");
});

test("a failed write does not prevent subsequent edits", async () => {
  const ctx = await setup();
  const originalInvoke = invoke;
  invoke = async () => { throw new Error("disk unavailable"); };
  assert.equal(await ctx.store.saveSettings({ soundEnabled: false }), false);
  invoke = originalInvoke;
  assert.equal(await ctx.store.saveSettings({ barkUrl: "" }), true);
  assert.deepEqual(ctx.persisted(), { ...defaults, barkUrl: "" });
});

test("a product-specific Bark URL can be set and cleared", async () => {
  const ctx = await setup();
  const target = {
    locale: "zh_CN", storeNumber: "R390", storeTitle: "Test",
    partNumber: "TEST/A", productName: "Test Product",
  };

  assert.equal(await ctx.store.setProductBarkUrl(target, " https://api.day.app/friend "), true);
  assert.deepEqual(ctx.persisted().productBarkUrls, {
    "TEST/A": "https://api.day.app/friend",
  });

  assert.equal(await ctx.store.setProductBarkUrl(target, ""), true);
  assert.deepEqual(ctx.persisted().productBarkUrls, {});
});

test("nested field patches merge when queued instead of restoring a stale form", async () => {
  const ctx = await setup();
  ctx.block();
  const first = ctx.store.saveSettings({ checkout: { contactLastName: 'Test' } });
  await tick();
  const second = ctx.store.saveSettings({ checkout: { contactFirstName: 'Fixture' } });
  ctx.release();
  await Promise.all([first, second]);
  assert.equal(ctx.persisted().checkout.contactLastName, 'Test');
  assert.equal(ctx.persisted().checkout.contactFirstName, 'Fixture');
  assert.equal(ctx.persisted().checkout.placeOrder, false);
});

test("failed locale save leaves the catalog and locale aligned", async () => {
  const ctx = await setup();
  const calls = [];
  invoke = async (command) => { calls.push(command); throw new Error('disk unavailable'); };
  await ctx.store.changeLocale('ja_JP');
  assert.equal(ctx.store.watcherStore.getSnapshot().settings.locale, 'zh_CN');
  assert.deepEqual(calls, ['save_settings']);
});

test("late region response cannot overwrite the current catalog", async () => {
  const ctx = await setup();
  const originalInvoke = invoke;
  const blocked = [];
  invoke = async (command, args) => {
    if (command === 'list_stores' || command === 'list_products') {
      if (args.locale === 'ja_JP') await new Promise(resolve => blocked.push(resolve));
      return [{ marker: args.locale }];
    }
    return originalInvoke(command, args);
  };
  const older = ctx.store.changeLocale('ja_JP');
  await tick();
  await ctx.store.changeLocale('en_SG');
  blocked.forEach(resolve => resolve());
  await older;
  const state = ctx.store.watcherStore.getSnapshot();
  assert.equal(state.catalogLocale, 'en_SG');
  assert.equal(state.products[0].marker, 'en_SG');
  assert.equal(state.catalogLoading, false);
});

test("initial IPC failure can be retried", async () => {
  const ctx = await setup();
  const persisted = ctx.persisted();
  invoke = async () => { throw new Error('startup failed'); };
  await assert.rejects(ctx.store.connect(), /startup failed/);
  invoke = async (command) => command === 'get_settings' ? persisted : command === 'is_running' ? false : [];
  await assert.doesNotReject(ctx.store.connect());
  assert.equal(ctx.store.watcherStore.getSnapshot().ready, true);
  ctx.store.disconnect();
});

test("target changes synchronize normalized checkout settings", async () => {
  const ctx = await setup();
  const originalInvoke = invoke;
  invoke = async (command, args) => {
    const result = await originalInvoke(command, args);
    if (command === 'get_settings') return { ...result, checkout: { ...result.checkout, enabled: false, product: '' } };
    return result;
  };
  await ctx.store.saveSettings({ checkout: { enabled: true, product: 'TEST/A||' } });
  await ctx.store.setTargets([]);
  assert.equal(ctx.store.watcherStore.getSnapshot().settings.checkout.enabled, false);
});

test("adding tasks after a pending removal does not resurrect the removed task", async () => {
  const ctx = await setup();
  const target = (partNumber) => ({ locale: 'zh_CN', storeNumber: 'TEST', storeTitle: 'Fixture', partNumber, productName: partNumber });
  const removed = target('REMOVE/A'); const retained = target('KEEP/A'); const added = target('ADD/A');
  await ctx.store.setTargets([removed, retained]);
  ctx.block();
  const removing = ctx.store.removeTarget(removed);
  await tick();
  const adding = ctx.store.addTargets([added, added]);
  ctx.release();
  await Promise.all([removing, adding]);
  assert.deepEqual(ctx.persisted().targets, [retained, added]);
});

test("disabled fork updater never invokes an upstream install command", async () => {
  const ctx = await setup();
  await ctx.store.checkForUpdate({ quiet: true });
  await ctx.store.installUpdate();
  await ctx.store.openReleasePage();
  assert.deepEqual(ctx.calls, []);
  assert.match(ctx.store.watcherStore.getSnapshot().updateError, /尚未发布/);
});
