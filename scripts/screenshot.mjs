import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = join(root, 'docs', 'screenshots');
const previewUrl = pathToFileURL(join(root, 'preview', 'index.html'));

const candidates = [
  process.env.EDGE_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/microsoft-edge',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].filter(Boolean);

const browser = candidates.find((candidate) => existsSync(candidate));
if (!browser) {
  console.error('未找到 Edge/Chrome。请通过 EDGE_PATH 指定浏览器可执行文件路径。');
  process.exit(1);
}

mkdirSync(outputDir, { recursive: true });

const shots = [
  { scene: 'menu', file: 'menu.png' },
  { scene: 'playing', file: 'playing.png' },
  { scene: 'paused', file: 'paused.png' },
  { scene: 'over', file: 'gameover.png' }
];

let failed = false;

for (const shot of shots) {
  const target = join(outputDir, shot.file);
  const profile = join(root, '.tmp', `edge-${process.pid}-${shot.scene}`);
  const url = `${previewUrl.href}?capture=${shot.scene}`;
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--window-size=375,812',
    '--force-device-scale-factor=2',
    '--virtual-time-budget=3000',
    `--user-data-dir=${profile}`,
    `--screenshot=${target}`,
    url
  ];

  console.log(`[screenshot] ${shot.scene} -> ${target}`);
  const result = spawnSync(browser, args, {
    cwd: root,
    stdio: 'inherit',
    timeout: 120000
  });

  if (result.error) {
    console.error(result.error.message);
    failed = true;
  } else if (result.status !== 0) {
    console.error(`浏览器退出码：${result.status}`);
    failed = true;
  } else if (!existsSync(target) || statSync(target).size < 1000) {
    console.error(`截图未生成：${target}`);
    failed = true;
  }

  rmSync(profile, { recursive: true, force: true });
}

rmSync(join(root, '.tmp'), { recursive: true, force: true });

if (failed) {
  process.exit(1);
}

console.log(`截图已保存到 ${outputDir}`);
