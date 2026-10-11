import { cn } from "@/lib/utils"

/**
 * The Electify logo, from the "Electify Logo" design canvas.
 *
 * Mark: an E of rounded bars with a gold dot carrying a check (120-unit box).
 * Wordmark: "Electify" in Sora SemiBold, letter-spacing -0.045em, outlined from
 * the font itself (glyph positions and kerning match Chrome's layout), so it
 * renders identically everywhere without loading Sora at runtime.
 *
 * Both viewBoxes are cropped to the ink, so the logo's left edge lines up with
 * whatever it sits beside. The lockup's viewBox is centred on the mark (y = 60),
 * so flex/grid centring centres the mark, not the descender of the "y".
 *
 * Colours: bars + wordmark use --brand-ink (midnight in light, mist in dark),
 * the dot --brand-gold, the check --brand-midnight in both themes.
 * Below 48px the check is dropped, matching the canvas's favicon drawings.
 */

const WORDMARK_D =
  "M152.645 90.6V24.9H165.155V90.6ZM163.355 90.6V79.8H193.145V90.6ZM163.355 62.61V51.81H190.805V62.61ZM163.355 35.7V24.9H192.425V35.7ZM201.875 90.6V24.9H214.385V90.6ZM195.755 34.26V24.9H214.385V34.26ZM246.515 92.31Q240.215 92.31 235.49 90.15Q230.765 87.99 227.66 84.345Q224.555 80.7 222.98 76.2Q221.405 71.7 221.405 67.02V65.31Q221.405 60.45 222.98 55.905Q224.555 51.36 227.66 47.805Q230.765 44.25 235.355 42.135Q239.945 40.02 245.975 40.02Q253.895 40.02 259.25 43.485Q264.605 46.95 267.305 52.575Q270.005 58.2 270.005 64.68V69.18H226.715V61.53H262.175L258.305 65.31Q258.305 60.63 256.955 57.3Q255.605 53.97 252.86 52.17Q250.115 50.37 245.975 50.37Q241.835 50.37 238.955 52.26Q236.075 54.15 234.59 57.705Q233.105 61.26 233.105 66.21Q233.105 70.8 234.545 74.355Q235.985 77.91 238.955 79.935Q241.925 81.96 246.515 81.96Q251.105 81.96 253.985 80.115Q256.865 78.27 257.675 75.57H269.195Q268.115 80.61 265.055 84.39Q261.995 88.17 257.27 90.24Q252.545 92.31 246.515 92.31ZM298.085 92.31Q291.695 92.31 287.06 90.15Q282.425 87.99 279.32 84.39Q276.215 80.79 274.685 76.29Q273.155 71.79 273.155 67.11V65.4Q273.155 60.45 274.73 55.905Q276.305 51.36 279.455 47.805Q282.605 44.25 287.24 42.135Q291.875 40.02 297.995 40.02Q304.385 40.02 309.425 42.495Q314.465 44.97 317.48 49.38Q320.495 53.79 320.855 59.64H308.705Q308.255 55.86 305.51 53.34Q302.765 50.82 297.995 50.82Q293.855 50.82 291.11 52.8Q288.365 54.78 287.015 58.245Q285.665 61.71 285.665 66.21Q285.665 70.53 286.97 74.04Q288.275 77.55 291.02 79.53Q293.765 81.51 298.085 81.51Q301.325 81.51 303.665 80.34Q306.005 79.17 307.4 77.1Q308.795 75.03 309.155 72.42H321.305Q320.945 78.36 317.84 82.815Q314.735 87.27 309.65 89.79Q304.565 92.31 298.085 92.31ZM348.485 91.23Q341.735 91.23 337.37 89.475Q333.005 87.72 330.845 83.535Q328.685 79.35 328.685 72.24L328.775 27.96H340.475L340.385 73.05Q340.385 76.65 342.32 78.585Q344.255 80.52 347.855 80.52H355.505V91.23ZM320.945 50.91V41.73H355.505V50.91ZM364.325 90.6V41.73H376.835V90.6ZM357.485 51.09V41.73H376.835V51.09ZM368.915 35.88Q365.225 35.88 363.47 33.945Q361.715 32.01 361.715 29.04Q361.715 26.07 363.47 24.18Q365.225 22.29 368.915 22.29Q372.605 22.29 374.315 24.18Q376.025 26.07 376.025 29.04Q376.025 32.01 374.315 33.945Q372.605 35.88 368.915 35.88ZM388.355 90.6V40.56Q388.355 32.19 392.99 28.185Q397.625 24.18 406.715 24.18H412.835V33.81H405.815Q403.025 33.81 401.54 35.295Q400.055 36.78 400.055 39.48V90.6ZM382.235 51.72V42.54H413.645V51.72ZM417.515 109.86V99.15H426.695Q429.305 99.15 431.06 98.475Q432.815 97.8 433.985 96.315Q435.155 94.83 435.785 92.22L448.925 41.73H460.895L446.405 94.92Q444.965 100.41 442.355 103.695Q439.745 106.98 435.65 108.42Q431.555 109.86 425.525 109.86ZM432.725 89.52V79.62H443.165V89.52ZM428.495 89.52 412.655 41.73H425.255L440.285 89.52Z"

const BARS = [
  [18, 18, 18, 84],
  [18, 18, 70, 18],
  [18, 84, 70, 18],
  [18, 51, 42, 18],
] as const

/** Height of the E in CSS px. */
const SIZES = { xs: 14, sm: 17, md: 20, lg: 28, xl: 48 } as const
type Size = keyof typeof SIZES | number

const MARK_VB = { x: 18, y: 18, w: 85, h: 84 }
const LOCKUP_VB = { x: 18, y: 10.14, w: 442.895, h: 99.72 }
const CHECK_MIN = 48

function px(size: Size) {
  return typeof size === "number" ? size : SIZES[size]
}

function MarkShapes({ check }: { check: boolean }) {
  return (
    <>
      {BARS.map(([x, y, w, h]) => (
        <rect key={`${x}-${y}-${w}`} x={x} y={y} width={w} height={h} rx={9} fill="currentColor" />
      ))}
      <circle cx={88} cy={60} r={15} fill="var(--brand-gold)" />
      {check ? (
        <path d="M80.5 60.5L86 66L95.5 55" fill="none" stroke="var(--brand-midnight)" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
    </>
  )
}

type LogoProps = {
  /** Height of the E: a preset or CSS px. */
  size?: Size
  /** Force the check on or off. Default: on from 48px, as on the canvas. */
  check?: boolean
  /** Accessible name. Pass false when a parent already names it (e.g. a labelled link). */
  label?: string | false
  className?: string
}

function a11y(label: string | false | undefined, fallback: string) {
  return label === false ? ({ "aria-hidden": true } as const) : ({ role: "img", "aria-label": label ?? fallback } as const)
}

/** The E mark on its own. */
export function LogoMark({ size = "md", check, label, className }: LogoProps) {
  const e = px(size)
  return (
    <svg
      viewBox={`${MARK_VB.x} ${MARK_VB.y} ${MARK_VB.w} ${MARK_VB.h}`}
      width={(e * MARK_VB.w) / MARK_VB.h}
      height={e}
      className={cn("block shrink-0 text-brand-ink", className)}
      focusable="false"
      {...a11y(label, "Electify")}
    >
      <MarkShapes check={check ?? e >= CHECK_MIN} />
    </svg>
  )
}

/** Mark + wordmark, spaced exactly as the primary lockup. */
export function Logo({ size = "md", check, label, className }: LogoProps) {
  const e = px(size)
  const unit = e / 84
  return (
    <svg
      viewBox={`${LOCKUP_VB.x} ${LOCKUP_VB.y} ${LOCKUP_VB.w} ${LOCKUP_VB.h}`}
      width={LOCKUP_VB.w * unit}
      height={LOCKUP_VB.h * unit}
      className={cn("block shrink-0 text-brand-ink", className)}
      focusable="false"
      {...a11y(label, "Electify")}
    >
      <MarkShapes check={check ?? e >= CHECK_MIN} />
      <path d={WORDMARK_D} fill="currentColor" />
    </svg>
  )
}
