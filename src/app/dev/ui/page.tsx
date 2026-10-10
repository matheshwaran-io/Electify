import { notFound } from "next/navigation"
import { Showcase } from "./showcase"

export const metadata = { title: "UI kit" }

/** Development-only component gallery. Not reachable in production builds. */
export default function DevUiPage() {
  if (process.env.NODE_ENV === "production") notFound()
  return <Showcase />
}
