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
  "M152.645 90.682V24.982H165.155V90.682ZM163.355 90.682V79.882H193.145V90.682ZM163.355 62.692V51.892H190.805V62.692ZM163.355 35.782V24.982H192.425V35.782ZM201.875 90.682V24.982H214.385V90.682ZM195.755 34.342V24.982H214.385V34.342ZM246.515 92.392Q240.215 92.392 235.49 90.232Q230.765 88.072 227.66 84.427Q224.555 80.782 222.98 76.282Q221.405 71.782 221.405 67.102V65.392Q221.405 60.532 222.98 55.987Q224.555 51.442 227.66 47.887Q230.765 44.332 235.355 42.217Q239.945 40.102 245.975 40.102Q253.895 40.102 259.25 43.567Q264.605 47.032 267.305 52.657Q270.005 58.282 270.005 64.762V69.262H226.715V61.612H262.175L258.305 65.392Q258.305 60.712 256.955 57.382Q255.605 54.052 252.86 52.252Q250.115 50.452 245.975 50.452Q241.835 50.452 238.955 52.342Q236.075 54.232 234.59 57.787Q233.105 61.342 233.105 66.292Q233.105 70.882 234.545 74.437Q235.985 77.992 238.955 80.017Q241.925 82.042 246.515 82.042Q251.105 82.042 253.985 80.197Q256.865 78.352 257.675 75.652H269.195Q268.115 80.692 265.055 84.472Q261.995 88.252 257.27 90.322Q252.545 92.392 246.515 92.392ZM298.085 92.392Q291.695 92.392 287.06 90.232Q282.425 88.072 279.32 84.472Q276.215 80.872 274.685 76.372Q273.155 71.872 273.155 67.192V65.482Q273.155 60.532 274.73 55.987Q276.305 51.442 279.455 47.887Q282.605 44.332 287.24 42.217Q291.875 40.102 297.995 40.102Q304.385 40.102 309.425 42.577Q314.465 45.052 317.48 49.462Q320.495 53.872 320.855 59.722H308.705Q308.255 55.942 305.51 53.422Q302.765 50.902 297.995 50.902Q293.855 50.902 291.11 52.882Q288.365 54.862 287.015 58.327Q285.665 61.792 285.665 66.292Q285.665 70.612 286.97 74.122Q288.275 77.632 291.02 79.612Q293.765 81.592 298.085 81.592Q301.325 81.592 303.665 80.422Q306.005 79.252 307.4 77.182Q308.795 75.112 309.155 72.502H321.305Q320.945 78.442 317.84 82.897Q314.735 87.352 309.65 89.872Q304.565 92.392 298.085 92.392ZM348.485 91.312Q341.735 91.312 337.37 89.557Q333.005 87.802 330.845 83.617Q328.685 79.432 328.685 72.322L328.775 28.042H340.475L340.385 73.132Q340.385 76.732 342.32 78.667Q344.255 80.602 347.855 80.602H355.505V91.312ZM320.945 50.992V41.812H355.505V50.992ZM364.325 90.682V41.812H376.835V90.682ZM357.485 51.172V41.812H376.835V51.172ZM368.915 35.962Q365.225 35.962 363.47 34.027Q361.715 32.092 361.715 29.122Q361.715 26.152 363.47 24.262Q365.225 22.372 368.915 22.372Q372.605 22.372 374.315 24.262Q376.025 26.152 376.025 29.122Q376.025 32.092 374.315 34.027Q372.605 35.962 368.915 35.962ZM388.355 90.682V40.642Q388.355 32.272 392.99 28.267Q397.625 24.262 406.715 24.262H412.835V33.892H405.815Q403.025 33.892 401.54 35.377Q400.055 36.862 400.055 39.562V90.682ZM382.235 51.802V42.622H413.645V51.802ZM417.515 109.942V99.232H426.695Q429.305 99.232 431.06 98.557Q432.815 97.882 433.985 96.397Q435.155 94.912 435.785 92.302L448.925 41.812H460.895L446.405 95.002Q444.965 100.492 442.355 103.777Q439.745 107.062 435.65 108.502Q431.555 109.942 425.525 109.942ZM432.725 89.602V79.702H443.165V89.602ZM428.495 89.602 412.655 41.812H425.255L440.285 89.602Z"

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
const LOCKUP_VB = { x: 18, y: 10.058, w: 442.895, h: 99.884 }
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
