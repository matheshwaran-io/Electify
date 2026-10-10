import type { Transition, Variants } from "framer-motion";

/**
 * Electify motion system — the only springs, durations and easings used in
 * the app. Motion explains a state change; it never decorates.
 *
 * Reduced motion: <MotionProvider> sets `reducedMotion="user"`, so for users
 * who ask for less motion Framer drops transform/layout animation and keeps
 * opacity. Imperative animations (number tickers, rings) must also check
 * `useReducedMotion()` and jump straight to the final value.
 *
 * CSS mirrors live in globals.css (--ease-snappy, --ease-gentle).
 */

export const spring = {
  /** Presses, toggles, selection, small layout shifts. Settles in ~180ms. */
  snappy: { type: "spring", stiffness: 520, damping: 38, mass: 0.7 },
  /** Dialogs, drawers, sections entering. Settles in ~350ms, no overshoot. */
  gentle: { type: "spring", stiffness: 260, damping: 32, mass: 1 },
} as const satisfies Record<string, Transition>;

/** Seconds. */
export const duration = {
  fast: 0.12,
  base: 0.2,
  slow: 0.32,
  /** Number tickers and occupancy rings. */
  value: 0.6,
} as const;

export const ease = {
  /** Mirrors --ease-snappy. */
  snappy: [0.2, 0.9, 0.1, 1],
  /** Mirrors --ease-gentle. */
  gentle: [0.16, 1, 0.3, 1],
} as const;

export const transition = {
  fade: { duration: duration.base, ease: ease.gentle },
  fast: { duration: duration.fast, ease: ease.snappy },
  value: { duration: duration.value, ease: ease.gentle },
} as const satisfies Record<string, Transition>;

/** Shared enter/exit variants. Distances stay small: things settle, they don't fly. */
export const variants = {
  fade: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: transition.fade },
    exit: { opacity: 0, transition: transition.fast },
  },
  rise: {
    hidden: { opacity: 0, y: 6 },
    visible: { opacity: 1, y: 0, transition: spring.gentle },
    exit: { opacity: 0, y: 4, transition: transition.fast },
  },
  pop: {
    hidden: { opacity: 0, scale: 0.97 },
    visible: { opacity: 1, scale: 1, transition: spring.snappy },
    exit: { opacity: 0, scale: 0.98, transition: transition.fast },
  },
} as const satisfies Record<string, Variants>;

/** Parent variant that staggers children's `visible`. */
export function stagger(step = 0.04, delayChildren = 0): Variants {
  return {
    hidden: {},
    visible: { transition: { staggerChildren: step, delayChildren } },
  };
}

/**
 * Per-item delay for list entrances. Capped so long lists never make the
 * last rows wait — anything past the cap appears with the cap's delay.
 */
export function listDelay(index: number, step = 0.02, max = 0.24) {
  return Math.min(index * step, max);
}

/** Press feedback for tappable surfaces. */
export const press = { scale: 0.98 } as const;
