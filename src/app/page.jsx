import Link from "next/link";
import { ArrowRight, QrCode, ForkKnife, ChartBar } from "@phosphor-icons/react/dist/ssr";
import { restaurants } from "@/data/restaurants";
import { accentVars } from "@/lib/theme";

export const metadata = {
  title: "Scan & Eat — the AI waiter behind a QR code",
  description:
    "Every restaurant gets its own code. Guests scan it at the table and the AI recommends what to order from that restaurant's real menu.",
};

export default function Home() {
  return (
    <main id="main" className="mx-auto min-h-[100dvh] max-w-3xl px-5 py-12 sm:py-20">
      <header className="max-w-xl">
        <h1 className="text-balance text-[32px] font-bold leading-[1.1] tracking-[-0.025em] sm:text-[42px]">
          The AI waiter that lives behind a QR code
        </h1>
        <p className="mt-4 max-w-[56ch] text-pretty text-[15px] leading-relaxed text-muted">
          Every restaurant gets its own code. Guests scan it at the table and the AI recommends what
          to order from that restaurant&apos;s real menu, by mood, diet, calories or budget.
        </p>
      </header>

      <section className="mt-12">
        <h2 className="text-[13px] font-semibold text-faint">Demo restaurants</h2>

        <div className="mt-4 grid gap-3">
          {restaurants.map((r) => (
            <article
              key={r.slug}
              style={accentVars(r.theme)}
              className="rounded-card bg-raised p-5 shadow-card transition-shadow duration-200 hover:shadow-lift"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-control bg-accent-soft text-[24px]"
                >
                  {r.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-title">{r.name}</h3>
                  <p className="tnum truncate text-[12.5px] text-muted">
                    {r.cuisine} &middot; {r.menu.length} dishes &middot; {r.tables} tables
                  </p>
                </div>
              </div>

              {/* One primary path, two secondary. Not three identical buttons. */}
              <Link
                href={`/r/${r.slug}?table=4`}
                className="mt-4 flex items-center justify-between gap-3 rounded-control bg-accent px-4 py-3 text-accent-ink transition-transform duration-200 ease-out active:scale-[0.98]"
              >
                <span className="text-sm font-semibold">Open as a guest</span>
                <ArrowRight size={17} weight="bold" />
              </Link>

              <div className="mt-2 flex gap-2">
                <Link
                  href={`/owner/${r.slug}`}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-control bg-sunken px-3 py-2.5 text-[13px] font-medium text-muted transition-colors hover:text-ink"
                >
                  <ChartBar size={15} weight="bold" />
                  Owner
                </Link>
                <Link
                  href={`/owner/${r.slug}/kitchen`}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-control bg-sunken px-3 py-2.5 text-[13px] font-medium text-muted transition-colors hover:text-ink"
                >
                  <ForkKnife size={15} weight="bold" />
                  Kitchen
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10 flex items-start gap-3 rounded-card bg-sunken p-5">
        <QrCode size={20} weight="duotone" className="mt-0.5 shrink-0 text-muted" />
        <div>
          <h2 className="text-[14px] font-semibold">Try it on your phone</h2>
          <p className="mt-1 max-w-[60ch] text-pretty text-[13px] leading-relaxed text-muted">
            Open an owner dashboard, go to the QR codes tab, and scan a table code with your phone
            camera. It opens the guest page with that table already set, exactly as a real guest
            would see it.
          </p>
        </div>
      </section>
    </main>
  );
}
