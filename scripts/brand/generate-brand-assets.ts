/**
 * Regenerates every static Electify logo asset from the seat-map geometry in
 * src/lib/seat-logo.ts:
 *
 *   SVG   public/brand/*.svg, public/presentation.html (inline mark),
 *         src/app/icon.svg (pixel-aligned favicon)
 *   PNG   src/app/apple-icon.png, public/brand/icon-*.png,
 *         src/app/opengraph-image.png, src/app/twitter-image.png, public/logo.png
 *   ICO   src/app/favicon.ico (16, 32, 48 from icon.svg)
 *
 * Only the mark changes. SVGs keep their colours and layout. PNGs keep their
 * framing, wordmark and typography: the mark's box is cleared and the new mark
 * drawn in the same place, at the scale the original was drawn. Safe to run
 * again: it recognises marks it generated before.
 *
 *   npm run brand:generate
 *
 * Uses sharp (installed with Next.js) to rasterise.
 */
import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import sharp from "sharp"
import { SEAT_DOT, seatLayout, seatMarkSvg, type SeatDetail } from "../../src/lib/seat-logo"

const ROOT = path.resolve(__dirname, "../..")
const file = (p: string) => path.join(ROOT, p)

const MIDNIGHT = "#0E1330"
const MIST = "#F5F6F9"
const GOLD = "#E9B44C"

// ─── SVG ──────────────────────────────────────────────────────────────────────

/** The original bar mark (4 rounded bars, gold dot, optional check), any whitespace. */
const OLD_MARK =
  /<rect x="18" y="18" width="18" height="84" rx="9" fill="([^"]+)"\s*\/>\s*<rect x="18" y="18" width="70" height="18" rx="9" fill="[^"]+"\s*\/>\s*<rect x="18" y="84" width="70" height="18" rx="9" fill="[^"]+"\s*\/>\s*<rect x="18" y="51" width="42" height="18" rx="9" fill="[^"]+"\s*\/>\s*<circle cx="88" cy="60" r="15" fill="([^"]+)"\s*\/>(\s*<path d="M80\.5 60\.5\s?L86 66\s?L95\.5 55"[^>]*?stroke="([^"]+)"[^>]*\/>)?/
/** A seat mark written by this script. */
const SEAT_MARK = /<g data-mark="seats" data-detail="(fine|coarse)" data-ink="([^"]+)" data-gold="([^"]+)" data-check="([^"]*)">[\s\S]*?<\/g><\/g>/

function seatGroup(detail: SeatDetail, ink: string, gold: string, checkColor: string | null) {
  const inner = seatMarkSvg({ detail, ink, gold, checkColor: checkColor ?? MIDNIGHT, check: Boolean(checkColor) })
  return `<g data-mark="seats" data-detail="${detail}" data-ink="${ink}" data-gold="${gold}" data-check="${checkColor ?? ""}">${inner}</g>`
}

/** Replaces the mark in an SVG (or HTML) file. Small marks get the coarse grid. */
function rewriteSvg(rel: string, detail: SeatDetail) {
  const source = readFileSync(file(rel), "utf8")
  let out: string | null = null
  const old = OLD_MARK.exec(source)
  if (old) {
    out = source.replace(OLD_MARK, seatGroup(detail, old[1], old[2], old[3] ? old[4] : null))
  } else {
    const prev = SEAT_MARK.exec(source)
    if (prev) out = source.replace(SEAT_MARK, seatGroup(detail, prev[2], prev[3], prev[4] || null))
  }
  if (!out) throw new Error(`No logo mark found in ${rel}`)
  writeFileSync(file(rel), out)
  console.log(`svg  ${rel} (${detail})`)
}

// ─── PNG ──────────────────────────────────────────────────────────────────────

/**
 * Where the mark sits in each image: the centre of the mark's 85 × 84 box and
 * px per logo unit, measured from the original images. `bg: null` means a
 * transparent canvas.
 */
const RASTERS: { files: string[]; cx: number; cy: number; scale: number; ink: string; bg: string | null }[] = [
  { files: ["src/app/apple-icon.png"], cx: 90.5, cy: 90, scale: 1.012, ink: MIST, bg: MIDNIGHT },
  { files: ["public/brand/icon-192.png"], cx: 96.5, cy: 96, scale: 1.083, ink: MIST, bg: MIDNIGHT },
  { files: ["public/brand/icon-512.png", "public/brand/icon-maskable-512.png"], cx: 257.5, cy: 256, scale: 2.893, ink: MIST, bg: MIDNIGHT },
  { files: ["src/app/opengraph-image.png", "src/app/twitter-image.png"], cx: 352.5, cy: 285.5, scale: 1.476, ink: MIDNIGHT, bg: "#F5F6F9" },
  { files: ["public/logo.png"], cx: 157, cy: 175.5, scale: 2.476, ink: MIDNIGHT, bg: null },
]

async function rewritePng(rel: string, spec: (typeof RASTERS)[number]) {
  const input = file(rel)
  const meta = await sharp(input).metadata()
  const W = meta.width!
  const H = meta.height!
  // Logo-box origin (18, 18) in image px; the box is 85 × 84 logo units.
  const left = spec.cx - 42.5 * spec.scale
  const top = spec.cy - 42 * spec.scale
  // Clear the old mark: its box plus a margin for anti-aliasing.
  const m = 3
  const clear = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect x="${left - m}" y="${top - m}" width="${85 * spec.scale + 2 * m}" height="${84 * spec.scale + 2 * m}" fill="${spec.bg ?? "#000"}"/></svg>`
  const mark = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><g transform="translate(${left - 18 * spec.scale} ${top - 18 * spec.scale}) scale(${spec.scale})">${seatMarkSvg({ detail: "fine", ink: spec.ink, gold: GOLD, checkColor: MIDNIGHT })}</g></svg>`
  const base = await sharp(input).ensureAlpha().toBuffer()
  const out = await sharp(base)
    .composite([
      { input: Buffer.from(clear), blend: spec.bg ? "over" : "dest-out" },
      { input: Buffer.from(mark), blend: "over" },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer()
  writeFileSync(input, out)
  console.log(`png  ${rel} (${W}×${H})`)
}

// ─── Favicon ──────────────────────────────────────────────────────────────────

/**
 * The 5 × 5 seat E on whole pixels, so the browser-tab icon stays sharp: seat
 * size and pitch in px, grid origin, and the tile's corner radius per size.
 */
const FAVICON_GRID: Record<number, { pitch: number; seat: number; x: number; y: number; corner: number }> = {
  16: { pitch: 3, seat: 2, x: 1, y: 1, corner: 4 },
  32: { pitch: 4, seat: 3, x: 6, y: 6, corner: 8 },
  48: { pitch: 6, seat: 4, x: 9, y: 9, corner: 12 },
}

function faviconSvg(size: number) {
  const g = FAVICON_GRID[size]
  const r = (v: number) => Number(v.toFixed(2))
  // Grid units → px: a coarse cell is 20 units; seat centres stay on the pixel grid.
  const at = (units: number, origin: number) => origin + (units / 20 - 0.5) * g.pitch + g.seat / 2
  const seats = seatLayout("coarse")
    .filter((s) => s.taken)
    .map((s) => `<rect x="${g.x + s.col * g.pitch}" y="${g.y + s.row * g.pitch}" width="${g.seat}" height="${g.seat}" rx="${r(g.seat * 0.3)}" fill="${MIST}"/>`)
    .join("")
  const dot = `<circle cx="${r(at(SEAT_DOT.cx, g.x))}" cy="${r(at(SEAT_DOT.cy, g.y))}" r="${r((SEAT_DOT.r / 20) * g.pitch)}" fill="${GOLD}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Electify"><title>Electify</title><rect width="${size}" height="${size}" rx="${g.corner}" fill="${MIDNIGHT}"/>${seats}${dot}</svg>\n`
}

// ─── ICO ──────────────────────────────────────────────────────────────────────

/** A .ico holding PNG images (supported by every current browser). */
function ico(images: { size: number; data: Buffer }[]) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  const dir = Buffer.alloc(16 * images.length)
  let offset = header.length + dir.length
  images.forEach(({ size, data }, i) => {
    const o = i * 16
    dir.writeUInt8(size >= 256 ? 0 : size, o)
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1)
    dir.writeUInt16LE(1, o + 4) // colour planes
    dir.writeUInt16LE(32, o + 6) // bits per pixel
    dir.writeUInt32LE(data.length, o + 8)
    dir.writeUInt32LE(offset, o + 12)
    offset += data.length
  })
  return Buffer.concat([header, dir, ...images.map((i) => i.data)])
}

async function writeFavicon() {
  writeFileSync(file("src/app/icon.svg"), faviconSvg(32))
  console.log("svg  src/app/icon.svg (pixel-aligned 32px)")
  const images = await Promise.all(
    [16, 32, 48].map(async (size) => ({ size, data: await sharp(Buffer.from(faviconSvg(size)), { density: 72 }).png().toBuffer() })),
  )
  writeFileSync(file("src/app/favicon.ico"), ico(images))
  console.log("ico  src/app/favicon.ico (16, 32, 48)")
}

// ─── Run ──────────────────────────────────────────────────────────────────────

async function main() {
  for (const name of [
    "electify-mark.svg",
    "electify-mark-reverse.svg",
    "electify-logo.svg",
    "electify-logo-reverse.svg",
    "electify-logo-stacked.svg",
    "electify-hero.svg",
    "electify-hero-reverse.svg",
  ]) {
    rewriteSvg(`public/brand/${name}`, "fine")
  }
  rewriteSvg("public/presentation.html", "fine")

  for (const spec of RASTERS) for (const rel of spec.files) await rewritePng(rel, spec)
  await writeFavicon()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
