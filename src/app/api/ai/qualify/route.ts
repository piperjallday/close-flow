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

  const { leadId, prospectReply } = await req.json();

  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const lpmama = { ...(lead.lpmama_data || {}) };
  const reply = (prospectReply || "").trim();
  let nextAiMessage = "";
  let pointsEarned = 15;

  // Check if prospect is bound to an exclusive buyer agreement
  if (
    !lpmama.agent_status &&
    /signed|exclusive|already have an agent|working with an agent/i.test(reply)
  ) {
    lpmama.agent_status = "Represented (Exclusive)";
    nextAiMessage =
      "Got it—thanks for letting me know! Since you already have an exclusive agreement with an agent, I'll step back so we respect your representation. Wishing you a smooth move!";
    pointsEarned = 0;
  } else if (!lpmama.location) {
    lpmama.location = reply;
    nextAiMessage = `Love ${reply}! What price range are you targeting so I can match you with the best active options?`;
  } else if (!lpmama.price) {
    lpmama.price = reply;
    nextAiMessage =
      "Great budget range. Have you already been pre-approved with a lender, or are you planning to pay cash?";
  } else if (!lpmama.mortgage) {
    lpmama.mortgage = reply;
    nextAiMessage =
      "Got it! Just to confirm before we line up showings—are you currently signed with another real estate agent?";
  } else if (!lpmama.agent_status) {
    lpmama.agent_status = "Unrepresented";
    nextAiMessage =
      "Perfect. What's motivating your move right now, and how soon are you hoping to be in your new place?";
  } else if (!lpmama.motivation) {
    lpmama.motivation = reply;
    nextAiMessage =
      "That makes total sense. Would you like to jump on a quick 10-minute call or tour homes this Thursday at 4 PM or Saturday at 11 AM?";
  } else {
    lpmama.appointment = reply;
    lpmama.qualified = true;
    pointsEarned = 25;
    nextAiMessage = `Locked in for ${reply}! I've notified our senior agent with your full LPMAMA profile so they're prepared for you.`;
  }

  const newScore = Math.min(100, Number(lead.intent_score || 25) + pointsEarned);
  const crossedHotThreshold = Number(lead.intent_score || 25) < 70 && newScore >= 70;
  const nextStatus =
    lpmama.qualified || newScore >= 70
      ? lead.status === "New Leads" || lead.status === "Contacted"
        ? "Property Tours"
        : lead.status
      : lead.status === "New Leads"
      ? "Contacted"
      : lead.status;

  await supabase
    .from("leads")
    .update({
      intent_score: newScore,
      status: nextStatus,
      lpmama_data: lpmama,
    })
    .eq("id", lead.id);

  // Log prospect reply & AI response
  await supabase.from("lead_events").insert([
    {
      tenant_id: lead.tenant_id,
      lead_id: lead.id,
      event_type: "sms_reply",
      points_delta: pointsEarned,
      message_sender: "prospect",
      message_text: reply,
    },
    {
      tenant_id: lead.tenant_id,
      lead_id: lead.id,
      event_type: "ai_lpmama_step",
      points_delta: 0,
      message_sender: "ai",
      message_text: nextAiMessage,
    },
  ]);

  // Trigger high-priority alert task when crossing 70% readiness threshold
  if (crossedHotThreshold || lpmama.qualified) {
    await supabase.from("tasks").insert([
      {
        tenant_id: lead.tenant_id,
        title: `HOT LEAD (${newScore}%): ${lead.full_name} — ${
          lpmama.appointment || "Ready for Immediate Outreach"
        }`,
        due_date: new Date().toISOString().split("T")[0],
        priority: "High",
        status: "Pending",
      },
    ]);
  }

  return NextResponse.json({
    intentScore: newScore,
    status: nextStatus,
    lpmama,
    aiReply: nextAiMessage,
    crossedHotThreshold,
  });
}