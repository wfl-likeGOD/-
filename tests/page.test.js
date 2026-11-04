const test = require('node:test');
const assert = require('node:assert/strict');

const Renderer = require('../miniprogram/game/renderer.js');

function createContextStub() {
  const gradient = { addColorStop() {} };
  const target = {};
  return new Proxy(target, {
    get(object, property) {
      if (property in object) {
        return object[property];
      }
      if (property === 'createLinearGradient' || property === 'createRadialGradient') {
        return () => gradient;
      }
      if (property === 'measureText') {
        return () => ({ width: 10 });
      }
      return () => {};
    },
    set(object, property, value) {
      object[property] = value;
      return true;
    }
  });
}

test('页面在模拟微信环境中能完成初始化、渲染和触摸操作', () => {
  const frames = [];
  const canvas = {
    width: 0,
    height: 0,
    getContext() {
      return createContextStub();
    },
    requestAnimationFrame(callback) {
      frames.push(callback);
      return frames.length;
    },
    cancelAnimationFrame() {}
  };

  const storage = new Map();
  let registeredPage = null;

  global.wx = {
    getWindowInfo() {
      return {
        pixelRatio: 2,
        statusBarHeight: 44,
        safeArea: { top: 44 }
      };
    },
    getStorageSync(key) {
      return storage.has(key) ? storage.get(key) : '';
    },
    setStorageSync(key, value) {
      storage.set(key, value);
    },
    vibrateShort() {},
    createSelectorQuery() {
      return {
        select() {
          return this;
        },
        fields() {
          return this;
        },
        exec(callback) {
          callback([{ node: canvas, width: 375, height: 812 }]);
        }
      };
    }
  };

  global.Page = (configuration) => {
    registeredPage = configuration;
  };

  require('../miniprogram/pages/index/index.js');
  assert.ok(registeredPage);

  const page = Object.assign(
    {
      data: { ready: false },
      setData(patch) {
        this.data = Object.assign({}, this.data, patch);
      }
    },
    registeredPage
  );

  page.onLoad();
  assert.equal(page.safeTop, 48);
  page.onReady();

  assert.equal(page.canvas, canvas);
  assert.equal(page.width, 375);
  assert.equal(page.height, 812);
  assert.equal(canvas.width, 750);
  assert.equal(canvas.height, 1624);
  assert.equal(page.data.ready, true);
  assert.equal(frames.length, 1);

  assert.doesNotThrow(() => frames.shift()(Date.now()));
  assert.equal(frames.length, 1);

  const menu = Renderer.getLayout(375, 812, 'menu', page.safeTop);
  const startPoint = { x: menu.start.x + 8, y: menu.start.y + 8 };
  page.onTouchStart({ touches: [startPoint] });
  page.onTouchEnd({ changedTouches: [startPoint] });
  assert.equal(page.controller.getScene(), 'playing');

  page.onHide();
  assert.equal(page.controller.getScene(), 'paused');

  page.onUnload();
  assert.equal(page.canvas, null);
  assert.equal(page.ctx, null);

  delete global.wx;
  delete global.Page;
});
