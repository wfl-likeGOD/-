const { createController } = require('../../game/controller');
const renderer = require('../../game/renderer');

function readWindowMetrics() {
  try {
    if (typeof wx.getWindowInfo === 'function') {
      return wx.getWindowInfo();
    }
    return wx.getSystemInfoSync();
  } catch (error) {
    return {
      pixelRatio: 2,
      statusBarHeight: 20,
      safeArea: { top: 20 }
    };
  }
}

Page({
  data: {
    ready: false
  },

  onLoad() {
    const metrics = readWindowMetrics();
    this.safeTop =
      (metrics.safeArea && typeof metrics.safeArea.top === 'number'
        ? metrics.safeArea.top
        : metrics.statusBarHeight || 20) + 4;
    this.pixelRatio = Math.min(metrics.pixelRatio || 2, 3);
    this.touchStart = null;
    this.lastFrameAt = 0;
    this.rafId = 0;
    this.controller = createController({
      storage: {
        get(key) {
          try {
            return wx.getStorageSync(key);
          } catch (error) {
            return null;
          }
        },
        set(key, value) {
          try {
            wx.setStorageSync(key, value);
          } catch (error) {
            // 存储失败不应影响游戏本身。
          }
        }
      },
      onEvent: (name) => this.handleGameEvent(name)
    });
  },

  onReady() {
    this.initCanvas();
  },

  initCanvas() {
    wx.createSelectorQuery()
      .select('#gameCanvas')
      .fields({ node: true, size: true })
      .exec((result) => {
        const field = result && result[0];
        if (!field || !field.node) {
          return;
        }
        if (field.width < 1 || field.height < 1) {
          setTimeout(() => this.initCanvas(), 60);
          return;
        }

        const canvas = field.node;
        const dpr = this.pixelRatio;
        canvas.width = Math.round(field.width * dpr);
        canvas.height = Math.round(field.height * dpr);

        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        this.canvas = canvas;
        this.ctx = ctx;
        this.width = field.width;
        this.height = field.height;
        this.lastFrameAt = Date.now();

        if (this.data.ready !== true) {
          this.setData({ ready: true });
        }
        this.startLoop();
      });
  },

  startLoop() {
    if (!this.canvas || this.rafId) {
      return;
    }
    const frame = () => {
      if (!this.canvas || !this.ctx) {
        return;
      }
      const now = Date.now();
      const delta = this.lastFrameAt ? now - this.lastFrameAt : 16;
      this.lastFrameAt = now;

      this.controller.update(delta);
      renderer.draw(this.ctx, this.controller.getView(), this.width, this.height, now, {
        safeTop: this.safeTop
      });
      this.rafId = this.canvas.requestAnimationFrame(frame);
    };
    this.rafId = this.canvas.requestAnimationFrame(frame);
  },

  stopLoop() {
    if (this.canvas && this.rafId) {
      this.canvas.cancelAnimationFrame(this.rafId);
    }
    this.rafId = 0;
  },

  handleGameEvent(name) {
    if (typeof wx.vibrateShort !== 'function') {
      return;
    }
    if (name === 'eat') {
      wx.vibrateShort({ type: 'light' });
    } else if (name === 'die') {
      wx.vibrateShort({ type: 'medium' });
    } else if (name === 'win') {
      wx.vibrateShort({ type: 'heavy' });
    }
  },

  onTouchStart(event) {
    const touch = event.touches && event.touches[0];
    if (!touch) {
      return;
    }
    this.touchStart = {
      x: typeof touch.x === 'number' ? touch.x : touch.clientX,
      y: typeof touch.y === 'number' ? touch.y : touch.clientY
    };
  },

  onTouchEnd(event) {
    if (!this.touchStart) {
      return;
    }
    const touch = event.changedTouches && event.changedTouches[0];
    if (!touch) {
      this.touchStart = null;
      return;
    }
    const x = typeof touch.x === 'number' ? touch.x : touch.clientX;
    const y = typeof touch.y === 'number' ? touch.y : touch.clientY;
    const start = this.touchStart;
    this.touchStart = null;

    if (!this.controller) {
      return;
    }
    const deltaX = x - start.x;
    const deltaY = y - start.y;
    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) >= 16) {
      this.controller.swipe(deltaX, deltaY);
      return;
    }
    if (typeof this.width !== 'number') {
      return;
    }
    const layout = renderer.getLayout(
      this.width,
      this.height,
      this.controller.getScene(),
      this.safeTop
    );
    this.controller.tap(layout, x, y);
  },

  onHide() {
    if (this.controller) {
      this.controller.onHide();
    }
  },

  onUnload() {
    this.stopLoop();
    this.canvas = null;
    this.ctx = null;
  },

  onShareAppMessage() {
    return {
      title: '贪吃蛇 · 经典小游戏',
      path: '/pages/index/index'
    };
  }
});
