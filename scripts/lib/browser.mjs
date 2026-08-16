// Drive a real headless Brave over the DevTools protocol.
//
// Extracted from shot.mjs so the screenshot tool and the assertion runner
// share one implementation. Node's global WebSocket means no dependencies.

import { spawn } from 'node:child_process';

const BRAVE = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
const PORT = 9333;

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

export async function withPage(url, options, fn) {
  const { width = 390, height = 844, mobile = true, settle = 600 } = options ?? {};

  const browser = spawn(BRAVE, [
    '--headless',
    '--disable-gpu',
    `--remote-debugging-port=${PORT}`,
    '--no-first-run',
    '--user-data-dir=/tmp/parchant-shot-profile',
    'about:blank',
  ], { stdio: 'ignore' });

  try {
    const socket = new WebSocket(await debuggerUrl());
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve);
      socket.addEventListener('error', reject);
    });

    const client = new Client(socket);
    const { targetId } = await client.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await client.send('Target.attachToTarget', { targetId, flatten: true });

    await client.send('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: 2, mobile,
    }, sessionId);

    await client.send('Page.enable', {}, sessionId);
    const loaded = client.once((message) => message.method === 'Page.loadEventFired');
    await client.send('Page.navigate', { url }, sessionId);
    await loaded;
    await wait(settle);

    const evaluate = async (expression) => {
      const { result, exceptionDetails } = await client.send('Runtime.evaluate', {
        expression: `(() => { return (${expression}); })()`,
        returnByValue: true,
        awaitPromise: true,
      }, sessionId);
      if (exceptionDetails) throw new Error(exceptionDetails.text ?? 'evaluate threw');
      return result.value;
    };

    const screenshot = async () => {
      const { data } = await client.send('Page.captureScreenshot', { format: 'png' }, sessionId);
      return Buffer.from(data, 'base64');
    };

    return await fn(evaluate, screenshot);
  } finally {
    browser.kill();
  }
}
