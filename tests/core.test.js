const test = require('node:test');
const assert = require('node:assert/strict');

const Core = require('../miniprogram/game/core.js');

function createGame(options) {
  const game = Core.createGame(Object.assign({ rng: Core.createRng(7) }, options));
  game.food = { x: 0, y: 0 };
  return game;
}

test('createGame 初始化 20×20 棋盘、四条蛇身与合法食物', () => {
  const game = Core.createGame({ rng: Core.createRng(1) });
  assert.equal(game.cols, 20);
  assert.equal(game.rows, 20);
  assert.equal(game.snake.length, 4);
  assert.deepEqual(game.snake[0], { x: 10, y: 10 });
  assert.deepEqual(game.dir, Core.DIR.right);
  assert.equal(game.status, 'idle');
  assert.ok(game.food);
  assert.equal(
    game.snake.some((segment) => segment.x === game.food.x && segment.y === game.food.y),
    false
  );
});

test('未开始时 step 不会推进', () => {
  const game = createGame();
  const head = { ...game.snake[0] };
  const result = Core.step(game);
  assert.equal(result.moved, false);
  assert.deepEqual(game.snake[0], head);
});

test('开始后每次前进一格且长度不变', () => {
  const game = createGame();
  Core.start(game);
  const start = { ...game.snake[0] };
  const result = Core.step(game);
  assert.equal(result.moved, true);
  assert.deepEqual(game.snake[0], { x: start.x + 1, y: start.y });
  assert.equal(game.snake.length, 4);
});

test('吃到食物后得分增加、蛇身变长且食物不会落在蛇身上', () => {
  const game = createGame();
  Core.start(game);
  const head = game.snake[0];
  game.food = { x: head.x + 1, y: head.y };
  const result = Core.step(game);

  assert.equal(result.ate, true);
  assert.equal(game.score, 10);
  assert.equal(game.eaten, 1);
  assert.equal(game.snake.length, 5);
  assert.ok(game.food);
  assert.equal(
    game.snake.some((segment) => segment.x === game.food.x && segment.y === game.food.y),
    false
  );
});

test('撞墙会结束游戏', () => {
  const game = createGame();
  Core.start(game);
  game.snake = [
    { x: 19, y: 10 },
    { x: 18, y: 10 },
    { x: 17, y: 10 },
    { x: 16, y: 10 }
  ];
  game.dir = { x: 1, y: 0, key: 'right' };
  const result = Core.step(game);

  assert.equal(result.dead, true);
  assert.equal(game.status, 'over');
});

test('咬到自己的身体会结束游戏', () => {
  const game = createGame();
  Core.start(game);
  game.snake = [
    { x: 5, y: 5 },
    { x: 5, y: 6 },
    { x: 4, y: 6 },
    { x: 4, y: 5 },
    { x: 4, y: 4 }
  ];
  game.dir = { x: -1, y: 0, key: 'left' };
  const result = Core.step(game);

  assert.equal(result.dead, true);
  assert.equal(game.status, 'over');
});

test('尾巴让出的格子可以进入', () => {
  const game = createGame();
  Core.start(game);
  game.snake = [
    { x: 5, y: 5 },
    { x: 6, y: 5 },
    { x: 6, y: 6 },
    { x: 5, y: 6 }
  ];
  game.dir = { x: 0, y: 1, key: 'down' };
  const result = Core.step(game);

  assert.equal(result.dead, false);
  assert.deepEqual(game.snake[0], { x: 5, y: 6 });
  assert.equal(game.snake.length, 4);
});

test('不能直接反向，转向队列最多缓存两步', () => {
  const game = createGame();
  Core.start(game);

  assert.equal(Core.setDirection(game, 'left'), false);
  assert.equal(Core.setDirection(game, 'up'), true);
  assert.equal(Core.setDirection(game, 'left'), true);
  assert.equal(Core.setDirection(game, 'down'), false);
  assert.equal(game.queue.length, 2);
});

test('转向在下一步生效', () => {
  const game = createGame();
  Core.start(game);
  const start = { ...game.snake[0] };
  assert.equal(Core.setDirection(game, 'up'), true);
  Core.step(game);
  assert.deepEqual(game.snake[0], { x: start.x, y: start.y - 1 });
});

test('难度间隔随得分加快并受下限约束', () => {
  const game = createGame();
  assert.equal(Core.getInterval(game, 'easy'), 200);
  assert.equal(Core.getInterval(game, 'normal'), 150);
  assert.equal(Core.getInterval(game, 'hard'), 110);

  game.eaten = 10;
  assert.equal(Core.getInterval(game, 'easy'), 170);
  assert.equal(Core.getInterval(game, 'normal'), 110);
  assert.equal(Core.getInterval(game, 'hard'), 62);

  game.eaten = 1000;
  assert.equal(Core.getInterval(game, 'easy'), 110);
  assert.equal(Core.getInterval(game, 'normal'), 85);
  assert.equal(Core.getInterval(game, 'hard'), 62);
});

test('棋盘占满时无法生成新食物', () => {
  const game = Core.createGame({ cols: 2, rows: 2, rng: Core.createRng(3) });
  game.snake = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 }
  ];
  assert.equal(Core.spawnFood(game), null);
});

test('相同种子的随机数可复现', () => {
  const first = Core.createGame({ rng: Core.createRng(42) });
  const second = Core.createGame({ rng: Core.createRng(42) });
  assert.deepEqual(first.food, second.food);
});
