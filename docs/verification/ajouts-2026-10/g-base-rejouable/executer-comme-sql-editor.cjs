// Imite le SQL Editor de Supabase : tout le fichier envoyé en UNE requête (protocole simple),
// puis affiche le résultat de la dernière instruction.
const fs = require("fs");
const { Client } = require("pg");
(async () => {
  const [db, file] = process.argv.slice(2);
  const c = new Client({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || "postgres",
    database: db,
  });
  await c.connect();
  try {
    const res = await c.query(fs.readFileSync(file, "utf8"));
    const last = Array.isArray(res) ? res[res.length - 1] : res;
    console.table(last.rows);
    const sp = await c.query("SHOW search_path");
    console.log("search_path après exécution :", sp.rows[0].search_path);
  } catch (e) {
    console.log(
      "ERREUR :",
      e.message,
      e.hint ? "\nINDICE : " + e.hint : "",
      e.where ? "\nOÙ : " + e.where : "",
    );
    process.exitCode = 1;
  } finally {
    await c.end();
  }
})();
