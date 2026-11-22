import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leadId, action = "auto_route" } = await req.json();

  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // Handle Warm-Transfer No-Answer Fallback
  if (action === "transfer_missed") {
    const { data: lender } = await supabase
      .from("partner_lenders")
      .select("*")
      .eq("id", lead.assigned_lender_id)
      .single();

    await supabase
      .from("leads")
      .update({ lender_routing_status: "Voicemail Fallback — Urgent Callback" })
      .eq("id", lead.id);

    await supabase.from("tasks").insert([
      {
        tenant_id: lead.tenant_id,
        title: `URGENT LENDER CALLBACK: ${lead.full_name} (${lead.phone || "No phone"}) — Warm transfer to ${
          lender?.full_name || "Partner Lender"
        } went to voicemail`,
        due_date: new Date().toISOString().split("T")[0],
        priority: "High",
        status: "Pending",
      },
    ]);

    await supabase.from("lead_events").insert([
      {
        tenant_id: lead.tenant_id,
        lead_id: lead.id,
        event_type: "lender_transfer_missed",
        points_delta: 0,
        message_sender: "ai",
        message_text: `Warm transfer to ${
          lender?.full_name || "partner lender"
        } wasn't answered. Dropped voicemail summary & created an urgent callback task.`,
      },
    ]);

    return NextResponse.json({
      routingStatus: "Voicemail Fallback — Urgent Callback",
      lender,
    });
  }

  // Pick active partner lender with fewest referrals (fair round-robin)
  const { data: lenders } = await supabase
    .from("partner_lenders")
    .select("*")
    .eq("tenant_id", lead.tenant_id)
    .eq("is_active", true)
    .order("referrals_count", { ascending: true })
    .limit(1);

  const selectedLender = lenders?.[0];

  if (!selectedLender) {
    return NextResponse.json(
      { error: "No active partner lenders found. Add one in Settings first." },
      { status: 400 }
    );
  }

  const isHighIntent = Number(lead.intent_score || 0) >= 70;
  const routingStatus = isHighIntent
    ? `Warm Transfer → ${selectedLender.full_name}`
    : `Alert Sent → ${selectedLender.full_name}`;

  await supabase
    .from("leads")
    .update({
      assigned_lender_id: selectedLender.id,
      lender_routing_status: routingStatus,
    })
    .eq("id", lead.id);

  await supabase
    .from("partner_lenders")
    .update({ referrals_count: Number(selectedLender.referrals_count || 0) + 1 })
    .eq("id", selectedLender.id);

  await supabase.from("tasks").insert([
    {
      tenant_id: lead.tenant_id,
      title: isHighIntent
        ? `WARM TRANSFER (${lead.intent_score}%): Connect ${lead.full_name} with lender ${selectedLender.full_name} (${selectedLender.phone})`
        : `LENDER PRE-QUAL ALERT: ${lead.full_name} routed to ${selectedLender.full_name}`,
      due_date: new Date().toISOString().split("T")[0],
      priority: isHighIntent ? "High" : "Medium",
      status: "Pending",
    },
  ]);

  await supabase.from("lead_events").insert([
    {
      tenant_id: lead.tenant_id,
      lead_id: lead.id,
      event_type: "lender_routed",
      points_delta: 0,
      message_sender: "ai",
      message_text: isHighIntent
        ? `High-intent buyer (${lead.intent_score}%) needs pre-qualification — initiating warm transfer to ${selectedLender.full_name} (${selectedLender.phone}).`
        : `Routed ${lead.full_name} to partner lender ${selectedLender.full_name} for pre-qualification outreach.`,
    },
  ]);

  return NextResponse.json({
    routingStatus,
    lender: selectedLender,
    isHighIntent,
  });
}