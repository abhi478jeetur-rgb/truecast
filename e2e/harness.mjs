// Shared harness for the end-to-end checks: launch the packaged app with a
// throwaway profile, attach over CDP, and drive it.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 0;
    this.pending = new Map();
    this.requests = [];
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.method === "Network.requestWillBeSent") {
        this.requests.push(message.params.request.url);
      }
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
      }
    });
  }
  open() {
    return new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const result = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  }
  async key(key, code, virtualKeyCode, modifiers = 0) {
    await this.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key, code, windowsVirtualKeyCode: virtualKeyCode, modifiers });
    await this.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: virtualKeyCode, modifiers });
  }
  close() {
    this.ws.close();
  }
}

export async function waitFor(cdp, expression, label, timeout = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      if (await cdp.eval(expression)) return true;
    } catch {
      // page not ready
    }
    await sleep(200);
  }
  throw new Error(`timeout waiting for ${label}`);
}

async function waitForTarget(port) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = targets.find((target) => target.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      // not listening yet
    }
    await sleep(250);
  }
  throw new Error("the app never exposed a CDP target");
}

/** Spawn the packaged binary with an empty profile and return a connected CDP. */
export async function launchApp({ port, binary } = {}) {
  const bin = binary ?? path.resolve(import.meta.dirname, "../release/linux-unpacked/truecast");
  const profile = mkdtempSync(path.join(tmpdir(), "truecast-e2e-"));
  const child = spawn(
    bin,
    ["--no-sandbox", "--ozone-platform=x11", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  child.stderr.on("data", () => {});

  const cdp = new Cdp(await waitForTarget(port));
  await cdp.open();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");

  return {
    cdp,
    stop() {
      cdp.close();
      child.kill("SIGTERM");
      try {
        // The child may still be flushing its profile; retry rather than throw
        // an ENOTEMPTY over the real test result.
        rmSync(profile, { recursive: true, force: true, maxRetries: 6, retryDelay: 150 });
      } catch {
        // A leftover temp directory is not a test failure.
      }
    },
  };
}
