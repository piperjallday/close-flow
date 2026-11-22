import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { runAiConcierge, ConciergeMessage } from "../../../../lib/concierge";

export async function POST(request: Request) {
  try {
    const { leadId, leadName, message, history = [], existingData = {} } = await request.json();

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let workspaceName = "CloseFlow Real Estate";
    if (user) {
      const { data: profile } = await supabase
        .from("users")
        .select("tenants(name)")
        .eq("id", user.id)
        .single();
      const tenant = Array.isArray(profile?.tenants) ? profile?.tenants[0] : profile?.tenants;
      if (tenant?.name) workspaceName = tenant.name;
    }

    const updatedHistory: ConciergeMessage[] = [
      ...history,
      { role: "user", content: message, timestamp: new Date().toISOString() },
    ];

    const result = await runAiConcierge({
      workspaceName,
      leadName: leadName || "Prospect",
      history: updatedHistory,
      existingData,
    });

    const finalHistory: ConciergeMessage[] = [
      ...updatedHistory,
      { role: "assistant", content: result.reply, timestamp: new Date().toISOString() },
    ];

    if (leadId && user) {
      await supabase
        .from("leads")
        .update({
          status: result.status,
          qualification_score: result.score,
          qualification_data: result.qualificationData,
          conversation_history: finalHistory,
          notes: result.qualificationData.summary,
          last_contacted_at: new Date().toISOString(),
        })
        .eq("id", leadId);
    }

    return NextResponse.json({
      ...result,
      history: finalHistory,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Failed to run AI Concierge";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}