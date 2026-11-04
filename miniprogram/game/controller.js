/**
 * 界面状态机：把纯逻辑（core）和宿主页面 / 浏览器预览粘合在一起。
 * 同一套状态机负责菜单、游戏、暂停、结算以及最高分持久化。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./core'));
  } else {
    root.SnakeController = factory(root.SnakeCore);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Core) {
  'use strict';

  var STORAGE_BEST = 'snake.best.v1';
  var STORAGE_DIFFICULTY = 'snake.difficulty.v1';
  var SWIPE_THRESHOLD = 16;

  var SCENES = {
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    OVER: 'over'
  };

  function normalizeBests(raw) {
    var value = raw;
    if (typeof raw === 'string') {
      try {
        value = JSON.parse(raw);
      } catch (error) {
        value = null;
      }
    }
    if (!value || typeof value !== 'object') {
      value = {};
    }
    var bests = {};
    for (var i = 0; i < Core.DIFFICULTY_KEYS.length; i += 1) {
      var key = Core.DIFFICULTY_KEYS[i];
      var score = Number(value[key]);
      bests[key] = isFinite(score) && score > 0 ? Math.floor(score) : 0;
    }
    return bests;
  }

  function createController(options) {
    options = options || {};
    var storage = options.storage || {
      get: function () {
        return null;
      },
      set: function () {}
    };
    var onEvent = typeof options.onEvent === 'function' ? options.onEvent : function () {};
    var now = typeof options.now === 'function' ? options.now : Date.now;

    var game = Core.createGame();
    var bests = normalizeBests(storage.get(STORAGE_BEST));
    var difficulty = Core.DEFAULT_DIFFICULTY;
    var storedDifficulty = storage.get(STORAGE_DIFFICULTY);
    if (Core.DIFFICULTIES[storedDifficulty]) {
      difficulty = storedDifficulty;
    }

    var scene = SCENES.MENU;
    var accumulator = 0;
    var tickInterval = Core.getInterval(game, difficulty);
    var isNewBest = false;
    var lastScore = 0;
    var sceneChangedAt = now();

    function saveBests() {
      storage.set(STORAGE_BEST, {
        easy: bests.easy,
        normal: bests.normal,
        hard: bests.hard
      });
    }

    function enterScene(next) {
      scene = next;
      sceneChangedAt = now();
    }

    function startGame() {
      Core.reset(game);
      Core.start(game);
      accumulator = 0;
      tickInterval = Core.getInterval(game, difficulty);
      isNewBest = false;
      lastScore = 0;
      enterScene(SCENES.PLAYING);
      onEvent('start');
    }

    function finish(won) {
      lastScore = game.score;
      var previousBest = bests[difficulty] || 0;
      isNewBest = lastScore > previousBest;
      if (isNewBest) {
        bests[difficulty] = lastScore;
        saveBests();
      }
      enterScene(SCENES.OVER);
      onEvent(won ? 'win' : 'die');
    }

    function home() {
      accumulator = 0;
      isNewBest = false;
      Core.reset(game);
      enterScene(SCENES.MENU);
      onEvent('home');
    }

    function pause() {
      if (scene !== SCENES.PLAYING) {
        return false;
      }
      accumulator = 0;
      enterScene(SCENES.PAUSED);
      onEvent('pause');
      return true;
    }

    function resume() {
      if (scene !== SCENES.PAUSED) {
        return false;
      }
      accumulator = 0;
      enterScene(SCENES.PLAYING);
      onEvent('resume');
      return true;
    }

    function togglePause() {
      return scene === SCENES.PLAYING ? pause() : resume();
    }

    function setDifficulty(key) {
      if (scene !== SCENES.MENU || !Core.DIFFICULTIES[key]) {
        return false;
      }
      if (difficulty === key) {
        return true;
      }
      difficulty = key;
      storage.set(STORAGE_DIFFICULTY, key);
      tickInterval = Core.getInterval(game, difficulty);
      onEvent('difficulty');
      return true;
    }

    function update(deltaMs) {
      if (scene !== SCENES.PLAYING) {
        return false;
      }
      var delta = typeof deltaMs === 'number' && isFinite(deltaMs) ? deltaMs : 16;
      delta = Math.max(0, Math.min(delta, 120));
      accumulator += delta;

      var moved = false;
      var guard = 0;
      while (scene === SCENES.PLAYING && accumulator >= tickInterval && guard < 5) {
        accumulator -= tickInterval;
        guard += 1;
        var result = Core.step(game);
        moved = moved || result.moved;
        if (result.ate) {
          onEvent('eat');
        }
        if (result.dead) {
          finish(false);
          break;
        }
        if (result.won) {
          finish(true);
          break;
        }
        tickInterval = Core.getInterval(game, difficulty);
      }

      if (accumulator > tickInterval * 2) {
        accumulator = 0;
      }
      return moved;
    }

    function turn(direction) {
      if (scene !== SCENES.PLAYING) {
        return false;
      }
      var accepted = Core.setDirection(game, direction);
      if (accepted) {
        onEvent('turn');
      }
      return accepted;
    }

    function swipe(deltaX, deltaY) {
      var dx = Number(deltaX) || 0;
      var dy = Number(deltaY) || 0;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) {
        return false;
      }
      var direction;
      if (Math.abs(dx) >= Math.abs(dy)) {
        direction = dx > 0 ? 'right' : 'left';
      } else {
        direction = dy > 0 ? 'down' : 'up';
      }
      return turn(direction);
    }

    function hit(rect, x, y) {
      return !!rect && x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
    }

    function tap(layout, x, y) {
      if (!layout) {
        return false;
      }

      if (scene === SCENES.MENU) {
        var pills = layout.difficulty || [];
        for (var i = 0; i < pills.length; i += 1) {
          if (hit(pills[i], x, y)) {
            return setDifficulty(pills[i].key);
          }
        }
        if (hit(layout.start, x, y)) {
          startGame();
          return true;
        }
        return false;
      }

      if (scene === SCENES.PLAYING) {
        var pad = layout.dpad || {};
        if (hit(pad.up, x, y)) {
          return turn('up');
        }
        if (hit(pad.down, x, y)) {
          return turn('down');
        }
        if (hit(pad.left, x, y)) {
          return turn('left');
        }
        if (hit(pad.right, x, y)) {
          return turn('right');
        }
        if (hit(pad.center, x, y)) {
          return pause();
        }
        return false;
      }

      if (scene === SCENES.PAUSED) {
        if (hit(layout.resume, x, y)) {
          return resume();
        }
        if (hit(layout.restart, x, y)) {
          startGame();
          return true;
        }
        if (hit(layout.home, x, y)) {
          home();
          return true;
        }
        return false;
      }

      if (scene === SCENES.OVER) {
        if (hit(layout.restart, x, y)) {
          startGame();
          return true;
        }
        if (hit(layout.home, x, y)) {
          home();
          return true;
        }
        return false;
      }

      return false;
    }

    function onHide() {
      if (scene === SCENES.PLAYING) {
        pause();
      }
    }

    function getView() {
      return {
        scene: scene,
        difficulty: difficulty,
        difficultyInfo: Core.DIFFICULTIES[difficulty],
        difficultyInfoMap: {
          easy: Core.DIFFICULTIES.easy.label,
          normal: Core.DIFFICULTIES.normal.label,
          hard: Core.DIFFICULTIES.hard.label
        },
        best: bests[difficulty] || 0,
        bests: {
          easy: bests.easy,
          normal: bests.normal,
          hard: bests.hard
        },
        isNewBest: isNewBest,
        score: game.score,
        lastScore: lastScore,
        speed: tickInterval,
        sceneChangedAt: sceneChangedAt,
        game: game
      };
    }

    return {
      startGame: startGame,
      restart: startGame,
      home: home,
      pause: pause,
      resume: resume,
      togglePause: togglePause,
      setDifficulty: setDifficulty,
      update: update,
      turn: turn,
      swipe: swipe,
      tap: tap,
      onHide: onHide,
      getView: getView,
      getScene: function () {
        return scene;
      },
      getBest: function () {
        return bests[difficulty] || 0;
      }
    };
  }

  return {
    SCENES: SCENES,
    SWIPE_THRESHOLD: SWIPE_THRESHOLD,
    STORAGE_BEST: STORAGE_BEST,
    STORAGE_DIFFICULTY: STORAGE_DIFFICULTY,
    createController: createController
  };
});
