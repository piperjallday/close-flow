import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function extractKnownAddress(lead: any, transcript: string): string {
  const savedLoc =
    lead?.qualification_data?.location ||
    lead?.qualification_data?.propertyAddress ||
    lead?.property_address;
  if (savedLoc && String(savedLoc).trim().length > 4) {
    return String(savedLoc).trim();
  }

  const combined = `${lead?.notes || ""} ${transcript}`;
  // Match standard street addresses OR number + street + city/state/zip (e.g. "220 Lane Jacksonville FL 32254")
  const addressMatch =
    combined.match(
      /\b\d{1,6}\s+[A-Za-z0-9.\-'\s]{2,45}\b(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Ln|Lane|Ct|Court|Blvd|Boulevard|Way|Pl|Place|Cir|Circle|Ter|Terrace|Pkwy|Parkway)\b(?:,?\s*[A-Za-z\s]{2,25}(?:,?\s*[A-Z]{2})?(?:\s*\d{5})?)?/i
    ) ||
    combined.match(
      /\b\d{1,6}\s+[A-Za-z0-9.\-'\s]{2,45},?\s+[A-Za-z\s]{2,25},?\s+[A-Z]{2}\s*\d{5}\b/i
    );

  return addressMatch ? addressMatch[0].trim() : "";
}

function extractKnownTimeline(lead: any, transcript: string): string {
  const savedTimeline = lead?.qualification_data?.timeline;
  if (savedTimeline && String(savedTimeline).trim()) {
    return String(savedTimeline).trim();
  }
  const match = transcript.match(
    /(immediately|asap|under 30 days|within 30 days|30[–-]60 days|within 3 months|3[–-]6 months|this month|next month|this weekend|saturday|sunday|tomorrow|\b\d+\s*(?:days|weeks|months)\b)/i
  );
  return match ? match[0].trim() : "";
}

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

    // Exclude assistant messages when extracting user-provided facts so AI prompts don't trigger false positives
    const userOnlyTranscript = [
      ...history
        .filter((m: any) => m.role === "user")
        .map((m: any) => m.content || ""),
      message,
      lead?.notes || "",
    ].join(" ");

    const fullLowerTranscript = [
      userOnlyTranscript,
      lead?.lead_source || lead?.source || "",
      JSON.stringify(lead?.qualification_data || {}),
    ]
      .join(" ")
      .toLowerCase();

    const knownAddress = extractKnownAddress(lead, userOnlyTranscript);
    const knownTimeline = extractKnownTimeline(lead, userOnlyTranscript);

    const hasPreApprovalInfo = /pre-approv|preapprov|cash buyer|not pre-approv|need pre-approval/.test(
      fullLowerTranscript
    );
    const alreadyAnsweredBuyingNext = /buying next|also buying|buying another|not buying|just selling|only selling|don't have a property|no property/.test(
      fullLowerTranscript
    );
    const alreadyBookedCall = /call|walkthrough|comps|tour|showing|saturday|sunday|tomorrow|morning|afternoon|evening/.test(
      message.toLowerCase()
    );

    // Classify Buyer vs Seller vs Both
    const isSeller =
      /sell|selling|valuation|home value|worth|list my|listing my|equity|cma|owner valuation/.test(
        fullLowerTranscript
      );
    const isBuyer =
      /buy|buying|tour|showing|pre-approv|preapprov|mortgage|bedroom|looking for a home|house hunt|property capture/.test(
        fullLowerTranscript
      );

    let roleTag = "Unclassified";
    if (isBuyer && isSeller) roleTag = "Buyer + Seller";
    else if (isSeller) roleTag = "Seller";
    else if (isBuyer) roleTag = "Buyer";

    // Calculate LPMAMA qualification score (0-100)
    let score = Number(lead?.qualification_score ?? lead?.intent_score ?? 25);
    if (roleTag !== "Unclassified") score = Math.max(score, 50);
    if (knownAddress) score = Math.max(score, 70);
    if (knownTimeline) score = Math.max(score, 80);
    if (hasPreApprovalInfo || alreadyAnsweredBuyingNext || alreadyBookedCall) {
      score = Math.max(score, 88);
    }

    const wantsTour = /tour|showing|see the home|walk through|schedule|appointment|call|saturday|sunday|tomorrow/.test(
      message.toLowerCase()
    );
    const wantsOffer = /write an offer|make an offer|submit an offer|put in an offer/.test(
      message.toLowerCase()
    );

    const needsLenderWarmTransfer =
      isBuyer &&
      /not pre-approv|no lender|need a lender|need pre-approval|haven't talked to a lender|not yet|no preapproval/.test(
        fullLowerTranscript
      );

    let aiReply = "";

    if (process.env.OPENAI_API_KEY) {
      const systemPrompt = `You are the AI Real Estate Concierge for ${workspaceName}.
Lead Name: ${lead?.full_name || "Prospect"}
Detected Role: ${roleTag}
ALREADY KNOWN FACTS (DO NOT ASK FOR THESE AGAIN):
- Property Address: ${knownAddress || "Not yet provided"}
- Target Timeline: ${knownTimeline || "Not yet provided"}
- Buying Next Home Info: ${alreadyAnsweredBuyingNext ? "Already answered by lead" : "Unknown"}
- Pre-Approval / Financing Info: ${hasPreApprovalInfo ? "Already provided" : "Unknown"}
- Partner Lender Available: ${
        partnerLender
          ? `${partnerLender.full_name} (${partnerLender.company}, ${partnerLender.phone})`
          : "None"
      }

STRICT RULES:
1. NEVER ask for information listed under ALREADY KNOWN FACTS above. Always acknowledge what the user just said first.
2. Keep replies concise (2-3 short sentences max) and ask only ONE logical next question.
3. For Sellers / Buyer+Sellers: Once Property Address is known, ask for their ideal timeline if missing, or propose a 15-minute pricing & net-proceeds call.`;

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

    // Smart context-aware fallback (never repeats already-known fields or the previous AI message)
    if (!aiReply) {
      const firstName = (lead?.full_name || "there").split(" ")[0];
      const lastAssistantMsg =
        [...history].reverse().find((m: any) => m.role === "assistant")?.content || "";

      if (roleTag === "Unclassified") {
        aiReply = `Thanks ${firstName}! Just to make sure I point you in the right direction—are you looking to buy a home, sell your current property, or both?`;
      } else if (roleTag.includes("Seller")) {
        if (!knownAddress) {
          aiReply = `No problem at all, ${firstName}—we can line up your next home search once we value your current place. What is the street address of the property you're thinking of selling?`;
        } else if (!knownTimeline) {
          aiReply = `Got it, ${firstName}—we have ${knownAddress} pulled up! What is your ideal timeline for selling, and what day/time works best for a quick 15-minute pricing call?`;
        } else if (alreadyBookedCall) {
          aiReply = `Perfect, ${firstName}! Our senior advisor is preparing the comparable sales breakdown for ${knownAddress} (${knownTimeline}) and will reach out shortly to confirm.`;
        } else {
          aiReply = `Thanks ${firstName}! We have ${knownAddress} and your ${knownTimeline} timeline noted. What day and time works best for a quick 15-minute pricing & net-proceeds call with our advisor?`;
        }
      } else {
        if (needsLenderWarmTransfer && partnerLender) {
          aiReply = `Got it, ${firstName}! I can connect you with our partner loan officer ${partnerLender.full_name} at ${partnerLender.company} (${partnerLender.phone}) for a fast pre-approval${
            knownAddress ? ` for ${knownAddress}` : ""
          }. What day/time works best for a quick call or tour?`;
        } else if (alreadyBookedCall) {
          aiReply = `You're all set, ${firstName}! Our advisor will confirm your showing details${
            knownAddress ? ` for ${knownAddress}` : ""
          } right away.`;
        } else if (knownAddress && knownTimeline) {
          aiReply = `Awesome, ${firstName}—we have your ${knownTimeline} timeline noted${
            knownAddress ? ` for ${knownAddress}` : ""
          }. What day and time works best for a private tour?`;
        } else {
          aiReply = `Awesome, ${firstName}! What is your target timeline to move and have you already been pre-approved with a lender?`;
        }
      }

      // Hard anti-repeat guard: never send the exact same reply twice in a row
      if (aiReply === lastAssistantMsg) {
        aiReply = `Thanks for sharing that, ${firstName}! I've updated your file${
          knownAddress ? ` for ${knownAddress}` : ""
        }. What day and time works best for a quick 15-minute call with our advisor?`;
      }
    }

    // Auto-advance Kanban stage based on qualification milestones
    let nextStatus = lead?.status || "New Leads";
    if (wantsOffer && nextStatus !== "Closed Deals") {
      nextStatus = "Fav Offers";
    } else if (
      (wantsTour || score >= 80) &&
      (nextStatus === "New Leads" || nextStatus === "Contacted")
    ) {
      nextStatus = "Property Tours";
    } else if (nextStatus === "New Leads") {
      nextStatus = "Contacted";
    }

    const updatedHistory = [
      ...history,
      { role: "user", content: message, timestamp: new Date().toISOString() },
      { role: "assistant", content: aiReply, timestamp: new Date().toISOString() },
    ];

    const summaryNote = `${roleTag} (${score}% qualified)${
      knownAddress ? ` • ${knownAddress}` : ""
    } • Latest: "${message.slice(0, 80)}"`;

    await supabase
      .from("leads")
      .update({
        tag: roleTag !== "Unclassified" ? roleTag : lead?.tag,
        qualification_score: score,
        intent_score: score,
        status: nextStatus,
        qualification_data: {
          ...(lead?.qualification_data || {}),
          ...(knownAddress ? { location: knownAddress } : {}),
          ...(knownTimeline ? { timeline: knownTimeline } : {}),
        },
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