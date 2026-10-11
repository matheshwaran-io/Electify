/**
 * Geometry of the Electify mark: the E drawn as a seat map. Taken seats spell
 * the E; the logo's gold dot is the confirmed seat, carrying the check.
 *
 * One source for the React logo (components/brand.tsx), the animated sign-in
 * mark (components/auth/seat-mark.tsx), the PDF logo (lib/brand-pdf.ts) and
 * the generated brand files (scripts/brand/generate-brand-assets.ts).
 *
 * Grid space is 100 × 100 units with the seats in a 10 × 10 grid ("fine").
 * Small sizes use the same E at 5 × 5 ("coarse"), an exact 2× downsample,
 * because 100 seats blur together below ~48px. Inside the logo's 120-unit box,
 * which the wordmark is set against, the grid sits at translate(18 18)
 * scale(0.84), so the gold dot lands where the original mark's dot was.
 */

export type SeatDetail = "fine" | "coarse"

export type Seat = {
  /** Stable index within its layout. */
  i: number
  col: number
  row: number
  x: number
  y: number
  cx: number
  cy: number
  size: number
  rx: number
  /** Part of the E. Open seats are only drawn on the full (fine) mark. */
  taken: boolean
}

/** The confirmed seat, in grid units. */
export const SEAT_DOT = { cx: 82, cy: 50, r: 18 } as const

/** The check inside the dot, scaled from the original mark's check. */
const CHECK_POINTS = [
  [73, 50.6],
  [79.6, 57.2],
  [91, 44],
] as const
export const SEAT_CHECK = {
  points: CHECK_POINTS,
  d: `M${CHECK_POINTS.map(([x, y]) => `${x} ${y}`).join("L")}`,
  width: 4.8,
} as const

/** Grid → the logo's 120-unit box. */
export const SEAT_TO_LOGO = { x: 18, y: 18, scale: 0.84 } as const

/** Open seats are outlined in the ink colour at this opacity. */
export const OPEN_SEAT_OPACITY = 0.22

const COUNT: Record<SeatDetail, number> = { fine: 10, coarse: 5 }

/** The E on the fine grid: spine, top and bottom bars, a shorter middle bar. */
function partOfE(col: number, row: number) {
  if (col <= 1) return true
  if (row <= 1 || row >= 8) return col <= 7
  if (row === 4 || row === 5) return col <= 4
  return false
}

function build(detail: SeatDetail): Seat[] {
  const n = COUNT[detail]
  const pitch = 100 / n
  const scale = 10 / n
  const seats: Seat[] = []
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const cx = (col + 0.5) * pitch
      const cy = (row + 0.5) * pitch
      // The gold dot sits where these seats would be.
      if (Math.hypot(cx - SEAT_DOT.cx, cy - SEAT_DOT.cy) < SEAT_DOT.r + 0.3 * pitch) continue
      const size = 0.72 * pitch
      seats.push({
        i: seats.length,
        col,
        row,
        x: cx - size / 2,
        y: cy - size / 2,
        cx,
        cy,
        size,
        rx: 0.22 * pitch,
        taken: partOfE(col * scale, row * scale),
      })
    }
  }
  return seats
}

const LAYOUTS: Record<SeatDetail, Seat[]> = { fine: build("fine"), coarse: build("coarse") }

/** Every visible seat for a level of detail (seats under the gold dot are left out). */
export function seatLayout(detail: SeatDetail): Seat[] {
  return LAYOUTS[detail]
}

/** Below this E height (px), the logo uses the coarse grid, no open seats and no check. */
export const FULL_MARK_MIN_PX = 48

export function detailForHeight(px: number): SeatDetail {
  return px >= FULL_MARK_MIN_PX ? "fine" : "coarse"
}

const n = (v: number) => Number(v.toFixed(3))

/**
 * The mark as SVG markup in the logo's 120-unit box (for static files).
 * Open seats are drawn only on the fine grid.
 */
export function seatMarkSvg({
  detail,
  ink,
  gold = "#E9B44C",
  checkColor = "#0E1330",
  check = detail === "fine",
  openSeats = detail === "fine",
}: {
  detail: SeatDetail
  ink: string
  gold?: string
  checkColor?: string
  check?: boolean
  openSeats?: boolean
}): string {
  const seats = seatLayout(detail)
  const strokeWidth = detail === "fine" ? 0.8 : 1.6
  const parts = seats
    .filter((s) => s.taken || openSeats)
    .map((s) =>
      s.taken
        ? `<rect x="${n(s.x)}" y="${n(s.y)}" width="${n(s.size)}" height="${n(s.size)}" rx="${n(s.rx)}" fill="${ink}"/>`
        : `<rect x="${n(s.x + strokeWidth / 2)}" y="${n(s.y + strokeWidth / 2)}" width="${n(s.size - strokeWidth)}" height="${n(s.size - strokeWidth)}" rx="${n(s.rx)}" fill="none" stroke="${ink}" stroke-opacity="${OPEN_SEAT_OPACITY}" stroke-width="${strokeWidth}"/>`,
    )
  parts.push(`<circle cx="${SEAT_DOT.cx}" cy="${SEAT_DOT.cy}" r="${SEAT_DOT.r}" fill="${gold}"/>`)
  if (check) {
    parts.push(
      `<path d="${SEAT_CHECK.d}" fill="none" stroke="${checkColor}" stroke-width="${SEAT_CHECK.width}" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
  }
  return `<g transform="translate(${SEAT_TO_LOGO.x} ${SEAT_TO_LOGO.y}) scale(${SEAT_TO_LOGO.scale})">${parts.join("")}</g>`
}
