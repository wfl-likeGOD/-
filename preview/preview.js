(function () {
  'use strict';

  var Core = window.SnakeCore;
  var Controller = window.SnakeController;
  var Renderer = window.SnakeRenderer;

  var stage = document.getElementById('stage');
  var canvas = document.getElementById('gameCanvas');
  var ctx = canvas.getContext('2d');

  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var SAFE_TOP = 48;
  var width = stage.clientWidth;
  var height = stage.clientHeight;

  canvas.width = Math.round(width * DPR);
  canvas.height = Math.round(height * DPR);
  ctx.scale(DPR, DPR);

  var params = new URLSearchParams(window.location.search);
  var capture = params.get('capture');

  var DEMO_SNAKE = [
    { x: 12, y: 9 },
    { x: 11, y: 9 },
    { x: 10, y: 9 },
    { x: 10, y: 10 },
    { x: 10, y: 11 },
    { x: 9, y: 11 },
    { x: 8, y: 11 },
    { x: 8, y: 12 },
    { x: 8, y: 13 },
    { x: 7, y: 13 },
    { x: 7, y: 14 },
    { x: 7, y: 15 }
  ];

  var DIFFICULTY_LABELS = {
    easy: '简单',
    normal: '普通',
    hard: '困难'
  };

  function createDemoGame(options) {
    var game = Core.createGame({ rng: Core.createRng(2048) });
    game.snake = DEMO_SNAKE.map(function (point) {
      return { x: point.x, y: point.y };
    });
    game.dir = { x: 1, y: 0, key: 'right' };
    game.food = { x: 16, y: 8 };
    game.score = options.score;
    game.eaten = options.eaten;
    game.status = options.status;
    return game;
  }

  function createDemoView(scene, options) {
    var game = createDemoGame({
      score: options.score,
      eaten: options.eaten,
      status: scene === 'over' ? 'over' : 'running'
    });
    return {
      scene: scene,
      difficulty: 'normal',
      difficultyInfo: Core.DIFFICULTIES.normal,
      difficultyInfoMap: DIFFICULTY_LABELS,
      best: options.best,
      bests: { easy: 80, normal: options.best, hard: 120 },
      isNewBest: !!options.isNewBest,
      score: options.score,
      lastScore: options.score,
      speed: 150,
      sceneChangedAt: Date.now() - 1000,
      game: game
    };
  }

  function drawCaptureView(scene) {
    var view;
    if (scene === 'menu') {
      view = createDemoView('menu', { score: 0, eaten: 0, best: 180, isNewBest: false });
    } else if (scene === 'paused') {
      view = createDemoView('paused', { score: 140, eaten: 14, best: 180, isNewBest: false });
    } else if (scene === 'over') {
      view = createDemoView('over', { score: 210, eaten: 21, best: 210, isNewBest: true });
    } else {
      view = createDemoView('playing', { score: 140, eaten: 14, best: 180, isNewBest: false });
    }
    Renderer.draw(ctx, view, width, height, Date.now(), { safeTop: SAFE_TOP });
  }

  function readStorage(key) {
    try {
      var raw = window.localStorage.getItem(key);
      if (raw === null) {
        return null;
      }
      try {
        return JSON.parse(raw);
      } catch (error) {
        return raw;
      }
    } catch (error) {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // 预览模式下存储不可用也不影响游戏。
    }
  }

  function mapPointer(event) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * width,
      y: ((event.clientY - rect.top) / rect.height) * height
    };
  }

  function startInteractive() {
    var controller = Controller.createController({
      storage: { get: readStorage, set: writeStorage },
      onEvent: function (name) {
        if (name === 'die' && window.navigator && window.navigator.vibrate) {
          window.navigator.vibrate(30);
        }
      }
    });

    window.__snakePreview = {
      controller: controller,
      view: function () {
        return controller.getView();
      }
    };

    var pointerStart = null;

    canvas.addEventListener('pointerdown', function (event) {
      pointerStart = mapPointer(event);
      if (canvas.setPointerCapture) {
        try {
          canvas.setPointerCapture(event.pointerId);
        } catch (error) {
          // 某些浏览器不支持指针捕获，忽略即可。
        }
      }
    });

    function finishPointer(event) {
      if (!pointerStart) {
        return;
      }
      var point = mapPointer(event);
      var dx = point.x - pointerStart.x;
      var dy = point.y - pointerStart.y;
      pointerStart = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) >= 16) {
        controller.swipe(dx, dy);
      } else {
        var layout = Renderer.getLayout(width, height, controller.getScene(), SAFE_TOP);
        controller.tap(layout, point.x, point.y);
      }
    }

    canvas.addEventListener('pointerup', finishPointer);
    canvas.addEventListener('pointercancel', function () {
      pointerStart = null;
    });

    var keyDirections = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      w: 'up',
      s: 'down',
      a: 'left',
      d: 'right',
      W: 'up',
      S: 'down',
      A: 'left',
      D: 'right'
    };

    window.addEventListener('keydown', function (event) {
      if (keyDirections[event.key]) {
        event.preventDefault();
        controller.turn(keyDirections[event.key]);
        return;
      }
      if (event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        controller.togglePause();
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        var scene = controller.getScene();
        if (scene === 'menu' || scene === 'over') {
          controller.startGame();
        } else if (scene === 'paused') {
          controller.resume();
        }
      }
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        controller.onHide();
      }
    });

    var lastTick = 0;
    function frame(timestamp) {
      var now = typeof timestamp === 'number' ? timestamp : Date.now();
      var delta = lastTick ? now - lastTick : 16;
      lastTick = now;
      controller.update(delta);
      Renderer.draw(ctx, controller.getView(), width, height, Date.now(), { safeTop: SAFE_TOP });
      window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);
  }

  if (capture) {
    drawCaptureView(capture);
    window.requestAnimationFrame(function () {
      drawCaptureView(capture);
      document.documentElement.setAttribute('data-capture-ready', 'true');
    });
  } else {
    startInteractive();
  }
})();
