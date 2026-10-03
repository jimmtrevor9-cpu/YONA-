// Images de test du moteur de visages, à partir des portraits générés par IA des profils de
// démonstration (aucune personne réelle) : original en JPEG + variante (recadrée, plus claire,
// légèrement tournée) pour simuler une autre photo de la même personne.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
const require = createRequire("/var/tmp/yona-e2e/");
const { chromium } = require("playwright-core");
const names = process.argv.slice(2);
const b = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const pg = await b.newPage();
for (const n of names) {
  const b64 = readFileSync(`/home/user/YONA-/public/demo-profils/${n}.webp`).toString("base64");
  const out = await pg.evaluate(async (data) => {
    const img = new Image();
    img.src = `data:image/webp;base64,${data}`;
    await img.decode();
    const make = (fn) => {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d");
      fn(ctx, c);
      return c.toDataURL("image/jpeg", 0.9).split(",")[1];
    };
    const orig = make((ctx) => ctx.drawImage(img, 0, 0));
    const variant = make((ctx, c) => {
      ctx.filter = "brightness(1.12) contrast(1.05)";
      ctx.translate(c.width / 2, c.height / 2);
      ctx.rotate((4 * Math.PI) / 180);
      ctx.scale(1.12, 1.12);
      ctx.drawImage(img, -c.width / 2 + 18, -c.height / 2 - 10);
    });
    return { orig, variant };
  }, b64);
  writeFileSync(`/var/tmp/yona-e2e/faces/${n}.jpg`, Buffer.from(out.orig, "base64"));
  writeFileSync(`/var/tmp/yona-e2e/faces/${n}-b.jpg`, Buffer.from(out.variant, "base64"));
}
await b.close();
console.log("ok", names.length);
