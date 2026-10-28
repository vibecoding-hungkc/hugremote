import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('apps/web/src/components/TerminalView.vue', 'utf8');
const scroll = await import('../apps/web/src/utils/terminalScroll.ts');

assert.doesNotMatch(source, /addEventListener\(['"]wheel['"]/, 'outer wheel listener must not double-handle xterm events');
assert.match(source, /scrollbarSliderBackground/);
assert.match(source, /scrollbarSliderHoverBackground/);
assert.match(source, /scrollbarSliderActiveBackground/);
assert.match(source, /\.xterm-scrollable-element\s*>\s*\.scrollbar\.vertical/);
assert.match(source, /\.xterm-scrollable-element\s*>\s*\.scrollbar\s*>\s*\.slider/);
assert.match(source, /\.scrollbar\.vertical\s*\{[^}]*width:\s*14px/is, 'track must retain xterm v6 14px geometry');

function luminance(hex) {
  const channels = hex.match(/[0-9a-f]{2}/gi).map(value => parseInt(value, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
function contrast(a, b) {
  const [bright, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (bright + 0.05) / (dark + 0.05);
}
const defaultThumb = source.match(/scrollbarSliderBackground:\s*'(#(?:[0-9a-f]{6}))'/i)?.[1];
assert.ok(defaultThumb, 'opaque default scrollbar token required');
assert.ok(contrast(defaultThumb, '#050811') >= 3, 'default scrollbar thumb must meet 3:1 contrast');

const dispatched = [];
class FakeWheelEvent {
  constructor(type, init) {
    this.type = type;
    Object.assign(this, init);
  }
}
globalThis.WheelEvent = FakeWheelEvent;
const screen = {
  getBoundingClientRect: () => ({ left: 10, top: 20, width: 200, height: 100 }),
  dispatchEvent(event) {
    dispatched.push(event);
    return true;
  },
};
const target = {
  querySelector(selector) {
    assert.equal(selector, '.xterm-screen');
    return screen;
  },
};
const term = { element: target, rows: 20 };
assert.equal(scroll.dispatchTerminalWheel(term, -36), true);
assert.equal(dispatched.length, 1);
assert.equal(dispatched[0].type, 'wheel');
assert.equal(dispatched[0].deltaY, -36);
assert.equal(dispatched[0].wheelDeltaY, 36, 'legacy xterm scrollback polarity must oppose deltaY');
assert.equal(dispatched[0].clientX, 110);
assert.equal(dispatched[0].clientY, 70);
assert.equal(dispatched[0].bubbles, true);
assert.equal(dispatched[0].cancelable, true);
assert.equal(scroll.dispatchTerminalWheel({ element: null }, 30), false);
assert.equal(scroll.dispatchTerminalWheel(term, 0), false);

const listeners = new Map();
const container = {
  addEventListener(type, handler, options) { listeners.set(type, { handler, options }); },
  removeEventListener(type) { listeners.delete(type); },
};
const cleanup = scroll.attachTerminalTouchScrolling(container, () => term);
assert.deepEqual([...listeners.keys()], ['touchstart', 'touchmove', 'touchend', 'touchcancel']);
assert.equal(listeners.get('touchstart').options.passive, true);
assert.equal(listeners.get('touchmove').options.passive, false);
listeners.get('touchstart').handler({ touches: [{ clientY: 100 }] });
let prevented = false;
listeners.get('touchmove').handler({
  touches: [{ clientY: 60 }],
  preventDefault() { prevented = true; },
});
assert.equal(prevented, true);
assert.equal(dispatched.length, 2, 'touch drag must become one native xterm wheel event');
assert.equal(dispatched[1].deltaY, 40);
assert.equal(dispatched[1].wheelDeltaY, -40);

listeners.get('touchcancel').handler();
listeners.get('touchmove').handler({ touches: [{ clientY: 10 }], preventDefault() {} });
assert.equal(dispatched.length, 2, 'touchcancel must clear stale gesture state');
listeners.get('touchstart').handler({ touches: [{ clientY: 80 }] });
listeners.get('touchmove').handler({ touches: [{ clientY: 70 }, { clientY: 30 }], preventDefault() {} });
listeners.get('touchmove').handler({ touches: [{ clientY: 20 }], preventDefault() {} });
assert.equal(dispatched.length, 2, 'multi-touch transition must clear stale gesture state');
listeners.get('touchend').handler();
cleanup();
assert.equal(listeners.size, 0);

console.log('PASS terminal scroll delegates wheel/touch/tmux behavior to xterm and styles the real scrollbar');
