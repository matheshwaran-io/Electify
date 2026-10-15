// Rasterises the official Electify SVG logos (public/brand) to transparent PNGs for the deck.
const { chromium } = require("../../node_modules/@playwright/test");
const fs = require("fs");
const path = require("path");
(async () => {
  const b = await chromium.launch({ channel: "chrome" });
  const p = await b.newPage({ deviceScaleFactor: 4 });
  for (const name of ["electify-logo", "electify-logo-reverse", "electify-mark", "electify-mark-reverse"]) {
    const svg = fs.readFileSync(path.join(__dirname, "../../public/brand", name + ".svg"), "utf8");
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    const el = await p.$("svg");
    await el.screenshot({ path: path.join(__dirname, "assets", name + ".png"), omitBackground: true });
    console.log("wrote", name);
  }
  await b.close();
})();
