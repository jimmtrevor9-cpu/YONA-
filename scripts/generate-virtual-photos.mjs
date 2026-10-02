// Liste les photos des profils d'exemple déposées dans public/virtual-profiles/<pays>/.
// Le nom du fichier indique le genre : il commence par « femme » ou « homme »
// (ex. femme-01.jpg, homme-03.webp). Résultat : public/virtual-profiles/index.json,
// lu par la page des profils. Lancé automatiquement avant « npm run dev » et « npm run build ».
import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "public", "virtual-profiles");
const IMAGE = /\.(jpe?g|png|webp|avif)$/i;
const index = {};

if (existsSync(ROOT)) {
  for (const folder of readdirSync(ROOT).sort()) {
    const dir = join(ROOT, folder);
    if (!statSync(dir).isDirectory()) continue;
    const files = readdirSync(dir)
      .filter((f) => IMAGE.test(f))
      .sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));
    const url = (f) => `/virtual-profiles/${folder}/${encodeURIComponent(f)}`;
    index[folder] = {
      female: files.filter((f) => /^femme/i.test(f)).map(url),
      male: files.filter((f) => /^homme/i.test(f)).map(url),
    };
  }
}

writeFileSync(join(ROOT, "index.json"), JSON.stringify(index));
const total = Object.values(index).reduce((n, v) => n + v.female.length + v.male.length, 0);
console.log(`profils d'exemple : ${total} photo(s) trouvée(s)`);
