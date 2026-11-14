import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../apps/web/', import.meta.url));
const vite = await createServer({
  root,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
});

let failures = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    failures++;
    console.error(`FAIL ${name}: ${err.message}`);
  }
}

const key = (o) => ({ key: 'k', code: 'KeyK', metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...o });

try {
  const m = await vite.ssrLoadModule('/src/utils/spotlight.ts');

  const input = {
    servers: [{ id: 's1', name: 'Local' }, { id: 's2', name: 'Box 203.0.113.10' }],
    projects: [
      { id: 'p1', serverId: 's1', name: 'Dự án Alpha', rootPath: '/work/alpha' },
      { id: 'p2', serverId: 's1', name: 'beta-api', rootPath: '/work/beta' },
      { id: 'p3', serverId: 's2', name: 'gamma', rootPath: '/srv/gamma/' },
      { id: 'px', serverId: 'gone', name: 'orphan', rootPath: '/x' },
    ],
    terminals: [
      { id: 't1', serverId: 's1', projectId: 'p1', name: 'shell chính' },
      { id: 't2', serverId: 's2', name: 'deploy', cwd: '/srv/gamma' },
    ],
    claudes: [
      { id: 'c1', serverId: 's1', projectId: 'p2', name: 'Refactor UI' },
      { id: 'c1', serverId: 's1', projectId: 'p2', name: 'Refactor UI' },
    ],
  };

  await test('AC5: items cover projects, claude, terminal of workspace servers only, deduped', () => {
    const items = m.buildSpotlightItems(input);
    const kinds = items.map((i) => i.kind);
    assert.equal(kinds.filter((k) => k === 'project').length, 3);
    assert.equal(kinds.filter((k) => k === 'claude').length, 1);
    assert.equal(kinds.filter((k) => k === 'terminal').length, 2);
    assert.ok(!items.some((i) => i.title === 'orphan'));
    const t2 = items.find((i) => i.id === 't2');
    assert.equal(t2.projectId, 'p3', 'cwd with trailing slash must resolve to project');
    assert.match(t2.subtitle, /gamma/);
  });

  await test('AC6: search ignores case and Vietnamese diacritics, ranks title prefix first', () => {
    const items = m.buildSpotlightItems(input);
    assert.equal(m.filterSpotlightItems(items, 'du an')[0].title, 'Dự án Alpha');
    assert.equal(m.filterSpotlightItems(items, 'SHELL CHINH')[0].id, 't1');
    assert.ok(m.filterSpotlightItems(items, 'dự')[0], 'accented query matches');
    assert.equal(m.filterSpotlightItems(items, 'zzzz').length, 0);
    const byServer = m.filterSpotlightItems(items, '203.0.113.10');
    assert.ok(byServer.length >= 2 && byServer.every((i) => i.serverId === 's2'));
    const ranked = m.filterSpotlightItems(items, 'beta');
    assert.equal(ranked[0].title, 'beta-api', 'title match beats subtitle match');
    assert.ok(ranked.some((i) => i.id === 'c1'), 'session of matching project is found via project name');
  });

  await test('AC6b: empty query groups by server, then project, claude, terminal', () => {
    const items = m.buildSpotlightItems(input);
    const order = m.filterSpotlightItems(items, '').map((i) => `${i.serverId}:${i.kind}`);
    assert.deepEqual(order, ['s1:project', 's1:project', 's1:claude', 's1:terminal', 's2:project', 's2:terminal']);
  });

  await test('AC12b: subtitle does not repeat the project name when it equals the folder', () => {
    const items = m.buildSpotlightItems(input);
    assert.equal(items.find((i) => i.id === 't1').subtitle, 'Dự án Alpha · /work/alpha');
    const home = m.buildSpotlightItems({
      servers: [{ id: 's1', name: 'Local' }],
      projects: [{ id: 'h', serverId: 's1', name: '~', rootPath: '/home/u' }],
      terminals: [{ id: 'th', serverId: 's1', projectId: 'h', name: 'sh' }],
      claudes: [],
    });
    assert.equal(home.find((i) => i.id === 'th').subtitle, '/home/u');
    const same = m.buildSpotlightItems({
      servers: [{ id: 's1', name: 'Local' }],
      projects: [{ id: 'a', serverId: 's1', name: 'app', rootPath: '/w/app' }],
      terminals: [{ id: 'ta', serverId: 's1', projectId: 'a', name: 'sh' }],
      claudes: [],
    });
    assert.equal(same.find((i) => i.id === 'ta').subtitle, '/w/app');
  });

  await test('AC4: only one hotkey, platform specific, no shift and no stray modifiers', () => {
    assert.ok(m.isSpotlightHotkey(key({ metaKey: true }), 'MacIntel'));
    assert.ok(!m.isSpotlightHotkey(key({ ctrlKey: true }), 'MacIntel'));
    assert.ok(m.isSpotlightHotkey(key({ ctrlKey: true, altKey: true }), 'Win32'));
    assert.ok(!m.isSpotlightHotkey(key({ ctrlKey: true }), 'Win32'), 'plain Ctrl+K stays free for terminals');
    assert.ok(!m.isSpotlightHotkey(key({ metaKey: true, shiftKey: true }), 'MacIntel'));
    for (const d of ['1', '9']) {
      for (const mods of [{ altKey: true }, { altKey: true, shiftKey: true }, { ctrlKey: true, altKey: true }, { ctrlKey: true, shiftKey: true }]) {
        assert.ok(!m.isSpotlightHotkey(key({ key: d, code: `Digit${d}`, ...mods }), 'Win32'));
      }
    }
    assert.equal(m.spotlightHotkeyLabel('MacIntel'), '⌘K');
    assert.equal(m.spotlightHotkeyLabel('Linux x86_64'), 'Ctrl+Alt+K');
  });

  await test('AC12: same-named sessions on different servers stay distinguishable', () => {
    const items = m.buildSpotlightItems({
      servers: [{ id: 's1', name: 'Local', type: 'local' }, { id: 's2', name: 'Box 203.0.113.10', type: 'ssh' }],
      projects: [
        { id: 'p1', serverId: 's1', name: 'app', rootPath: '/work/app' },
        { id: 'p2', serverId: 's2', name: 'app', rootPath: '/srv/app' },
      ],
      terminals: [],
      claudes: [
        { id: 'c1', serverId: 's1', projectId: 'p1', name: 'chat' },
        { id: 'c2', serverId: 's2', projectId: 'p2', name: 'chat' },
      ],
    });
    const chats = m.filterSpotlightItems(items, 'chat');
    assert.equal(chats.length, 2);
    assert.notEqual(chats[0].key, chats[1].key);
    assert.deepEqual(chats.map((i) => i.serverName).sort(), ['Box 203.0.113.10', 'Local']);
    assert.deepEqual(chats.map((i) => i.serverType).sort(), ['local', 'ssh']);
    assert.ok(chats.every((i) => !i.subtitle.includes(i.serverName)), 'server lives in its own badge, not the subtitle');
    assert.deepEqual(m.filterSpotlightItems(items, 'chat 203.0.113.10').map((i) => i.id), ['c2'], 'server name narrows the search');
  });

  await test('AC1/AC2/AC3: legacy shortcut system is fully removed from source', () => {
    assert.ok(!fs.existsSync(fileURLToPath(new URL('../apps/web/src/stores/shortcutStore.ts', import.meta.url))));
    const dir = fileURLToPath(new URL('../apps/web/src/', import.meta.url));
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(d + e.name + '/') : [d + e.name]));
    for (const f of walk(dir).filter((f) => /\.(vue|ts)$/.test(f))) {
      const src = fs.readFileSync(f, 'utf8');
      assert.doesNotMatch(src, /Cài đặt phím tắt|ri-keyboard-box-line|shortcutStore|useShortcutStore|dw-idx-badge|dw-kbd-tag|shortcut-labels-visible|handleGlobalShortcutKeyDown/, f);
    }
  });
} finally {
  await vite.close();
}

process.exitCode = failures ? 1 : 0;
