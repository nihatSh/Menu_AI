import { notFound } from "next/navigation";
import { getRestaurant } from "@/data/restaurants";
import { allowPlainTableParam } from "@/lib/session";
import GuestApp from "@/components/GuestApp";

// Plain `?table=N` is a development convenience. In production the only way
// to reach a table is the signed token URL inside its QR code
// (/r/<slug>/t/<token>), so nobody can send food to a table they aren't at.

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const r = getRestaurant(slug);
  return { title: r ? `${r.name} — order at your table` : "Restaurant not found" };
}

export default async function GuestPage({ params, searchParams }) {
  const { slug } = await params;
  const sp = await searchParams;

  const restaurant = getRestaurant(slug);
  if (!restaurant) notFound();

  if (!allowPlainTableParam()) {
    return (
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-sm flex-col items-center justify-center px-6 text-center">
        <span
          aria-hidden="true"
          className="grid h-16 w-16 place-items-center rounded-card bg-sunken text-[32px]"
        >
          {restaurant.emoji}
        </span>
        <h1 className="mt-4 text-display">{restaurant.name}</h1>
        <p className="mt-2 max-w-[30ch] text-pretty text-sm leading-relaxed text-muted">
          Scan the code on your table to see the menu and start ordering.
        </p>
      </main>
    );
  }

  const table = String(sp?.table || sp?.t || "1");
  return <GuestApp restaurant={restaurant} table={table} />;
}
