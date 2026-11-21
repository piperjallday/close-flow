import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import ListingsClient from "./ListingsClient";

export default async function ListingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: listings } = await supabase
    .from("listings")
    .select("*")
    .order("created_at", { ascending: false });

  return <ListingsClient userEmail={user.email || ""} initialListings={listings || []} />;
}