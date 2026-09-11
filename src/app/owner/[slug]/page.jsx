import { notFound } from "next/navigation";
import { getRestaurant } from "@/data/restaurants";
import { tableToken } from "@/lib/session";
import OwnerDashboard from "@/components/OwnerDashboard";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const r = getRestaurant(slug);
  return { title: r ? `${r.name} — owner dashboard` : "Not found" };
}

export default async function OwnerPage({ params }) {
  const { slug } = await params;
  const restaurant = getRestaurant(slug);
  if (!restaurant) notFound();

  // Tokens are signed server-side; the browser only ever sees the finished
  // path so the secret never leaves the server.
  const tablePaths = Array.from({ length: restaurant.tables }, (_, i) => {
    const n = i + 1;
    return { table: n, path: `/r/${slug}/t/${tableToken(slug, n)}` };
  });

  return <OwnerDashboard restaurant={restaurant} tablePaths={tablePaths} />;
}
