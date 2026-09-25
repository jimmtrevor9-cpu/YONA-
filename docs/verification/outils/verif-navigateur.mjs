// Outil de test : ouvre des pages dans Chromium (Playwright) et liste les erreurs.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/outils/verif-navigateur.mjs http://127.0.0.1:4173 "/,/login"
import { createRequire } from "node:module";
const { chromium } = createRequire(`${process.env.PLAYWRIGHT_ROOT ?? ""}/`)("playwright");
const BASE = process.argv[2];
const paths = (process.argv[3] ?? "/,/login,/register,/forgot-password,/discover").split(",");
const b = await chromium.launch();
const pg = await b.newPage();
let errs = [];
pg.on(
  "console",
  (m) => m.type() === "error" && errs.push("console.error: " + m.text().slice(0, 170)),
);
pg.on("pageerror", (e) => errs.push("pageerror: " + String(e).slice(0, 170)));
for (const path of paths) {
  errs = [];
  await pg.goto(BASE + path, { waitUntil: "networkidle" });
  await pg.waitForTimeout(800);
  console.log(
    `${path.padEnd(18)} → url finale ${pg.url().replace(BASE, "").padEnd(12)} titre="${await pg.title()}" erreurs=${errs.length}`,
  );
  errs.slice(0, 3).forEach((e) => console.log("      " + e));
}
await b.close();
