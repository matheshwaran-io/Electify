import { notFound } from "next/navigation";
import { Sora } from "next/font/google";

const sora = Sora({ subsets: ["latin"], weight: ["500", "600"], display: "swap" });

/** Temporary: loads Sora so the wordmark can be outlined from the real font. */
export default function BrandSourcePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="p-10">
      <p id="sora-live" className={sora.className} style={{ fontSize: 132, fontWeight: 600, letterSpacing: "-0.045em", lineHeight: 1 }}>
        Electify
      </p>
      <p id="sora-tag" className={sora.className} style={{ fontSize: 15, fontWeight: 500, letterSpacing: "0.3em", textTransform: "uppercase", lineHeight: 1 }}>
        Elective Registration &amp; Management
      </p>
    </main>
  );
}
