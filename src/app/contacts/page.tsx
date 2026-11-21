import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import ContactsClient from "./ContactsClient";

export default async function ContactsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: contacts } = await supabase
    .from("leads")
    .select("*")
    .order("full_name", { ascending: true });

  return (
    <ContactsClient
      userEmail={user.email || ""}
      initialContacts={contacts || []}
    />
  );
}