// Renders Lucide icons (the icon set Electify's UI uses) to transparent PNGs for the deck.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as L from "lucide-react";
import { chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const NAMES = ["GraduationCap","UserCog","Users","ShieldCheck","Lock","KeyRound","Timer","Database","Activity","FileCheck","ScrollText",
  "Server","Layers","Workflow","CalendarDays","Ticket","Search","RadioTower","Fingerprint","RotateCcw","ClipboardCheck","TriangleAlert",
  "CircleCheck","BookOpen","Building2","Armchair","Gauge","MonitorSmartphone","Accessibility","TestTubeDiagonal","Code2","Boxes","Hourglass","CircleX","Eye","Zap"];
const COLORS = { ink: "#0E1330", gold: "#E9B44C", white: "#FFFFFF" };
const b = await chromium.launch({ channel: "chrome" });
const p = await b.newPage({ deviceScaleFactor: 4 });
for (const n of NAMES) {
  const Icon = L[n];
  if (!Icon) { console.log("missing", n); continue; }
  for (const [cname, c] of Object.entries(COLORS)) {
    const svg = renderToStaticMarkup(createElement(Icon, { size: 64, color: c, strokeWidth: 1.75 }));
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    await (await p.$("svg")).screenshot({ path: path.join(here, "assets/icons", `${n}-${cname}.png`), omitBackground: true });
  }
}
await b.close();
console.log("done");
