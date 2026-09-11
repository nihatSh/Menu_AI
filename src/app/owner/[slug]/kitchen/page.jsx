import { notFound } from "next/navigation";
import { getRestaurant } from "@/data/restaurants";
import KitchenScreen from "@/components/KitchenScreen";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const r = getRestaurant(slug);
  return { title: r ? `${r.name} — kitchen` : "Not found" };
}

export default async function KitchenPage({ params }) {
  const { slug } = await params;
  const restaurant = getRestaurant(slug);
  if (!restaurant) notFound();

  return <KitchenScreen restaurant={restaurant} />;
}
