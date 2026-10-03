// Variante « tête tournée » simulée (déformation en perspective) d'un portrait de test.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
const require = createRequire("/var/tmp/yona-e2e/");
const { chromium } = require("playwright-core");
const [name, side = "left", k = "0.55"] = process.argv.slice(2);
const b = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const pg = await b.newPage();
const b64 = readFileSync(`/var/tmp/yona-e2e/faces/${name}.jpg`).toString("base64");
const out = await pg.evaluate(
  async ({ data, side, k }) => {
    const img = new Image();
    img.src = `data:image/jpeg;base64,${data}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d");
    // Bandes verticales : un côté du visage comprimé, l'autre étiré (rotation simulée).
    const n = 60,
      w = img.width;
    const f = (x) => {
      const t = x / w;
      const g = side === "left" ? t : 1 - t;
      const p = Math.pow(g, k);
      return side === "left" ? p * w : (1 - p) * w;
    };
    for (let i = 0; i < n; i++) {
      const x0 = (i / n) * w,
        x1 = ((i + 1) / n) * w;
      const d0 = f(x0),
        d1 = f(x1);
      ctx.drawImage(
        img,
        x0,
        0,
        x1 - x0,
        img.height,
        Math.min(d0, d1),
        0,
        Math.abs(d1 - d0) + 0.5,
        img.height,
      );
    }
    return c.toDataURL("image/jpeg", 0.9).split(",")[1];
  },
  { data: b64, side, k: Number(k) },
);
writeFileSync(`/var/tmp/yona-e2e/faces/${name}-turn-${side}.jpg`, Buffer.from(out, "base64"));
await b.close();
console.log("ok");
