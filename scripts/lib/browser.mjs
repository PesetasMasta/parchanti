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

// One browser, many page visits. The multi-page suite visits ~21 routes per
// viewport width; spawning Brave per route would dominate the runtime, so the
// suite spawns once per width and navigates. withPage stays as a wrapper so
// shot.mjs keeps working unchanged.
export async function withBrowser(fn) {
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
    await client.send('Page.enable', {}, sessionId);

    const visit = async (url, options, pageFn) => {
      const { width = 390, height = 844, mobile = true, settle = 600, reducedMotion = false } = options ?? {};

      await client.send('Emulation.setDeviceMetricsOverride', {
        width, height, deviceScaleFactor: 2, mobile,
      }, sessionId);
      // Emulated, not inherited from the OS, so the reduced-motion checks are
      // deterministic on any machine.
      await client.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: reducedMotion ? 'reduce' : '' }],
      }, sessionId);

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

      return pageFn(evaluate, screenshot);
    };

    return await fn(visit);
  } finally {
    // Wait for the process to actually exit, not just for the kill signal to
    // be sent: a second launch would race this one for the shared
    // --user-data-dir lock. Timeout is a fallback if 'exit' never fires.
    const exited = new Promise((resolve) => browser.once('exit', resolve));
    browser.kill();
    await Promise.race([exited, wait(2000)]);
  }
}

export function withPage(url, options, fn) {
  return withBrowser((visit) => visit(url, options, fn));
}
