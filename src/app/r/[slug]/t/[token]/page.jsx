import { notFound } from "next/navigation";
import { getRestaurant } from "@/data/restaurants";
import { verifyTableToken } from "@/lib/session";
import GuestApp from "@/components/GuestApp";

// This is the URL printed inside every QR code: /r/<slug>/t/<table>.<signature>
// A forged or edited token lands on the not-found page instead of a table.

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const r = getRestaurant(slug);
  return { title: r ? `${r.name} — order at your table` : "Restaurant not found" };
}

export default async function TokenTablePage({ params }) {
  const { slug, token } = await params;
  const restaurant = getRestaurant(slug);
  if (!restaurant) notFound();

  const table = verifyTableToken(slug, token);
  if (!table) notFound();

  return <GuestApp restaurant={restaurant} table={table} />;
}
