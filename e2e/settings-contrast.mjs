// Contrast measurement for the Settings sheet, in both themes.
//
//   node e2e/settings-contrast.mjs [path-to-binary]
//
// The repo's method (design-review/tools/contrast.mjs): measure the rendered
// pixel, not the declared colour. For each theme it opens the sheet, captures
// a screenshot, captures a second one with the text made transparent, samples
// the rendered background at each text run's glyph centre (Python PIL —
// ImageMagick is not installed here), alpha-composites the declared
// foreground colour over it, and computes the WCAG ratio. The screenshots
// double as the PR evidence: design-review/evidence/settings-sheet-<theme>.png.
// Exits non-zero when any text run is below its bar (4.5:1, or 3:1 for text
// at/above 24 px, or 18.66 px and bold).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { launchApp, waitFor, sleep } from "./harness.mjs";

const BINARY = process.argv[2];
const EVIDENCE = path.resolve(import.meta.dirname, "../design-review/evidence");
const TMP = "/tmp/truecast-contrast";

const GRADIENTS = {
  dark: "linear-gradient(180deg, #0b1220 0%, #1e293b 100%)",
  light: "linear-gradient(180deg, #bfdbfe 0%, #60a5fa 100%)",
};

const failures = [];

function pixel(file, x, y) {
  const out = execFileSync("python3", [
    path.resolve(import.meta.dirname, "pixel.py"),
    file,
    String(Math.round(x)),
    String(Math.round(y)),
  ]).toString().trim();
  const [r, g, b] = out.split(",").map(Number);
  return { r, g, b };
}

const lum = (c) => {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
};
const contrast = (a, b) => {
  const l1 = lum(a);
  const l2 = lum(b);
  return +(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2));
};
const comp = (fg, bg, alpha) => ({
  r: Math.round(fg.r * alpha + bg.r * (1 - alpha)),
  g: Math.round(fg.g * alpha + bg.g * (1 - alpha)),
  b: Math.round(fg.b * alpha + bg.b * (1 - alpha)),
});

function parseColor(color) {
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`unparsable color ${color}`);
  const [r, g, b, a = 1] = m[1].split(",").map(Number);
  return { r, g, b, a };
}

const app = await launchApp({ port: 9233, binary: BINARY });
try {
  const { cdp } = app;
  await cdp.send("Page.reload", { ignoreCache: true });
  await waitFor(cdp, `!!document.querySelector('[data-settings-trigger]')`, "title bar", 60_000);
  await sleep(1500);
  await cdp.eval(`document.querySelector('[data-settings-trigger]').click()`);
  await waitFor(cdp, `!!document.querySelector('[role="dialog"]')`, "sheet open");
  await sleep(400);

  fs.mkdirSync(TMP, { recursive: true });

  for (const theme of ["dark", "light"]) {
    // Force the theme the way WeatherBackground does: the dataset attribute
    // picks the token set, the inline gradient paints the backdrop behind it.
    await cdp.eval(
      `document.documentElement.dataset.theme = ${JSON.stringify(theme)}; ` +
        `document.documentElement.style.setProperty('--bg-gradient', ${JSON.stringify(GRADIENTS[theme])});`,
    );
    await sleep(600);

    // Every text run in the sheet, with its glyph-centre box from a Range.
    const runs = await cdp.eval(`(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const out = [];
      const walker = document.createTreeWalker(dialog, NodeFilter.SHOW_ELEMENT);
      let el = walker.currentNode;
      while (el) {
        for (const node of el.childNodes) {
          if (node.nodeType !== Node.TEXT_NODE) continue;
          const text = node.textContent.trim();
          if (!text) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          const rect = range.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          const cs = getComputedStyle(el);
          out.push({
            text: text.slice(0, 30),
            color: cs.color,
            size: parseFloat(cs.fontSize),
            weight: parseInt(cs.fontWeight, 10) || 400,
            opacity: parseFloat(cs.opacity),
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2,
          });
        }
        el = walker.nextNode();
      }
      return out;
    })()`);

    const shot = async (file) => {
      const result = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
      fs.writeFileSync(file, Buffer.from(result.data, "base64"));
    };
    const evidenceFile = path.join(EVIDENCE, `settings-sheet-${theme}.png`);
    const bgFile = path.join(TMP, `settings-bg-${theme}.png`);
    await shot(evidenceFile);
    await cdp.eval(`(() => { const s = document.createElement('style'); s.id = 'audit-bg'; s.textContent = '*{color:transparent !important;-webkit-text-fill-color:transparent !important;text-shadow:none !important;}'; document.head.appendChild(s); })()`);
    await sleep(200);
    await shot(bgFile);
    await cdp.eval(`document.getElementById('audit-bg')?.remove()`);

    console.log(`\n${theme} — ${runs.length} text runs (evidence: ${evidenceFile})`);
    console.log("text                          size  wt  bg              eff             ratio  req");
    for (const run of runs) {
      const bg = pixel(bgFile, run.x, run.y);
      const fg = parseColor(run.color);
      const effective = comp(fg, bg, fg.a * run.opacity);
      const ratio = contrast(effective, bg);
      const required = run.size >= 24 || (run.size >= 18.66 && run.weight >= 700) ? 3 : 4.5;
      const pass = ratio >= required;
      if (!pass) failures.push(`${theme}: "${run.text}" ${ratio} < ${required}`);
      console.log(
        `${run.text.padEnd(30).slice(0, 30)} ${String(run.size).padEnd(5)} ${String(run.weight).padEnd(3)} ` +
          `rgb(${bg.r},${bg.g},${bg.b})`.padEnd(16) +
          `rgb(${effective.r},${effective.g},${effective.b})`.padEnd(16) +
          `${String(ratio).padEnd(6)} ${required}  ${pass ? "PASS" : "FAIL"}`,
      );
    }
  }
} catch (error) {
  failures.push(`threw: ${error.message}`);
  console.error(error);
} finally {
  app.stop();
}

console.log(`\n${failures.length ? `${failures.length} failing:\n${failures.join("\n")}` : "all text runs pass their contrast bar"}`);
process.exit(failures.length ? 1 : 0);
