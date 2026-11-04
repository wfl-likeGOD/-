/**
 * 贪吃蛇核心逻辑（与渲染、宿主环境无关）。
 *
 * 同时支持两种加载方式：
 *  - 微信小程序：CommonJS require
 *  - 浏览器预览 / Node 测试：挂载到全局 SnakeCore
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SnakeCore = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var COLS = 20;
  var ROWS = 20;

  var DIR = {
    up: { x: 0, y: -1, key: 'up' },
    down: { x: 0, y: 1, key: 'down' },
    left: { x: -1, y: 0, key: 'left' },
    right: { x: 1, y: 0, key: 'right' }
  };

  var DIFFICULTIES = {
    easy: {
      key: 'easy',
      label: '简单',
      baseInterval: 200,
      minInterval: 110,
      speedUp: 3,
      color: '#5ce8a8'
    },
    normal: {
      key: 'normal',
      label: '普通',
      baseInterval: 150,
      minInterval: 85,
      speedUp: 4,
      color: '#b7ff5e'
    },
    hard: {
      key: 'hard',
      label: '困难',
      baseInterval: 110,
      minInterval: 62,
      speedUp: 5,
      color: '#ffb35c'
    }
  };

  var DIFFICULTY_KEYS = ['easy', 'normal', 'hard'];
  var DEFAULT_DIFFICULTY = 'normal';

  /** 小尺寸可复现随机数生成器（mulberry32），方便测试与截图。 */
  function createRng(seed) {
    var state = (seed >>> 0) || 0x9e3779b9;
    return function () {
      state |= 0;
      state = (state + 0x6d2b79f5) | 0;
      var t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function isOpposite(a, b) {
    return a.x + b.x === 0 && a.y + b.y === 0;
  }

  function copyDir(dir) {
    return { x: dir.x, y: dir.y, key: dir.key };
  }

  function isInside(game, point) {
    return point.x >= 0 && point.x < game.cols && point.y >= 0 && point.y < game.rows;
  }

  function spawnFood(game) {
    var occupied = {};
    var i;
    for (i = 0; i < game.snake.length; i += 1) {
      occupied[game.snake[i].x + ',' + game.snake[i].y] = true;
    }
    var free = [];
    for (var y = 0; y < game.rows; y += 1) {
      for (var x = 0; x < game.cols; x += 1) {
        if (!occupied[x + ',' + y]) {
          free.push({ x: x, y: y });
        }
      }
    }
    if (free.length === 0) {
      return null;
    }
    var index = Math.floor(game.rng() * free.length);
    if (index >= free.length) {
      index = free.length - 1;
    }
    return free[index];
  }

  function reset(game) {
    var centerX = Math.floor(game.cols / 2);
    var centerY = Math.floor(game.rows / 2);
    game.snake = [
      { x: centerX, y: centerY },
      { x: centerX - 1, y: centerY },
      { x: centerX - 2, y: centerY },
      { x: centerX - 3, y: centerY }
    ];
    game.dir = copyDir(DIR.right);
    game.queue = [];
    game.food = null;
    game.score = 0;
    game.eaten = 0;
    game.status = 'idle';
    game.food = spawnFood(game);
  }

  function createGame(options) {
    options = options || {};
    var game = {
      cols: options.cols || COLS,
      rows: options.rows || ROWS,
      rng: options.rng || Math.random,
      snake: [],
      dir: copyDir(DIR.right),
      queue: [],
      food: null,
      score: 0,
      eaten: 0,
      status: 'idle'
    };
    reset(game);
    return game;
  }

  function start(game) {
    if (game.status === 'over' || game.status === 'won') {
      reset(game);
    }
    game.status = 'running';
  }

  /**
   * 记录一次转向。最多缓存两步，避免快速连续操作丢输入。
   * 返回是否成功入队。
   */
  function setDirection(game, direction) {
    if (game.status !== 'running') {
      return false;
    }
    var next = typeof direction === 'string' ? DIR[direction] : direction;
    if (!next || typeof next.x !== 'number' || typeof next.y !== 'number') {
      return false;
    }
    var base = game.queue.length ? game.queue[game.queue.length - 1] : game.dir;
    if (next.x === base.x && next.y === base.y) {
      return false;
    }
    if (isOpposite(next, base)) {
      return false;
    }
    if (game.queue.length >= 2) {
      return false;
    }
    game.queue.push({ x: next.x, y: next.y, key: next.key || '' });
    return true;
  }

  /**
   * 前进一格。返回本次推进的结果：
   * { moved, ate, dead, won }
   */
  function step(game) {
    var result = { moved: false, ate: false, dead: false, won: false };
    if (game.status !== 'running') {
      return result;
    }

    while (game.queue.length > 0) {
      var queued = game.queue.shift();
      if (!isOpposite(queued, game.dir)) {
        game.dir = copyDir(queued);
        break;
      }
    }

    var head = game.snake[0];
    var target = { x: head.x + game.dir.x, y: head.y + game.dir.y };

    if (!isInside(game, target)) {
      game.status = 'over';
      result.dead = true;
      return result;
    }

    var ate = !!game.food && target.x === game.food.x && target.y === game.food.y;
    var checkLength = ate ? game.snake.length : game.snake.length - 1;
    for (var i = 0; i < checkLength; i += 1) {
      if (game.snake[i].x === target.x && game.snake[i].y === target.y) {
        game.status = 'over';
        result.dead = true;
        return result;
      }
    }

    game.snake.unshift(target);
    result.moved = true;

    if (ate) {
      game.score += 10;
      game.eaten += 1;
      result.ate = true;
      game.food = spawnFood(game);
      if (!game.food) {
        game.status = 'won';
        result.won = true;
      }
    } else {
      game.snake.pop();
    }

    return result;
  }

  /** 当前难度下每一步的间隔（毫秒），随吃到的果实数量逐步加快。 */
  function getInterval(game, difficultyKey) {
    var config = DIFFICULTIES[difficultyKey] || DIFFICULTIES[DEFAULT_DIFFICULTY];
    return Math.max(config.minInterval, config.baseInterval - game.eaten * config.speedUp);
  }

  function isRunning(game) {
    return game.status === 'running';
  }

  return {
    COLS: COLS,
    ROWS: ROWS,
    DIR: DIR,
    DIFFICULTIES: DIFFICULTIES,
    DIFFICULTY_KEYS: DIFFICULTY_KEYS,
    DEFAULT_DIFFICULTY: DEFAULT_DIFFICULTY,
    createRng: createRng,
    createGame: createGame,
    reset: reset,
    start: start,
    setDirection: setDirection,
    step: step,
    getInterval: getInterval,
    isRunning: isRunning,
    spawnFood: spawnFood
  };
});
