/**
 * Display formatting. Server-rendered dates are pinned to the institution's
 * time zone so a UTC server never shows students the wrong opening time.
 */
export const APP_TIME_ZONE = "Asia/Kolkata"
const LOCALE = "en-IN"

type DateInput = Date | string | number | null | undefined

const toDate = (d: DateInput) => (d == null ? null : d instanceof Date ? d : new Date(d))

export function formatDateTime(d: DateInput, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }) {
  const date = toDate(d)
  return date ? date.toLocaleString(LOCALE, { timeZone: APP_TIME_ZONE, ...opts }) : ""
}

export function formatDate(d: DateInput, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }) {
  return formatDateTime(d, opts)
}

export function formatTime(d: DateInput) {
  return formatDateTime(d, { hour: "numeric", minute: "2-digit" })
}

/** "Tue, 14 Oct, 10:00 am" */
export function formatOpening(d: DateInput) {
  return formatDateTime(d, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
}

export function formatNumber(n: number) {
  return n.toLocaleString(LOCALE)
}

/** Splits a millisecond duration into clock parts. */
export function splitDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    totalSeconds: total,
  }
}

export const pad2 = (n: number) => String(n).padStart(2, "0")

/** Compact remaining time: "2h 05m", "4m 12s", "38s". */
export function formatRemaining(ms: number) {
  const { days, hours, minutes, seconds } = splitDuration(ms)
  if (days > 0) return `${days}d ${pad2(hours)}h`
  if (hours > 0) return `${hours}h ${pad2(minutes)}m`
  if (minutes > 0) return `${minutes}m ${pad2(seconds)}s`
  return `${seconds}s`
}
