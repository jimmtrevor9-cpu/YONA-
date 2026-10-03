// Fausse « carte d'identité » de test (aucun vrai document) : portrait IA + texte factice.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
const require = createRequire("/var/tmp/yona-e2e/");
const { chromium } = require("playwright-core");
const [name, out] = process.argv.slice(2);
const b = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const pg = await b.newPage({ viewport: { width: 1000, height: 630 } });
const img = readFileSync(`/var/tmp/yona-e2e/faces/${name}.jpg`).toString("base64");
await pg.setContent(`<html><body style="margin:0;width:1000px;height:630px;background:linear-gradient(120deg,#e8eef7,#cfd9ea);font-family:sans-serif">
<div style="position:absolute;left:40px;top:40px;width:300px;height:400px;overflow:hidden;border-radius:8px;border:2px solid #889">
<img src="data:image/jpeg;base64,${img}" style="width:100%;height:100%;object-fit:cover"></div>
<div style="position:absolute;left:380px;top:50px;font-size:34px;font-weight:700;color:#234">CARTE DE TEST — SPÉCIMEN</div>
<div style="position:absolute;left:380px;top:120px;font-size:24px;color:#345;line-height:1.8">Nom : EXEMPLE<br>Prénom : Test<br>Né(e) le : 01.01.1995<br>Document fictif pour essais locaux</div>
</body></html>`);
await pg.waitForTimeout(300);
await pg.screenshot({ path: out, type: "jpeg", quality: 90 });
await b.close();
console.log("ok");
