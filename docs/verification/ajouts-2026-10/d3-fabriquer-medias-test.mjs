// Fabrique une image et une courte vidéo de test (aux couleurs YONA) pour les essais locaux.
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire("/var/tmp/yona-e2e/");
const { chromium } = require("playwright-core");
const b = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const pg = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
await pg.setContent(`<html><body style="margin:0;width:540px;height:960px;font-family:sans-serif;background:linear-gradient(160deg,#cd568b,#a65175 55%,#3b1530);color:#fff;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center">
<div style="font-size:30px;letter-spacing:6px;opacity:.85">PUBLICITÉ DE TEST</div>
<div style="font-size:64px;font-weight:800;line-height:1.05;margin:24px 32px">Votre annonce<br>sur YONA</div>
<div style="font-size:24px;opacity:.9;margin:0 48px">Image fabriquée pour les essais locaux de l'affichage sponsorisé.</div>
<div style="margin-top:48px;width:180px;height:180px;border-radius:50%;border:10px solid rgba(255,255,255,.6)"></div></body></html>`);
await pg.screenshot({ path: "/var/tmp/yona-e2e/img/pub-test.jpg", type: "jpeg", quality: 85 });
const b64 = await pg.evaluate(async () => {
  const c = document.createElement("canvas");
  c.width = 360;
  c.height = 640;
  document.body.appendChild(c);
  const ctx = c.getContext("2d");
  const stream = c.captureStream(25);
  const rec = new MediaRecorder(stream, {
    mimeType: "video/webm;codecs=vp8",
    videoBitsPerSecond: 600000,
  });
  const chunks = [];
  rec.ondataavailable = (e) => chunks.push(e.data);
  const done = new Promise((r) => (rec.onstop = r));
  rec.start(200);
  const t0 = performance.now();
  await new Promise((resolve) => {
    const draw = () => {
      const t = (performance.now() - t0) / 1000;
      const g = ctx.createLinearGradient(0, 0, 360, 640);
      g.addColorStop(0, "#cd568b");
      g.addColorStop(1, "#3b1530");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 360, 640);
      ctx.fillStyle = "rgba(255,255,255,.85)";
      ctx.beginPath();
      ctx.arc(180 + Math.sin(t * 3) * 100, 320, 50, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 34px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Vidéo de test YONA", 180, 140);
      if (t < 3) requestAnimationFrame(draw);
      else resolve();
    };
    draw();
  });
  rec.stop();
  await done;
  const blob = new Blob(chunks, { type: "video/webm" });
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = "";
  for (const x of buf) s += String.fromCharCode(x);
  return btoa(s);
});
writeFileSync("/var/tmp/yona-e2e/img/pub-test.webm", Buffer.from(b64, "base64"));
await b.close();
console.log("ok");
