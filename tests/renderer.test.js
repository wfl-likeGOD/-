const test = require('node:test');
const assert = require('node:assert/strict');

const Core = require('../miniprogram/game/core.js');
const Renderer = require('../miniprogram/game/renderer.js');

function isInside(rect, width, height) {
  return rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= width + 0.01 && rect.y + rect.h <= height + 0.01;
}

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

function demoView(scene) {
  const game = Core.createGame({ rng: Core.createRng(11) });
  game.snake = [
    { x: 8, y: 8 },
    { x: 7, y: 8 },
    { x: 6, y: 8 },
    { x: 6, y: 9 }
  ];
  game.dir = { x: 1, y: 0, key: 'right' };
  game.food = { x: 12, y: 10 };
  game.score = 40;
  game.eaten = 4;
  game.status = scene === 'over' ? 'over' : 'running';
  return {
    scene,
    difficulty: 'normal',
    difficultyInfo: Core.DIFFICULTIES.normal,
    best: 120,
    bests: { easy: 40, normal: 120, hard: 60 },
    isNewBest: true,
    score: 40,
    lastScore: 40,
    speed: 150,
    sceneChangedAt: Date.now() - 1000,
    game
  };
}

test('菜单布局在常见尺寸内且按钮不重叠', () => {
  const layout = Renderer.getLayout(375, 812, 'menu', 44);
  assert.equal(layout.board.w, 300);
  assert.equal(layout.board.h, 300);
  assert.ok(isInside(layout.board, 375, 812));
  assert.ok(isInside(layout.start, 375, 812));
  assert.ok(layout.hintY < 812);
  assert.ok(layout.footerY === null || layout.footerY <= 812);
  assert.equal(layout.difficulty.length, 3);
  assert.equal(layout.difficulty[0].key, 'easy');
  for (let index = 1; index < layout.difficulty.length; index += 1) {
    const previous = layout.difficulty[index - 1];
    assert.ok(layout.difficulty[index].x > previous.x + previous.w);
  }
  assert.ok(layout.start.y > layout.difficulty[2].y + layout.difficulty[2].h);
});

test('小屏菜单不会溢出', () => {
  const layout = Renderer.getLayout(320, 568, 'menu', 20);
  assert.ok(isInside(layout.board, 320, 568));
  assert.ok(isInside(layout.start, 320, 568));
  assert.ok(layout.hintY < 568);
  assert.ok(layout.footerY === null || layout.footerY < 568);
});

test('游戏布局中棋盘、状态卡和暂停按钮都可用', () => {
  const layout = Renderer.getLayout(375, 812, 'playing', 44);
  assert.ok(isInside(layout.board, 375, 812));
  assert.ok(isInside(layout.score, 375, 812));
  assert.ok(isInside(layout.best, 375, 812));
  assert.ok(layout.best.x + layout.best.w < 250, '状态卡应避开右上角胶囊按钮');
  assert.ok(isInside(layout.pause, 375, 812));
  assert.ok(layout.pause.y > layout.board.y + layout.board.h);
  assert.ok(layout.hintY > layout.pause.y + layout.pause.h);
  assert.equal(layout.dpad, undefined);
  assert.ok(layout.hintY < 812);
});

test('小屏游戏布局不会溢出', () => {
  const layout = Renderer.getLayout(375, 667, 'playing', 44);
  assert.ok(layout.board.w >= 200);
  assert.ok(isInside(layout.board, 375, 667));
  assert.ok(isInside(layout.pause, 375, 667));
  assert.ok(layout.hintY < 667);
});

test('320×568 的游戏布局也能完整放下', () => {
  const layout = Renderer.getLayout(320, 568, 'playing', 24);
  assert.ok(isInside(layout.board, 320, 568));
  assert.ok(isInside(layout.pause, 320, 568));
  assert.ok(layout.hintY < 568);
  assert.ok(layout.best.x + layout.best.w < 223, '状态卡应避开右上角胶囊按钮');
});

test('暂停与结算弹窗按钮位于卡片内', () => {
  const paused = Renderer.getLayout(375, 812, 'paused', 44);
  assert.ok(isInside(paused.card, 375, 812));
  assert.ok(isInside(paused.resume, 375, 812));
  assert.ok(isInside(paused.restart, 375, 812));
  assert.ok(isInside(paused.home, 375, 812));
  assert.ok(paused.resume.y > paused.card.y);
  assert.ok(paused.home.y > paused.restart.y + paused.restart.h);

  const over = Renderer.getLayout(375, 812, 'over', 44);
  assert.ok(isInside(over.card, 375, 812));
  assert.ok(isInside(over.restart, 375, 812));
  assert.ok(isInside(over.home, 375, 812));
  assert.ok(over.home.y > over.restart.y + over.restart.h);
});

test('四种场景都能完成一次完整绘制', () => {
  const context = createContextStub();
  const scenes = ['menu', 'playing', 'paused', 'over'];
  for (const scene of scenes) {
    assert.doesNotThrow(() => {
      Renderer.draw(context, demoView(scene), 375, 812, Date.now(), { safeTop: 44 });
    });
  }
});

test('小屏也能完成一次完整绘制', () => {
  const context = createContextStub();
  assert.doesNotThrow(() => {
    Renderer.draw(context, demoView('menu'), 320, 568, Date.now(), { safeTop: 20 });
  });
  assert.doesNotThrow(() => {
    Renderer.draw(context, demoView('playing'), 320, 568, Date.now(), { safeTop: 20 });
  });
});
