import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { leadId, tenantId, message, history = [] } = body;

    if (!leadId || !message) {
      return NextResponse.json(
        { error: "leadId and message are required" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: lead } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    const activeTenantId = tenantId || lead?.tenant_id;

    const [{ data: tenant }, { data: lenders }] = await Promise.all([
      supabase
        .from("tenants")
        .select("name")
        .eq("id", activeTenantId)
        .single(),
      supabase
        .from("partner_lenders")
        .select("full_name, company, phone")
        .eq("tenant_id", activeTenantId)
        .eq("is_active", true)
        .limit(1),
    ]);

    const workspaceName = tenant?.name || "CloseFlow Real Estate";
    const partnerLender = lenders?.[0] || null;
    const fullTranscript = [
      ...history.map((m: any) => m.content || ""),
      message,
      lead?.lead_source || lead?.source || "",
      lead?.notes || "",
    ]
      .join(" ")
      .toLowerCase();

    // Classify Buyer vs Seller vs Both
    const isSeller =
      /sell|selling|valuation|home value|worth|list my|listing my|equity|cma/.test(
        fullTranscript
      );
    const isBuyer =
      /buy|buying|tour|showing|pre-approv|preapprov|mortgage|bedroom|looking for a home|house hunt/.test(
        fullTranscript
      );

    let roleTag = "Unclassified";
    if (isBuyer && isSeller) roleTag = "Buyer + Seller";
    else if (isSeller) roleTag = "Seller";
    else if (isBuyer) roleTag = "Buyer";

    // Calculate LPMAMA qualification score (0-100)
    let score = Number(lead?.qualification_score ?? lead?.intent_score ?? 25);
    if (roleTag !== "Unclassified") score = Math.max(score, 50);
    if (/30 days|60 days|90 days|asap|this month|next month|soon|ready|weekend|tomorrow/.test(fullTranscript)) {
      score = Math.max(score, 72);
    }
    if (/pre-approv|preapprov|cash|lender|budget|\$[0-9]{3}|address|tour|showing|schedule|offer/.test(fullTranscript)) {
      score = Math.max(score, 85);
    }

    const wantsTour = /tour|showing|see the home|walk through|schedule|appointment|saturday|sunday|tomorrow/.test(
      message.toLowerCase()
    );
    const wantsOffer = /write an offer|make an offer|submit an offer|put in an offer/.test(
      message.toLowerCase()
    );

    const needsLenderWarmTransfer =
      isBuyer &&
      /not pre-approv|no lender|need a lender|haven't talked to a lender|not yet|no preapproval/.test(
        fullTranscript
      );

    let aiReply = "";

    if (process.env.OPENAI_API_KEY) {
      const systemPrompt = `You are the AI Real Estate Concierge for ${workspaceName}.
Lead Name: ${lead?.full_name || "Prospect"}
Lead Source: ${lead?.lead_source || lead?.source || "Direct"}
Detected Role: ${roleTag}
Partner Lender Available: ${
        partnerLender
          ? `${partnerLender.full_name} (${partnerLender.company}, ${partnerLender.phone})`
          : "None"
      }

Your job is to have a clear, concise, friendly SMS-style conversation (2-3 short sentences max per reply) that:
1. Clarifies whether they are looking to BUY, SELL, or BOTH if not yet confirmed.
2. Qualifies Buyers on: (a) target timeframe, (b) budget/area, and (c) mortgage pre-approval status. If they are NOT pre-approved and a Partner Lender is available, warmly offer to connect them with ${partnerLender?.full_name} at ${partnerLender?.company}.
3. Qualifies Sellers on: (a) property address, (b) target timeline to sell, and (c) whether they are also buying their next home.
4. Once qualified (timeline + readiness known), invite them to book a 15-minute call or property tour. Ask only ONE clear question at a time.`;

      const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.4,
          messages: [
            { role: "system", content: systemPrompt },
            ...history.map((h: any) => ({
              role: h.role === "assistant" ? "assistant" : "user",
              content: h.content,
            })),
            { role: "user", content: message },
          ],
        }),
      });

      const openaiData = await openaiRes.json();
      aiReply = openaiData?.choices?.[0]?.message?.content?.trim() || "";
    }

    if (!aiReply) {
      const firstName = (lead?.full_name || "there").split(" ")[0];
      if (roleTag === "Unclassified") {
        aiReply = `Thanks ${firstName}! Just to make sure I point you in the right direction—are you looking to buy a home, sell your current property, or both?`;
      } else if (needsLenderWarmTransfer && partnerLender) {
        aiReply = `Got it, ${firstName}! Since you're looking to buy and aren't pre-approved yet, I can connect you with our partner loan officer ${partnerLender.full_name} at ${partnerLender.company} (${partnerLender.phone}) for a quick 5-minute pre-approval. What timeframe are you hoping to move in?`;
      } else if (roleTag.includes("Seller")) {
        aiReply = `Great—I'd love to help with your sale, ${firstName}. What is the property address and your ideal timeline for listing?`;
      } else {
        aiReply = `Awesome, ${firstName}! To match you with the best homes and lock in tour times, what is your target timeline to move and have you already been pre-approved with a lender?`;
      }
    }

    // Auto-advance Kanban stage based on qualification milestones
    let nextStatus = lead?.status || "New Leads";
    if (wantsOffer && nextStatus !== "Closed Deals") {
      nextStatus = "Fav Offers";
    } else if ((wantsTour || score >= 80) && (nextStatus === "New Leads" || nextStatus === "Contacted")) {
      nextStatus = "Property Tours";
    } else if (nextStatus === "New Leads") {
      nextStatus = "Contacted";
    }

    const updatedHistory = [
      ...history,
      { role: "user", content: message, timestamp: new Date().toISOString() },
      { role: "assistant", content: aiReply, timestamp: new Date().toISOString() },
    ];

    const summaryNote = `${roleTag} (${score}% qualified) • Latest: "${message.slice(0, 90)}"`;

    await supabase
      .from("leads")
      .update({
        tag: roleTag !== "Unclassified" ? roleTag : lead?.tag,
        qualification_score: score,
        intent_score: score,
        status: nextStatus,
        conversation_history: updatedHistory,
        notes: summaryNote,
        last_contacted_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    return NextResponse.json({
      reply: aiReply,
      classification: roleTag,
      qualification_score: score,
      intent_score: score,
      status: nextStatus,
      lenderRouted: needsLenderWarmTransfer,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "AI Concierge error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}