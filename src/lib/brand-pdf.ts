import type { jsPDF } from "jspdf"
import { SEAT_CHECK, SEAT_DOT, SEAT_TO_LOGO, seatLayout, type SeatDetail } from "@/lib/seat-logo"

/**
 * The Electify logo drawn as vectors into a jsPDF document: same geometry as
 * <Logo /> (src/components/brand.tsx, lib/seat-logo.ts), so receipts and
 * reports carry the exact seat-map mark and Sora wordmark with no image or font
 * embedding.
 *
 * Imported on demand by the PDF builders only.
 */

type RGB = readonly [number, number, number]

export const BRAND_PDF = {
  midnight: [14, 19, 48] as RGB, // #0E1330
  mist: [245, 246, 249] as RGB, // #F5F6F9
  gold: [233, 180, 76] as RGB, // #E9B44C
}

// Wordmark outline in mark units (120-unit box), quadratics raised to cubics.
const WORDMARK =
  "m 152.645 90.682 l 152.645 24.982 l 165.155 24.982 l 165.155 90.682 h m 163.355 90.682 l 163.355 79.882 l 193.145 79.882 l 193.145 90.682 h m 163.355 62.692 l 163.355 51.892 l 190.805 51.892 l 190.805 62.692 h m 163.355 35.782 l 163.355 24.982 l 192.425 24.982 l 192.425 35.782 h m 201.875 90.682 l 201.875 24.982 l 214.385 24.982 l 214.385 90.682 h m 195.755 34.342 l 195.755 24.982 l 214.385 24.982 l 214.385 34.342 h m 246.515 92.392 c 242.315 92.392 238.64 91.672 235.49 90.232 c 232.34 88.792 229.73 86.857 227.66 84.427 c 225.59 81.997 224.03 79.282 222.98 76.282 c 221.93 73.282 221.405 70.222 221.405 67.102 l 221.405 65.392 c 221.405 62.152 221.93 59.017 222.98 55.987 c 224.03 52.957 225.59 50.257 227.66 47.887 c 229.73 45.517 232.295 43.627 235.355 42.217 c 238.415 40.807 241.955 40.102 245.975 40.102 c 251.255 40.102 255.68 41.257 259.25 43.567 c 262.82 45.877 265.505 48.907 267.305 52.657 c 269.105 56.407 270.005 60.442 270.005 64.762 l 270.005 69.262 l 226.715 69.262 l 226.715 61.612 l 262.175 61.612 l 258.305 65.392 c 258.305 62.272 257.855 59.602 256.955 57.382 c 256.055 55.162 254.69 53.452 252.86 52.252 c 251.03 51.052 248.735 50.452 245.975 50.452 c 243.215 50.452 240.875 51.082 238.955 52.342 c 237.035 53.602 235.58 55.417 234.59 57.787 c 233.6 60.157 233.105 62.992 233.105 66.292 c 233.105 69.352 233.585 72.067 234.545 74.437 c 235.505 76.807 236.975 78.667 238.955 80.017 c 240.935 81.367 243.455 82.042 246.515 82.042 c 249.575 82.042 252.065 81.427 253.985 80.197 c 255.905 78.967 257.135 77.452 257.675 75.652 l 269.195 75.652 c 268.475 79.012 267.095 81.952 265.055 84.472 c 263.015 86.992 260.42 88.942 257.27 90.322 c 254.12 91.702 250.535 92.392 246.515 92.392 h m 298.085 92.392 c 293.825 92.392 290.15 91.672 287.06 90.232 c 283.97 88.792 281.39 86.872 279.32 84.472 c 277.25 82.072 275.705 79.372 274.685 76.372 c 273.665 73.372 273.155 70.312 273.155 67.192 l 273.155 65.482 c 273.155 62.182 273.68 59.017 274.73 55.987 c 275.78 52.957 277.355 50.257 279.455 47.887 c 281.555 45.517 284.15 43.627 287.24 42.217 c 290.33 40.807 293.915 40.102 297.995 40.102 c 302.255 40.102 306.065 40.927 309.425 42.577 c 312.785 44.227 315.47 46.522 317.48 49.462 c 319.49 52.402 320.615 55.822 320.855 59.722 l 308.705 59.722 c 308.405 57.202 307.34 55.102 305.51 53.422 c 303.68 51.742 301.175 50.902 297.995 50.902 c 295.235 50.902 292.94 51.562 291.11 52.882 c 289.28 54.202 287.915 56.017 287.015 58.327 c 286.115 60.637 285.665 63.292 285.665 66.292 c 285.665 69.172 286.1 71.782 286.97 74.122 c 287.84 76.462 289.19 78.292 291.02 79.612 c 292.85 80.932 295.205 81.592 298.085 81.592 c 300.245 81.592 302.105 81.202 303.665 80.422 c 305.225 79.642 306.47 78.562 307.4 77.182 c 308.33 75.802 308.915 74.242 309.155 72.502 l 321.305 72.502 c 321.065 76.462 319.91 79.927 317.84 82.897 c 315.77 85.867 313.04 88.192 309.65 89.872 c 306.26 91.552 302.405 92.392 298.085 92.392 h m 348.485 91.312 c 343.985 91.312 340.28 90.727 337.37 89.557 c 334.46 88.387 332.285 86.407 330.845 83.617 c 329.405 80.827 328.685 77.062 328.685 72.322 l 328.775 28.042 l 340.475 28.042 l 340.385 73.132 c 340.385 75.532 341.03 77.377 342.32 78.667 c 343.61 79.957 345.455 80.602 347.855 80.602 l 355.505 80.602 l 355.505 91.312 h m 320.945 50.992 l 320.945 41.812 l 355.505 41.812 l 355.505 50.992 h m 364.325 90.682 l 364.325 41.812 l 376.835 41.812 l 376.835 90.682 h m 357.485 51.172 l 357.485 41.812 l 376.835 41.812 l 376.835 51.172 h m 368.915 35.962 c 366.455 35.962 364.64 35.317 363.47 34.027 c 362.3 32.737 361.715 31.102 361.715 29.122 c 361.715 27.142 362.3 25.522 363.47 24.262 c 364.64 23.002 366.455 22.372 368.915 22.372 c 371.375 22.372 373.175 23.002 374.315 24.262 c 375.455 25.522 376.025 27.142 376.025 29.122 c 376.025 31.102 375.455 32.737 374.315 34.027 c 373.175 35.317 371.375 35.962 368.915 35.962 h m 388.355 90.682 l 388.355 40.642 c 388.355 35.062 389.9 30.937 392.99 28.267 c 396.08 25.597 400.655 24.262 406.715 24.262 l 412.835 24.262 l 412.835 33.892 l 405.815 33.892 c 403.955 33.892 402.53 34.387 401.54 35.377 c 400.55 36.367 400.055 37.762 400.055 39.562 l 400.055 90.682 h m 382.235 51.802 l 382.235 42.622 l 413.645 42.622 l 413.645 51.802 h m 417.515 109.942 l 417.515 99.232 l 426.695 99.232 c 428.435 99.232 429.89 99.007 431.06 98.557 c 432.23 98.107 433.205 97.387 433.985 96.397 c 434.765 95.407 435.365 94.042 435.785 92.302 l 448.925 41.812 l 460.895 41.812 l 446.405 95.002 c 445.445 98.662 444.095 101.587 442.355 103.777 c 440.615 105.967 438.38 107.542 435.65 108.502 c 432.92 109.462 429.545 109.942 425.525 109.942 h m 432.725 89.602 l 432.725 79.702 l 443.165 79.702 l 443.165 89.602 h m 428.495 89.602 l 412.655 41.812 l 425.255 41.812 l 440.285 89.602 h"

/** Ink right edge of the wordmark, in mark units. */
const RIGHT = 460.895
/** Lowest ink (descender of the "y"), in mark units. */
const BOTTOM = 109.942

type Op = { op: "m" | "l" | "c" | "h"; c: number[] }

function wordmarkOps(x: number, y: number, u: number): Op[] {
  const t = WORDMARK.split(" ")
  const out: Op[] = []
  let i = 0
  const n = () => Number(t[i++])
  while (i < t.length) {
    const op = t[i++] as Op["op"]
    const count = op === "c" ? 3 : op === "h" ? 0 : 1
    const c: number[] = []
    for (let k = 0; k < count; k++) {
      const px = n()
      const py = n()
      c.push(x + (px - 18) * u, y + (py - 18) * u)
    }
    out.push({ op, c })
  }
  return out
}

/**
 * Draws the lockup with the top-left of the E at (x, y).
 * `height` is the height of the E in document units.
 * `detail` defaults to the 5 × 5 seat E, which suits the small header logos of
 * receipts and reports; pass "fine" for a large mark (open seats aren't drawn
 * in PDFs).
 * Returns the drawn width and the extent below y (for the "y" descender).
 */
export function drawLogo(
  doc: jsPDF,
  {
    x,
    y,
    height,
    ink = BRAND_PDF.midnight,
    wordmark = true,
    check = true,
    detail = "coarse",
  }: { x: number; y: number; height: number; ink?: RGB; wordmark?: boolean; check?: boolean; detail?: SeatDetail }
) {
  const u = height / 84
  // Grid units → document units, with (x, y) at the logo box's (18, 18).
  const g = SEAT_TO_LOGO.scale * u
  const gx = (v: number) => x + (SEAT_TO_LOGO.x - 18) * u + v * g
  const gy = (v: number) => y + (SEAT_TO_LOGO.y - 18) * u + v * g
  doc.saveGraphicsState()

  doc.setFillColor(...ink)
  for (const s of seatLayout(detail)) {
    if (s.taken) doc.roundedRect(gx(s.x), gy(s.y), s.size * g, s.size * g, s.rx * g, s.rx * g, "F")
  }

  doc.setFillColor(...BRAND_PDF.gold)
  doc.circle(gx(SEAT_DOT.cx), gy(SEAT_DOT.cy), SEAT_DOT.r * g, "F")

  if (check) {
    const [m, a, b] = SEAT_CHECK.points
    doc.setDrawColor(...BRAND_PDF.midnight)
    doc.setLineWidth(SEAT_CHECK.width * g)
    doc.setLineCap("round")
    doc.setLineJoin("round")
    doc.path([
      { op: "m", c: [gx(m[0]), gy(m[1])] },
      { op: "l", c: [gx(a[0]), gy(a[1])] },
      { op: "l", c: [gx(b[0]), gy(b[1])] },
    ])
    doc.stroke()
  }

  if (wordmark) {
    doc.setFillColor(...ink)
    doc.path(wordmarkOps(x, y, u))
    doc.fill()
  }

  doc.restoreGraphicsState()
  return { width: ((wordmark ? RIGHT : 103) - 18) * u, below: ((wordmark ? BOTTOM : 102) - 18) * u }
}
