const test = require('node:test');
const assert = require('node:assert/strict');

const Controller = require('../miniprogram/game/controller.js');
const Renderer = require('../miniprogram/game/renderer.js');

function createStorage(initial) {
  const map = new Map(Object.entries(initial || {}));
  return {
    get(key) {
      return map.has(key) ? map.get(key) : null;
    },
    set(key, value) {
      map.set(key, value);
    }
  };
}

function create(initial) {
  return Controller.createController({
    storage: createStorage(initial),
    now: () => 1000
  });
}

function center(rect) {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

function tapRect(controller, layout, rect) {
  const point = center(rect);
  return controller.tap(layout, point.x, point.y);
}

test('初始进入菜单，默认普通难度且最高分为 0', () => {
  const controller = create();
  assert.equal(controller.getScene(), 'menu');
  const view = controller.getView();
  assert.equal(view.difficulty, 'normal');
  assert.equal(view.best, 0);
  assert.equal(view.score, 0);
});

test('菜单可以切换难度并持久化', () => {
  const storage = createStorage();
  const controller = Controller.createController({ storage, now: () => 1000 });
  const layout = Renderer.getLayout(375, 812, 'menu', 44);
  const hard = layout.difficulty.find((pill) => pill.key === 'hard');
  assert.equal(tapRect(controller, layout, hard), true);
  assert.equal(controller.getView().difficulty, 'hard');
  assert.equal(storage.get(Controller.STORAGE_DIFFICULTY), 'hard');
});

test('点击开始按钮进入游戏，点击方向键可以转向', () => {
  const controller = create();
  controller.setDifficulty('hard');
  const menu = Renderer.getLayout(375, 812, 'menu', 44);
  assert.equal(tapRect(controller, menu, menu.start), true);
  assert.equal(controller.getScene(), 'playing');
  assert.equal(controller.getView().game.snake.length, 4);

  const game = controller.getView().game;
  game.food = { x: 0, y: 0 };
  const playing = Renderer.getLayout(375, 812, 'playing', 44);
  assert.equal(tapRect(controller, playing, playing.dpad.up), true);
  controller.update(120);
  assert.equal(game.snake[0].x, 10);
  assert.equal(game.snake[0].y, 9);
});

test('每帧 update 按难度间隔推进，吃食物后得分增加', () => {
  const controller = create();
  controller.setDifficulty('hard');
  controller.startGame();
  const game = controller.getView().game;
  game.snake = [
    { x: 5, y: 5 },
    { x: 4, y: 5 },
    { x: 3, y: 5 },
    { x: 2, y: 5 }
  ];
  game.dir = { x: 1, y: 0, key: 'right' };
  game.food = { x: 6, y: 5 };
  game.score = 0;

  const moved = controller.update(120);
  assert.equal(moved, true);
  assert.equal(game.score, 10);
  assert.equal(game.eaten, 1);
  assert.equal(game.snake.length, 5);
});

test('暂停、继续与切后台自动暂停', () => {
  const controller = create();
  controller.startGame();
  const game = controller.getView().game;
  const head = { ...game.snake[0] };

  const playing = Renderer.getLayout(375, 812, 'playing', 44);
  assert.equal(tapRect(controller, playing, playing.dpad.center), true);
  assert.equal(controller.getScene(), 'paused');

  controller.update(1000);
  assert.deepEqual(game.snake[0], head);

  const paused = Renderer.getLayout(375, 812, 'paused', 44);
  assert.equal(tapRect(controller, paused, paused.resume), true);
  assert.equal(controller.getScene(), 'playing');

  controller.onHide();
  assert.equal(controller.getScene(), 'paused');
});

test('滑动不会反向，合法滑动会转向', () => {
  const controller = create();
  controller.setDifficulty('hard');
  controller.startGame();
  const game = controller.getView().game;
  game.food = { x: 0, y: 0 };

  assert.equal(controller.swipe(-30, 0), false);
  assert.equal(controller.swipe(0, -30), true);
  controller.update(120);
  assert.equal(game.dir.x, 0);
  assert.equal(game.dir.y, -1);
  assert.deepEqual(game.snake[0], { x: 10, y: 9 });
});

test('撞墙结束游戏、刷新最高分并持久化', () => {
  const storage = createStorage();
  const controller = Controller.createController({ storage, now: () => 1000 });
  controller.setDifficulty('hard');
  controller.startGame();
  const game = controller.getView().game;
  game.snake = [
    { x: 19, y: 10 },
    { x: 18, y: 10 },
    { x: 17, y: 10 },
    { x: 16, y: 10 }
  ];
  game.dir = { x: 1, y: 0, key: 'right' };
  game.food = { x: 0, y: 0 };
  game.score = 40;

  controller.update(120);
  assert.equal(controller.getScene(), 'over');
  const view = controller.getView();
  assert.equal(view.score, 40);
  assert.equal(view.best, 40);
  assert.equal(view.isNewBest, true);
  assert.deepEqual(storage.get(Controller.STORAGE_BEST), {
    easy: 0,
    normal: 0,
    hard: 40
  });

  const over = Renderer.getLayout(375, 812, 'over', 44);
  assert.equal(tapRect(controller, over, over.restart), true);
  assert.equal(controller.getScene(), 'playing');
  assert.equal(controller.getView().score, 0);
});

test('最高分在重新启动后仍然保留，低分不会覆盖纪录', () => {
  const storage = createStorage();
  const first = Controller.createController({ storage, now: () => 1000 });
  first.setDifficulty('normal');
  first.startGame();
  const game = first.getView().game;
  game.snake = [
    { x: 19, y: 10 },
    { x: 18, y: 10 },
    { x: 17, y: 10 },
    { x: 16, y: 10 }
  ];
  game.dir = { x: 1, y: 0, key: 'right' };
  game.food = { x: 0, y: 0 };
  game.score = 80;
  first.update(120);
  first.update(120);

  const second = Controller.createController({ storage, now: () => 2000 });
  assert.equal(second.getView().difficulty, 'normal');
  assert.equal(second.getView().best, 80);
  second.startGame();
  const secondGame = second.getView().game;
  secondGame.snake = [
    { x: 19, y: 10 },
    { x: 18, y: 10 },
    { x: 17, y: 10 },
    { x: 16, y: 10 }
  ];
  secondGame.dir = { x: 1, y: 0, key: 'right' };
  secondGame.food = { x: 0, y: 0 };
  secondGame.score = 30;
  second.update(120);
  second.update(120);

  assert.equal(second.getView().best, 80);
  assert.equal(second.getView().isNewBest, false);
});

test('导航事件只在对应场景生效，返回主页可重开', () => {
  const controller = create();
  assert.equal(controller.pause(), false);
  assert.equal(controller.resume(), false);
  assert.equal(controller.setDifficulty('unknown'), false);

  controller.startGame();
  assert.equal(controller.setDifficulty('easy'), false);
  controller.home();
  assert.equal(controller.getScene(), 'menu');

  const menu = Renderer.getLayout(375, 812, 'menu', 44);
  tapRect(controller, menu, menu.start);
  assert.equal(controller.getScene(), 'playing');
  const paused = Renderer.getLayout(375, 812, 'paused', 44);
  controller.pause();
  assert.equal(tapRect(controller, paused, paused.restart), true);
  assert.equal(controller.getScene(), 'playing');
  controller.pause();
  assert.equal(tapRect(controller, paused, paused.home), true);
  assert.equal(controller.getScene(), 'menu');
});

test('损坏的存储数据会回退到默认值', () => {
  const storage = createStorage({
    [Controller.STORAGE_BEST]: '{bad json',
    [Controller.STORAGE_DIFFICULTY]: 'nightmare'
  });
  const controller = Controller.createController({ storage, now: () => 1000 });
  const view = controller.getView();
  assert.equal(view.best, 0);
  assert.equal(view.difficulty, 'normal');
  assert.deepEqual(view.bests, { easy: 0, normal: 0, hard: 0 });
});

test('控制器拒绝反向并接受垂直转向', () => {
  const controller = create();
  controller.startGame();
  const view = controller.getView();
  const game = view.game;
  game.food = { x: 0, y: 0 };
  assert.equal(controller.turn('left'), false);
  assert.equal(controller.turn('up'), true);
  assert.equal(game.queue.length, 1);
});
