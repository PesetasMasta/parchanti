// Screenshot a page at a real phone viewport.
//
// Chrome/Brave headless refuses to lay out below ~500px wide with --window-size:
// it renders at 500 and crops the PNG, which silently hides genuine overflow.
// Driving it over the DevTools protocol and using Emulation.setDeviceMetricsOverride
// gives a true small viewport. Node's global WebSocket means no dependencies.
//
//   node scripts/shot.mjs <url> <out.png> [width] [height] [hash]

import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

const BRAVE = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
const PORT = 9333;

const [url, out, width = '390', height = '844'] = process.argv.slice(2);
if (!url || !out) {
  console.error('usage: node scripts/shot.mjs <url> <out.png> [width] [height]');
  process.exit(1);
}

const browser = spawn(BRAVE, [
  '--headless',
  '--disable-gpu',
  `--remote-debugging-port=${PORT}`,
  '--no-first-run',
  '--user-data-dir=/tmp/parchant-shot-profile',
  'about:blank',
], { stdio: 'ignore' });

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function debuggerUrl() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const info = await response.json();
      if (info.webSocketDebuggerUrl) return info.webSocketDebuggerUrl;
    } catch {
      // not listening yet
    }
    await wait(150);
  }
  throw new Error('DevTools endpoint never came up');
}

class Client {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = [];

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result);
        return;
      }
      for (const listener of this.listeners) listener(message);
    });
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.socket.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  once(predicate) {
    return new Promise((resolve) => {
      const listener = (message) => {
        if (!predicate(message)) return;
        this.listeners = this.listeners.filter((entry) => entry !== listener);
        resolve(message);
      };
      this.listeners.push(listener);
    });
  }
}

try {
  const wsUrl = await debuggerUrl();
  const socket = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve);
    socket.addEventListener('error', reject);
  });

  const client = new Client(socket);

  const { targetId } = await client.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await client.send('Target.attachToTarget', { targetId, flatten: true });

  await client.send('Emulation.setDeviceMetricsOverride', {
    width: Number(width),
    height: Number(height),
    deviceScaleFactor: 2,
    mobile: true,
  }, sessionId);

  await client.send('Page.enable', {}, sessionId);
  const loaded = client.once((message) => message.method === 'Page.loadEventFired');
  await client.send('Page.navigate', { url }, sessionId);
  await loaded;
  await wait(900); // let the entry transition settle

  const { data } = await client.send('Page.captureScreenshot', { format: 'png' }, sessionId);
  await writeFile(out, Buffer.from(data, 'base64'));

  // The rule: no cell's content may exceed the cell. A cell is one screen, and
  // anything past its edge is cut off, because cells are overflow:hidden.
  // Checked for every cell at once, not just the visible one.
  const { result } = await client.send('Runtime.evaluate', {
    expression: `(() => {
      const scrollable = (el) => {
        for (let node = el; node && node.classList; node = node.parentElement) {
          const style = getComputedStyle(node);
          if (/(auto|scroll)/.test(style.overflowY + style.overflowX)) return node;
        }
        return null;
      };

      const report = [];
      for (const cell of document.querySelectorAll('.cell')) {
        const label = cell.dataset.label || '(empty)';
        const cut = [];

        // Content taller or wider than the cell, with nothing to scroll it.
        const overY = cell.scrollHeight - cell.clientHeight;
        const overX = cell.scrollWidth - cell.clientWidth;

        const box = cell.getBoundingClientRect();
        const pad = getComputedStyle(cell);
        const limitRight = box.right - parseFloat(pad.paddingRight);
        const limitLeft = box.left + parseFloat(pad.paddingLeft);
        const limitBottom = box.bottom - parseFloat(pad.paddingBottom);

        for (const el of cell.querySelectorAll('*')) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          const host = scrollable(el.parentElement);
          const past = [];
          if (r.right - limitRight > 1) past.push('right+' + Math.round(r.right - limitRight));
          if (limitLeft - r.left > 1) past.push('left+' + Math.round(limitLeft - r.left));
          if (!host && r.bottom - limitBottom > 1) past.push('below+' + Math.round(r.bottom - limitBottom));
          if (past.length) cut.push((el.className || el.tagName) + ' ' + past.join(' '));
        }

        if (overX > 1 || overY > 1 || cut.length) {
          report.push({
            cell: label,
            cellOverflow: (overX > 1 ? 'x+' + overX + ' ' : '') + (overY > 1 ? 'y+' + overY : '') || 'none',
            cut: [...new Set(cut)].slice(0, 6),
          });
        }
      }

      return JSON.stringify({
        viewport: innerWidth + 'x' + innerHeight,
        problems: report,
      }, null, 1);
    })()`,
    returnByValue: true,
  }, sessionId);

  console.log(result.value);
} finally {
  browser.kill();
}
