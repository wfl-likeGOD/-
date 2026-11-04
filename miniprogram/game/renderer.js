/**
 * Canvas 渲染器与点击区域布局。
 *
 * 微信小程序页面和浏览器预览共用这一份渲染代码，
 * 因此预览截图能反映小程序里真实的画面与布局。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SnakeRenderer = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var FONT_STACK = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Helvetica Neue",Arial,sans-serif';
  var COLORS = {
    bgTop: '#071019',
    bgMid: '#08141a',
    bgBottom: '#050b0f',
    panel: '#0b1a20',
    panelDeep: '#071217',
    border: 'rgba(102,255,198,0.20)',
    text: '#eafff5',
    muted: '#83a99a',
    faint: '#4f6f63',
    green: '#4cf3a4',
    lime: '#c7ff63',
    mint: '#a8ffd0',
    food: '#ff5f6d',
    foodLight: '#ffb07a'
  };

  var MENU_DEMO = {
    cols: 12,
    rows: 12,
    snake: [
      { x: 7, y: 4 },
      { x: 6, y: 4 },
      { x: 5, y: 4 },
      { x: 5, y: 5 },
      { x: 5, y: 6 },
      { x: 4, y: 6 },
      { x: 3, y: 6 },
      { x: 3, y: 7 },
      { x: 3, y: 8 },
      { x: 4, y: 8 }
    ],
    dir: { x: 1, y: 0 },
    food: { x: 9, y: 7 }
  };

  function font(size, weight) {
    return (weight || 600) + ' ' + size + 'px ' + FONT_STACK;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function mixColor(from, to, t) {
    var a = parseInt(from.slice(1), 16);
    var b = parseInt(to.slice(1), 16);
    var ar = (a >> 16) & 255;
    var ag = (a >> 8) & 255;
    var ab = a & 255;
    var br = (b >> 16) & 255;
    var bg = (b >> 8) & 255;
    var bb = b & 255;
    var ratio = clamp(t, 0, 1);
    var r = Math.round(ar + (br - ar) * ratio);
    var g = Math.round(ag + (bg - ag) * ratio);
    var bl = Math.round(ab + (bb - ab) * ratio);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }

  function roundRectPath(ctx, x, y, w, h, radius) {
    var r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function fillRoundRect(ctx, x, y, w, h, radius, fillStyle) {
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }

  function strokeRoundRect(ctx, x, y, w, h, radius, strokeStyle, lineWidth) {
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth || 1;
    ctx.stroke();
  }

  function drawSpacedText(ctx, text, centerX, baselineY, spacing) {
    var chars = String(text).split('');
    var widths = [];
    var total = 0;
    var i;
    for (i = 0; i < chars.length; i += 1) {
      widths.push(ctx.measureText(chars[i]).width);
      total += widths[i];
    }
    total += spacing * Math.max(0, chars.length - 1);
    var x = centerX - total / 2;
    var previousAlign = ctx.textAlign;
    ctx.textAlign = 'left';
    for (i = 0; i < chars.length; i += 1) {
      ctx.fillText(chars[i], x, baselineY);
      x += widths[i] + spacing;
    }
    ctx.textAlign = previousAlign;
  }

  function drawSparkle(ctx, cx, cy, radius, color) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius);
    ctx.quadraticCurveTo(cx + radius * 0.18, cy - radius * 0.18, cx + radius, cy);
    ctx.quadraticCurveTo(cx + radius * 0.18, cy + radius * 0.18, cx, cy + radius);
    ctx.quadraticCurveTo(cx - radius * 0.18, cy + radius * 0.18, cx - radius, cy);
    ctx.quadraticCurveTo(cx - radius * 0.18, cy - radius * 0.18, cx, cy - radius);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawChevron(ctx, cx, cy, angle, size, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(-size * 0.46, size * 0.34);
    ctx.lineTo(0, -size * 0.36);
    ctx.lineTo(size * 0.46, size * 0.34);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, size * 0.17);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
  }

  function getPad(width) {
    return Math.max(18, Math.round(width * 0.052));
  }

  function getTopbarY(safeTop) {
    return (typeof safeTop === 'number' ? safeTop : 24) + 10;
  }

  function getModalLayout(width, height, scene, safeTop) {
    var isOver = scene === 'over';
    var cardW = Math.min(width - 48, 320);
    var cardH = isOver ? 344 : 320;
    var x = (width - cardW) / 2;
    var top = typeof safeTop === 'number' ? safeTop : 24;
    var y = Math.max(top + 20, (height - cardH) / 2 - 6);
    var pad = 24;
    var buttonX = x + pad;
    var buttonW = cardW - pad * 2;
    if (isOver) {
      return {
        card: { x: x, y: y, w: cardW, h: cardH },
        restart: { x: buttonX, y: y + 222, w: buttonW, h: 54 },
        home: { x: buttonX, y: y + 288, w: buttonW, h: 44 }
      };
    }
    return {
      card: { x: x, y: y, w: cardW, h: cardH },
      resume: { x: buttonX, y: y + 160, w: buttonW, h: 52 },
      restart: { x: buttonX, y: y + 224, w: buttonW, h: 44 },
      home: { x: buttonX, y: y + 278, w: buttonW, h: 30 }
    };
  }

  function getMenuLayout(width, height, safeTop) {
    var pad = getPad(width);
    var topbarY = getTopbarY(safeTop);
    var compact = height < 720;
    var titleY = topbarY + (compact ? 78 : 104);
    var subtitleY = titleY + (compact ? 34 : 40);
    var boardSize = compact
      ? Math.min(width - pad * 2, 240, height * 0.36)
      : Math.min(width - pad * 2, 300, height * 0.37);
    var boardY = Math.max(subtitleY + 20, titleY + (compact ? 56 : 66));
    var diffLabelY = boardY + boardSize + (compact ? 22 : 28);
    var pillsY = diffLabelY + 18;
    var pillGap = 10;
    var pillW = (boardSize - pillGap * 2) / 3;
    var startY = pillsY + 40 + (compact ? 18 : 26);
    var hintY = startY + 58 + (compact ? 18 : 28);
    var footerY = hintY + (compact ? 30 : 36);
    if (footerY > height - 14) {
      footerY = null;
    }
    return {
      width: width,
      height: height,
      safeTop: safeTop,
      pad: pad,
      topbarY: topbarY,
      compact: compact,
      titleY: titleY,
      subtitleY: subtitleY,
      board: { x: (width - boardSize) / 2, y: boardY, w: boardSize, h: boardSize },
      difficultyLabelY: diffLabelY,
      difficulty: ['easy', 'normal', 'hard'].map(function (key, index) {
        return {
          key: key,
          x: (width - boardSize) / 2 + index * (pillW + pillGap),
          y: pillsY,
          w: pillW,
          h: 40
        };
      }),
      start: { x: (width - boardSize) / 2, y: startY, w: boardSize, h: 58 },
      hintY: hintY,
      footerY: footerY
    };
  }

  function getGameLayout(width, height, safeTop) {
    var pad = getPad(width);
    var topbarY = getTopbarY(safeTop);
    var score = { x: pad, y: topbarY, w: 104, h: 48 };
    var best = { x: score.x + score.w + 12, y: topbarY, w: 88, h: 48 };
    var boardTopBase = topbarY + 48 + 26;
    var button = Math.min(54, Math.floor((width - pad * 2 - 12) / 3));
    button = Math.max(44, button);
    var gap = 6;
    var dpadSize = button * 3 + gap * 2;
    var maxBoard = height - boardTopBase - dpadSize - 68;
    var boardSize = Math.max(200, Math.min(width - pad * 2, 335, maxBoard));
    var groupHeight = boardSize + 14 + dpadSize;
    var available = height - boardTopBase - 30;
    var offset = clamp((available - groupHeight) * 0.35, 0, 70);
    var boardTop = boardTopBase + offset;
    var board = {
      x: (width - boardSize) / 2,
      y: boardTop,
      w: boardSize,
      h: boardSize
    };
    var dpadTop = boardTop + boardSize + 14;
    var leftX = width / 2 - button * 1.5 - gap;
    var centerX = width / 2 - button / 2;
    var rightX = width / 2 + button / 2 + gap;
    var row2Y = dpadTop + button + gap;
    var row3Y = dpadTop + (button + gap) * 2;
    return {
      width: width,
      height: height,
      safeTop: safeTop,
      pad: pad,
      topbarY: topbarY,
      score: score,
      best: best,
      board: board,
      modeY: boardTop - 14,
      dpad: {
        up: { x: centerX, y: dpadTop, w: button, h: button },
        left: { x: leftX, y: row2Y, w: button, h: button },
        center: { x: centerX, y: row2Y, w: button, h: button },
        right: { x: rightX, y: row2Y, w: button, h: button },
        down: { x: centerX, y: row3Y, w: button, h: button }
      },
      hintY: dpadTop + dpadSize + 22
    };
  }

  function getLayout(width, height, scene, safeTop) {
    var finalSafeTop = typeof safeTop === 'number' ? safeTop : 24;
    var layout;
    if (scene === 'menu') {
      layout = getMenuLayout(width, height, finalSafeTop);
    } else {
      layout = getGameLayout(width, height, finalSafeTop);
      if (scene === 'paused' || scene === 'over') {
        var modal = getModalLayout(width, height, scene, finalSafeTop);
        layout.card = modal.card;
        if (modal.resume) {
          layout.resume = modal.resume;
        }
        if (modal.restart) {
          layout.restart = modal.restart;
        }
        if (modal.home) {
          layout.home = modal.home;
        }
      }
    }
    layout.scene = scene;
    return layout;
  }

  function drawBackground(ctx, width, height, time) {
    var background = ctx.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, COLORS.bgTop);
    background.addColorStop(0.55, COLORS.bgMid);
    background.addColorStop(1, COLORS.bgBottom);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    var glow = ctx.createRadialGradient(width * 0.86, height * 0.04, 0, width * 0.86, height * 0.04, width * 0.9);
    glow.addColorStop(0, 'rgba(58,255,168,0.13)');
    glow.addColorStop(0.45, 'rgba(32,150,110,0.05)');
    glow.addColorStop(1, 'rgba(4,10,14,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    var coolGlow = ctx.createRadialGradient(width * 0.08, height * 0.82, 0, width * 0.08, height * 0.82, width * 0.8);
    coolGlow.addColorStop(0, 'rgba(54,110,255,0.08)');
    coolGlow.addColorStop(1, 'rgba(4,10,14,0)');
    ctx.fillStyle = coolGlow;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(130,255,205,0.085)';
    var step = 32;
    for (var x = 16; x < width; x += step) {
      for (var y = 16; y < height; y += step) {
        ctx.fillRect(x, y, 1.4, 1.4);
      }
    }

    for (var i = 0; i < 7; i += 1) {
      var driftX = (i * 91 + time * (0.004 + i * 0.0008)) % (width + 40) - 20;
      var driftY = (i * 157 + time * 0.0025 * ((i % 3) + 1)) % (height + 40) - 20;
      ctx.beginPath();
      ctx.arc(driftX, driftY, 1.2 + (i % 3) * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(150,255,205,0.20)' : 'rgba(120,180,255,0.12)';
      ctx.fill();
    }
  }

  function drawLogo(ctx, x, y, size) {
    ctx.save();
    ctx.shadowColor = 'rgba(60,255,170,0.35)';
    ctx.shadowBlur = 14;
    fillRoundRect(ctx, x, y, size, size, size * 0.27, 'rgba(18,52,44,0.94)');
    ctx.restore();
    strokeRoundRect(ctx, x, y, size, size, size * 0.27, 'rgba(120,255,196,0.35)', 1.2);

    var u = size / 38;
    var segments = [
      { x: 8, y: 12 },
      { x: 15, y: 12 },
      { x: 22, y: 12 },
      { x: 22, y: 19 },
      { x: 15, y: 19 },
      { x: 15, y: 26 },
      { x: 22, y: 26 }
    ];
    for (var i = 0; i < segments.length; i += 1) {
      var seg = segments[i];
      var t = i / (segments.length - 1);
      fillRoundRect(
        ctx,
        x + seg.x * u,
        y + seg.y * u,
        7 * u,
        7 * u,
        2.6 * u,
        mixColor('#b9ffd9', '#1e9e6e', t)
      );
    }
    var headX = x + segments[segments.length - 1].x * u + 3.5 * u;
    var headY = y + segments[segments.length - 1].y * u + 3.5 * u;
    ctx.beginPath();
    ctx.arc(headX + 1.1 * u, headY - 1.2 * u, 0.9 * u, 0, Math.PI * 2);
    ctx.fillStyle = '#082018';
    ctx.fill();
  }

  function drawMenu(ctx, view, layout, time) {
    drawLogo(ctx, layout.pad, layout.topbarY, 38);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = font(15, 700);
    ctx.fillStyle = COLORS.text;
    ctx.fillText('SNAKE', layout.pad + 50, layout.topbarY + 18);
    ctx.font = font(8, 600);
    ctx.fillStyle = COLORS.faint;
    ctx.fillText('WECHAT MINI PROGRAM', layout.pad + 50, layout.topbarY + 33);

    var titleSize = layout.compact ? 48 : 58;
    var titleGradient = ctx.createLinearGradient(
      layout.width / 2 - 110,
      layout.titleY - titleSize,
      layout.width / 2 + 110,
      layout.titleY
    );
    titleGradient.addColorStop(0, '#7dffc0');
    titleGradient.addColorStop(0.55, '#c8ff63');
    titleGradient.addColorStop(1, '#5df0b0');
    ctx.save();
    ctx.shadowColor = 'rgba(80,255,180,0.28)';
    ctx.shadowBlur = 26;
    ctx.textAlign = 'center';
    ctx.font = font(titleSize, 800);
    ctx.fillStyle = titleGradient;
    ctx.fillText('贪吃蛇', layout.width / 2, layout.titleY);
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = font(12, 600);
    ctx.fillStyle = 'rgba(143,188,168,0.85)';
    drawSpacedText(ctx, 'SNAKE', layout.width / 2, layout.subtitleY, 7);

    var board = layout.board;
    var grid = drawBoardPanel(ctx, board, MENU_DEMO.cols, MENU_DEMO.rows, 26, true);
    ctx.save();
    clipBoard(ctx, grid);
    drawSnake(ctx, MENU_DEMO.snake, MENU_DEMO.dir, grid, time);
    drawFood(ctx, grid, MENU_DEMO.food, time);
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = font(11, 600);
    ctx.fillStyle = COLORS.muted;
    drawSpacedText(ctx, '选 择 难 度', layout.width / 2, layout.difficultyLabelY, 1.6);

    var difficulty = view.difficulty || 'normal';
    var infoMap = view.difficultyInfoMap || {};
    for (var i = 0; i < layout.difficulty.length; i += 1) {
      var pill = layout.difficulty[i];
      var selected = pill.key === difficulty;
      var label = infoMap[pill.key] || ({ easy: '简单', normal: '普通', hard: '困难' }[pill.key]);
      if (selected) {
        var pillGradient = ctx.createLinearGradient(pill.x, pill.y, pill.x + pill.w, pill.y + pill.h);
        pillGradient.addColorStop(0, '#59f2a8');
        pillGradient.addColorStop(1, '#c7ff63');
        ctx.save();
        ctx.shadowColor = 'rgba(80,255,175,0.35)';
        ctx.shadowBlur = 16;
        fillRoundRect(ctx, pill.x, pill.y, pill.w, pill.h, pill.h / 2, pillGradient);
        ctx.restore();
        ctx.font = font(14, 700);
        ctx.fillStyle = '#062016';
      } else {
        fillRoundRect(ctx, pill.x, pill.y, pill.w, pill.h, pill.h / 2, 'rgba(14,33,38,0.9)');
        strokeRoundRect(ctx, pill.x, pill.y, pill.w, pill.h, pill.h / 2, 'rgba(120,255,196,0.16)', 1);
        ctx.font = font(14, 600);
        ctx.fillStyle = 'rgba(198,235,220,0.82)';
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, pill.x + pill.w / 2, pill.y + pill.h / 2 + 1);
    }

    drawPrimaryButton(ctx, layout.start, '开始游戏', time, true);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = font(11, 500);
    ctx.fillStyle = 'rgba(131,169,154,0.9)';
    ctx.fillText('滑动屏幕控制方向 · 吃掉果实得分', layout.width / 2, layout.hintY);
    if (layout.footerY) {
      ctx.font = font(10, 500);
      ctx.fillStyle = 'rgba(79,111,99,0.9)';
      ctx.fillText(
        '最高分 ' + (view.best || 0) + ' · 撞墙或咬到自己即结束',
        layout.width / 2,
        layout.footerY
      );
    }
  }

  function drawStatCard(ctx, rect, label, value, accent) {
    fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 16, 'rgba(12,29,33,0.9)');
    strokeRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 16, 'rgba(120,255,196,0.13)', 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = font(9, 500);
    ctx.fillStyle = 'rgba(131,169,154,0.85)';
    ctx.fillText(label, rect.x + 13, rect.y + 16);
    ctx.font = font(21, 700);
    ctx.fillStyle = accent || COLORS.text;
    ctx.fillText(String(value), rect.x + 13, rect.y + 38);
  }

  function drawGameHeader(ctx, view, layout) {
    drawStatCard(ctx, layout.score, '得分', view.score, COLORS.lime);
    drawStatCard(ctx, layout.best, '最高', view.best, COLORS.text);
    var modeText = (view.difficultyInfo ? view.difficultyInfo.label : '普通') + '模式 · 20 × 20';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = font(10, 600);
    ctx.fillStyle = 'rgba(100,137,123,0.85)';
    drawSpacedText(ctx, modeText, layout.width / 2, layout.modeY, 1.2);
  }

  function drawDpad(ctx, layout) {
    var dpad = layout.dpad;
    drawDirectionButton(ctx, dpad.up, 0);
    drawDirectionButton(ctx, dpad.left, -Math.PI / 2);
    drawDirectionButton(ctx, dpad.right, Math.PI / 2);
    drawDirectionButton(ctx, dpad.down, Math.PI);
    var center = dpad.center;
    var cx = center.x + center.w / 2;
    var cy = center.y + center.h / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, center.w * 0.34, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(12,29,33,0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,255,196,0.13)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(160,235,203,0.8)';
    fillRoundRect(ctx, cx - 4.5, cy - 5.5, 3, 11, 1.4, 'rgba(160,235,203,0.8)');
    fillRoundRect(ctx, cx + 1.5, cy - 5.5, 3, 11, 1.4, 'rgba(160,235,203,0.8)');
  }

  function drawDirectionButton(ctx, rect, angle) {
    fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 16, 'rgba(13,32,37,0.88)');
    strokeRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 16, 'rgba(120,255,196,0.16)', 1);
    ctx.save();
    ctx.globalAlpha = 0.14;
    fillRoundRect(ctx, rect.x + 4, rect.y + 4, rect.w - 8, 5, 2.5, '#b8ffd9');
    ctx.restore();
    drawChevron(ctx, rect.x + rect.w / 2, rect.y + rect.h / 2, angle, rect.w * 0.34, 'rgba(162,255,206,0.9)');
  }

  function clipBoard(ctx, grid) {
    roundRectPath(
      ctx,
      grid.x + grid.inset * 0.4,
      grid.y + grid.inset * 0.4,
      grid.w - grid.inset * 0.8,
      grid.h - grid.inset * 0.8,
      18
    );
    ctx.clip();
  }

  function drawBoardPanel(ctx, board, cols, rows, radius, isMenu) {
    var gradient = ctx.createLinearGradient(board.x, board.y, board.x, board.y + board.h);
    gradient.addColorStop(0, 'rgba(13,32,37,0.98)');
    gradient.addColorStop(1, 'rgba(6,16,20,0.98)');
    ctx.save();
    ctx.shadowColor = isMenu ? 'rgba(74,255,180,0.16)' : 'rgba(60,255,175,0.10)';
    ctx.shadowBlur = isMenu ? 34 : 26;
    fillRoundRect(ctx, board.x, board.y, board.w, board.h, radius, gradient);
    ctx.restore();
    strokeRoundRect(ctx, board.x, board.y, board.w, board.h, radius, COLORS.border, 1.2);

    var inset = Math.max(8, board.w * 0.032);
    var innerX = board.x + inset;
    var innerY = board.y + inset;
    var innerW = board.w - inset * 2;
    var innerH = board.h - inset * 2;
    var cellW = innerW / cols;
    var cellH = innerH / rows;

    ctx.save();
    roundRectPath(ctx, innerX, innerY, innerW, innerH, 16);
    ctx.clip();
    ctx.strokeStyle = 'rgba(126,255,205,0.05)';
    ctx.lineWidth = 1;
    var i;
    for (i = 1; i < cols; i += 1) {
      var gx = innerX + cellW * i;
      ctx.beginPath();
      ctx.moveTo(gx, innerY);
      ctx.lineTo(gx, innerY + innerH);
      ctx.stroke();
    }
    for (i = 1; i < rows; i += 1) {
      var gy = innerY + cellH * i;
      ctx.beginPath();
      ctx.moveTo(innerX, gy);
      ctx.lineTo(innerX + innerW, gy);
      ctx.stroke();
    }
    ctx.restore();

    drawCornerAccents(ctx, board, inset);

    return {
      x: board.x,
      y: board.y,
      w: board.w,
      h: board.h,
      inset: inset,
      cols: cols,
      rows: rows
    };
  }

  function drawCornerAccents(ctx, board, inset) {
    var length = Math.min(18, board.w * 0.08);
    var offset = inset + 5;
    ctx.strokeStyle = 'rgba(124,255,197,0.45)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(board.x + offset, board.y + offset + length);
    ctx.lineTo(board.x + offset, board.y + offset);
    ctx.lineTo(board.x + offset + length, board.y + offset);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(board.x + board.w - offset - length, board.y + board.h - offset);
    ctx.lineTo(board.x + board.w - offset, board.y + board.h - offset);
    ctx.lineTo(board.x + board.w - offset, board.y + board.h - offset - length);
    ctx.stroke();
  }

  function cellCenter(grid, x, y) {
    var innerW = grid.w - grid.inset * 2;
    var innerH = grid.h - grid.inset * 2;
    var cellW = innerW / grid.cols;
    var cellH = innerH / grid.rows;
    return {
      x: grid.x + grid.inset + (x + 0.5) * cellW,
      y: grid.y + grid.inset + (y + 0.5) * cellH,
      w: cellW,
      h: cellH
    };
  }

  function drawSnake(ctx, snake, dir, grid, time) {
    if (!snake || snake.length === 0) {
      return;
    }
    var innerW = grid.w - grid.inset * 2;
    var cell = innerW / grid.cols;
    var points = [];
    for (var i = 0; i < snake.length; i += 1) {
      points.push(cellCenter(grid, snake[i].x, snake[i].y));
    }
    var head = points[0];
    var tail = points[points.length - 1];

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(tail.x, tail.y);
    for (var p = points.length - 2; p >= 0; p -= 1) {
      ctx.lineTo(points[p].x, points[p].y);
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.strokeStyle = 'rgba(2,14,10,0.92)';
    ctx.lineWidth = cell * 0.82;
    ctx.stroke();

    var bodyGradient = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y);
    bodyGradient.addColorStop(0, '#b4ffd4');
    bodyGradient.addColorStop(0.45, '#46eb9e');
    bodyGradient.addColorStop(1, '#0d7c58');
    ctx.strokeStyle = bodyGradient;
    ctx.lineWidth = cell * 0.64;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.shadowColor = 'rgba(120,255,190,0.7)';
    ctx.shadowBlur = 14;
    var headGradient = ctx.createLinearGradient(
      head.x - cell * 0.4,
      head.y - cell * 0.4,
      head.x + cell * 0.4,
      head.y + cell * 0.4
    );
    headGradient.addColorStop(0, '#dcffdf');
    headGradient.addColorStop(1, '#5df3a7');
    ctx.beginPath();
    ctx.arc(head.x, head.y, cell * 0.40, 0, Math.PI * 2);
    ctx.fillStyle = headGradient;
    ctx.fill();
    ctx.restore();

    drawSnakeEyes(ctx, head, dir, cell);
    drawTongue(ctx, head, dir, cell, time);
  }

  function drawSnakeEyes(ctx, head, dir, cell) {
    var direction = dir || { x: 1, y: 0 };
    var perpendicular = { x: -direction.y, y: direction.x };
    var eyeForward = cell * 0.18;
    var eyeSide = cell * 0.19;
    var eyeRadius = Math.max(1.4, cell * 0.105);
    var pupilRadius = Math.max(0.7, cell * 0.05);
    for (var sign = -1; sign <= 1; sign += 2) {
      var ex = head.x + direction.x * eyeForward + perpendicular.x * eyeSide * sign;
      var ey = head.y + direction.y * eyeForward + perpendicular.y * eyeSide * sign;
      ctx.beginPath();
      ctx.arc(ex, ey, eyeRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#f4fff9';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ex + direction.x * cell * 0.035, ey + direction.y * cell * 0.035, pupilRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#051b13';
      ctx.fill();
    }
  }

  function drawTongue(ctx, head, dir, cell, time) {
    if (Math.sin(time / 280) < 0.7) {
      return;
    }
    var direction = dir || { x: 1, y: 0 };
    var startX = head.x + direction.x * cell * 0.38;
    var startY = head.y + direction.y * cell * 0.38;
    var endX = head.x + direction.x * cell * 0.78;
    var endY = head.y + direction.y * cell * 0.78;
    var perpendicular = { x: -direction.y, y: direction.x };
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.lineTo(endX + perpendicular.x * 3 + direction.x * 2, endY + perpendicular.y * 3 + direction.y * 2);
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - perpendicular.x * 3 + direction.x * 2, endY - perpendicular.y * 3 + direction.y * 2);
    ctx.strokeStyle = '#ff6f86';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  function drawFood(ctx, grid, food, time) {
    if (!food) {
      return;
    }
    var center = cellCenter(grid, food.x, food.y);
    var cell = center.w;
    var pulse = 1 + Math.sin(time / 190) * 0.07;
    var radius = cell * 0.35 * pulse;
    var glow = ctx.createRadialGradient(center.x, center.y, radius * 0.4, center.x, center.y, radius * 2.3);
    glow.addColorStop(0, 'rgba(255,96,104,0.5)');
    glow.addColorStop(0.6, 'rgba(255,96,104,0.12)');
    glow.addColorStop(1, 'rgba(255,96,104,0)');
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius * 2.3, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    ctx.save();
    ctx.shadowColor = 'rgba(255,80,92,0.8)';
    ctx.shadowBlur = 12;
    var body = ctx.createRadialGradient(
      center.x - radius * 0.35,
      center.y - radius * 0.4,
      radius * 0.12,
      center.x,
      center.y,
      radius
    );
    body.addColorStop(0, '#ffb08a');
    body.addColorStop(0.4, '#ff6a70');
    body.addColorStop(1, '#e7324c');
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(center.x - radius * 0.30, center.y - radius * 0.34, radius * 0.24, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,240,225,0.75)';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(center.x, center.y - radius * 0.92);
    ctx.quadraticCurveTo(center.x + radius * 0.30, center.y - radius * 1.28, center.x + radius * 0.56, center.y - radius * 1.02);
    ctx.quadraticCurveTo(center.x + radius * 0.30, center.y - radius * 0.94, center.x, center.y - radius * 0.92);
    ctx.fillStyle = '#61d98d';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(center.x, center.y - radius * 0.98);
    ctx.lineTo(center.x + radius * 0.08, center.y - radius * 1.32);
    ctx.strokeStyle = '#8b6b43';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  function drawPrimaryButton(ctx, rect, label, time, withArrow) {
    var gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
    gradient.addColorStop(0, '#57f0a4');
    gradient.addColorStop(1, '#c7ff63');
    ctx.save();
    ctx.shadowColor = 'rgba(82,255,172,0.38)';
    ctx.shadowBlur = 20;
    fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, rect.h / 2, gradient);
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font(17, 700);
    ctx.fillStyle = '#052117';
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
    if (withArrow) {
      var arrowX = rect.x + rect.w - 30;
      var arrowY = rect.y + rect.h / 2;
      drawChevron(ctx, arrowX, arrowY, Math.PI / 2, 15, 'rgba(5,33,23,0.85)');
    }
  }

  function drawGhostButton(ctx, rect, label) {
    fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, rect.h / 2, 'rgba(18,42,44,0.55)');
    strokeRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, rect.h / 2, 'rgba(120,255,196,0.22)', 1);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font(14, 600);
    ctx.fillStyle = 'rgba(213,255,235,0.9)';
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
  }

  function drawTextButton(ctx, rect, label) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font(12, 600);
    ctx.fillStyle = 'rgba(131,169,154,0.9)';
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
  }

  function drawOverlay(ctx, view, layout, time) {
    var card = layout.card;
    var isOver = view.scene === 'over';
    var elapsed = typeof view.sceneChangedAt === 'number' ? time - view.sceneChangedAt : 999;
    var progress = clamp(elapsed / 220, 0, 1);
    var ease = 1 - Math.pow(1 - progress, 3);

    ctx.fillStyle = 'rgba(2,8,11,0.74)';
    ctx.fillRect(0, 0, layout.width, layout.height);

    ctx.save();
    var centerX = card.x + card.w / 2;
    var centerY = card.y + card.h / 2;
    var scale = 0.92 + ease * 0.08;
    ctx.globalAlpha = 0.35 + ease * 0.65;
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);
    ctx.translate(-centerX, -centerY);

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 40;
    var cardGradient = ctx.createLinearGradient(card.x, card.y, card.x, card.y + card.h);
    cardGradient.addColorStop(0, 'rgba(17,40,43,0.98)');
    cardGradient.addColorStop(1, 'rgba(8,20,24,0.98)');
    fillRoundRect(ctx, card.x, card.y, card.w, card.h, 28, cardGradient);
    ctx.restore();
    strokeRoundRect(ctx, card.x, card.y, card.w, card.h, 28, 'rgba(120,255,196,0.24)', 1.2);

    var glow = ctx.createRadialGradient(centerX, card.y + 10, 0, centerX, card.y + 10, card.w * 0.75);
    glow.addColorStop(0, isOver ? 'rgba(255,120,110,0.11)' : 'rgba(85,255,175,0.12)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(card.x, card.y, card.w, card.h);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = font(11, 600);
    ctx.fillStyle = isOver ? 'rgba(255,154,144,0.85)' : 'rgba(143,188,168,0.85)';
    drawSpacedText(ctx, isOver ? 'GAME OVER' : 'PAUSED', centerX, card.y + 26, 3);

    ctx.font = font(27, 800);
    ctx.fillStyle = COLORS.text;
    ctx.fillText(isOver ? '游戏结束' : '已暂停', centerX, card.y + 60);

    if (isOver) {
      ctx.font = font(11, 500);
      ctx.fillStyle = COLORS.muted;
      ctx.fillText('本局得分', centerX, card.y + 92);
      var scoreGradient = ctx.createLinearGradient(centerX - 70, card.y + 100, centerX + 70, card.y + 150);
      scoreGradient.addColorStop(0, '#7dffc0');
      scoreGradient.addColorStop(1, '#d3ff6b');
      ctx.font = font(48, 800);
      ctx.fillStyle = scoreGradient;
      ctx.fillText(String(view.score), centerX, card.y + 146);

      ctx.font = font(12, 500);
      ctx.fillStyle = view.isNewBest ? COLORS.lime : 'rgba(131,169,154,0.9)';
      var meta = view.isNewBest
        ? '新纪录！最高 ' + view.best + ' 分'
        : '最高 ' + view.best + ' 分 · 长度 ' + (view.game.snake ? view.game.snake.length : 0);
      ctx.fillText(meta, centerX, card.y + 178);

      drawPrimaryButton(ctx, layout.restart, '再来一局', time, false);
      drawGhostButton(ctx, layout.home, '返回主页');
    } else {
      ctx.font = font(12, 500);
      ctx.fillStyle = 'rgba(131,169,154,0.9)';
      ctx.fillText('休息一下，随时回来', centerX, card.y + 86);
      ctx.font = font(11, 500);
      ctx.fillStyle = COLORS.muted;
      ctx.fillText('本局得分', centerX, card.y + 112);
      ctx.font = font(30, 800);
      ctx.fillStyle = COLORS.lime;
      ctx.fillText(String(view.score), centerX, card.y + 144);

      drawPrimaryButton(ctx, layout.resume, '继续游戏', time, false);
      drawGhostButton(ctx, layout.restart, '重新开始');
      drawTextButton(ctx, layout.home, '返回主页');
    }

    ctx.restore();
  }

  function drawGameScene(ctx, view, layout, time) {
    drawGameHeader(ctx, view, layout);
    var game = view.game;
    var board = layout.board;
    var grid = drawBoardPanel(ctx, board, game.cols, game.rows, 24, false);
    ctx.save();
    clipBoard(ctx, grid);
    drawSnake(ctx, game.snake, game.dir, grid, time);
    drawFood(ctx, grid, game.food, time);
    ctx.restore();
    drawDpad(ctx, layout);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = font(10, 500);
    ctx.fillStyle = 'rgba(100,137,123,0.85)';
    drawSpacedText(ctx, '滑动屏幕或点击方向键控制 · 中心键暂停', layout.width / 2, layout.hintY, 0.6);
  }

  function draw(ctx, view, width, height, time, options) {
    if (!ctx || !view) {
      return;
    }
    options = options || {};
    var safeTop = typeof options.safeTop === 'number' ? options.safeTop : 24;
    var currentTime = typeof time === 'number' ? time : Date.now();
    var layout = getLayout(width, height, view.scene || 'menu', safeTop);
    drawBackground(ctx, width, height, currentTime);
    if (view.scene === 'menu') {
      drawMenu(ctx, view, layout, currentTime);
      return;
    }
    drawGameScene(ctx, view, layout, currentTime);
    if (view.scene === 'paused' || view.scene === 'over') {
      drawOverlay(ctx, view, layout, currentTime);
    }
  }

  return {
    COLORS: COLORS,
    getLayout: getLayout,
    draw: draw
  };
});
