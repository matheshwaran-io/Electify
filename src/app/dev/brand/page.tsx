import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Logo, LogoMark } from "@/components/brand";

export const metadata: Metadata = { title: "Brand" };

const SIZES = ["xs", "sm", "md", "lg", "xl"] as const;
const PX = { xs: 14, sm: 17, md: 20, lg: 28, xl: 48 };

function Panel({ dark, children }: { dark?: boolean; children: React.ReactNode }) {
  return (
    <div className={dark ? "dark rounded-panel bg-canvas p-6 text-fg ring-1 ring-border" : "rounded-panel bg-canvas p-6 text-fg ring-1 ring-border"}>
      {children}
    </div>
  );
}

/** Brand sheet: every logo variant and asset, in both themes. Development only. */
export default function BrandPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <Logo size="lg" />
        <p className="text-sm text-fg-muted">
          Logo from the &ldquo;Electify Logo&rdquo; canvas. Size = height of the E. The check appears from 48px, as on the canvas&apos;s favicon drawings.
        </p>
      </header>

      {[false, true].map((dark) => (
        <section key={String(dark)} className="space-y-3">
          <h2 className="text-sm font-medium text-fg-muted">{dark ? "Dark theme" : "Light theme"}</h2>
          <Panel dark={dark}>
            <div className="space-y-6">
              {SIZES.map((s) => (
                <div key={s} className="flex flex-wrap items-center gap-x-10 gap-y-3">
                  <span className="w-20 font-mono text-xs text-fg-subtle">
                    {s} · {PX[s]}px
                  </span>
                  <Logo size={s} />
                  <LogoMark size={s} />
                </div>
              ))}
            </div>
          </Panel>
        </section>
      ))}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-fg-muted">Alignment: the logo&apos;s ink edge sits on the content edge</h2>
        <Panel>
          <div className="border-l border-dashed border-danger/60">
            <div className="flex h-14 items-center border-y border-dashed border-danger/30">
              <Logo size="sm" />
            </div>
            <p className="pt-3 text-sm text-fg-muted">Body copy starts on the same line as the E.</p>
          </div>
        </Panel>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-fg-muted">Files</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* eslint-disable @next/next/no-img-element */}
          <div className="flex flex-wrap items-end gap-4 rounded-panel bg-surface-2 p-6">
            <img src="/favicon.ico" alt="favicon.ico" width={16} height={16} />
            <img src="/icon.svg" alt="icon.svg" width={32} height={32} />
            <img src="/apple-icon.png" alt="Apple touch icon" width={60} height={60} className="rounded-[14px]" />
            <img src="/brand/icon-192.png" alt="Manifest icon" width={96} height={96} />
            <img src="/brand/icon-maskable-512.png" alt="Maskable icon" width={96} height={96} className="rounded-full" />
          </div>
          <div className="rounded-panel bg-surface-2 p-6">
            <img src="/opengraph-image.png" alt="Social preview" width={1200} height={630} className="h-auto w-full rounded-control" />
          </div>
          <div className="rounded-panel bg-[#F5F6F9] p-6">
            <img src="/brand/electify-logo-stacked.svg" alt="Stacked logo" className="mx-auto h-28 w-auto" />
          </div>
          <div className="rounded-panel bg-[#0E1330] p-6">
            <img src="/brand/electify-logo-reverse.svg" alt="Reverse logo" className="mx-auto h-12 w-auto" />
          </div>
          {/* eslint-enable @next/next/no-img-element */}
        </div>
      </section>
    </main>
  );
}
