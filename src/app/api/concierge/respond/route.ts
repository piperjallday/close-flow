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
    /(immediately|asap|under 30 days|within 30 days|30[–-]60 days|within 3 months|3[–-]6 months|this month|next month|just exploring value|just exploring|\b\d+\s*(?:days|weeks|months)\b)/i
  );
  return match ? match[0].trim() : "";
}

function detectMeetingFormat(transcript: string): "In-Person" | "Google Meet / Zoom" | "Phone Call" | "" {
  // Check the most recent preference mentioned by the lead
  const inPersonIdx = Math.max(
    transcript.lastIndexOf("in person"),
    transcript.lastIndexOf("in-person")
  );
  const videoIdx = Math.max(
    transcript.lastIndexOf("google"),
    transcript.lastIndexOf("zoom"),
    transcript.lastIndexOf("video")
  );
  const phoneIdx = Math.max(
    transcript.lastIndexOf("phone call"),
    transcript.lastIndexOf("over the phone"),
    transcript.lastIndexOf("by phone"),
    transcript.lastIndexOf("call me"),
    /\bphone\b/.test(transcript) ? transcript.lastIndexOf("phone") : -1
  );

  const maxIdx = Math.max(inPersonIdx, videoIdx, phoneIdx);
  if (maxIdx === -1) return "";
  if (maxIdx === inPersonIdx) return "In-Person";
  if (maxIdx === videoIdx) return "Google Meet / Zoom";
  return "Phone Call";
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

    // Only inspect the lead's own messages (not assistant prompts) for user choices
    const userMessagesOnly = [
      ...history
        .filter((m: any) => m.role === "user")
        .map((m: any) => m.content || ""),
      message,
    ].join(" ");

    const userWithNotes = `${userMessagesOnly} ${lead?.notes || ""}`;

    const fullLowerTranscript = [
      userWithNotes,
      lead?.lead_source || lead?.source || "",
      JSON.stringify(lead?.qualification_data || {}),
    ]
      .join(" ")
      .toLowerCase();

    const lowerUserOnly = userMessagesOnly.toLowerCase();
    const lowerMessage = message.toLowerCase();

    const knownAddress = extractKnownAddress(lead, userWithNotes);
    const knownTimeline = extractKnownTimeline(lead, userWithNotes);
    const meetingFormat = detectMeetingFormat(lowerUserOnly);

    const hasPreApprovalInfo = /pre-approv|preapprov|cash buyer|not pre-approv|need pre-approval/.test(
      fullLowerTranscript
    );
    const alreadyAnsweredBuyingNext = /buying next|also buying|buying another|not buying|just selling|only selling|don't have a property|no property/.test(
      fullLowerTranscript
    );
    const alreadyBookedTime = /tomorrow|today|this weekend|next week|saturday|sunday|monday|tuesday|wednesday|thursday|friday|\b\d{1,2}\s*(?:am|pm)\b|\b\d{1,2}:\d{2}\b|morning|afternoon|evening/.test(
      lowerUserOnly
    );

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

    let score = Number(lead?.qualification_score ?? lead?.intent_score ?? 25);
    if (roleTag !== "Unclassified") score = Math.max(score, 50);
    if (knownAddress) score = Math.max(score, 70);
    if (knownTimeline) score = Math.max(score, 80);
    if (hasPreApprovalInfo || alreadyAnsweredBuyingNext || meetingFormat) {
      score = Math.max(score, 88);
    }
    if (alreadyBookedTime && meetingFormat) {
      score = Math.max(score, 95);
    }

    const wantsTour = /tour|showing|see the home|walk through|schedule|appointment|saturday|sunday|tomorrow|\b\d{1,2}\s*(?:am|pm)\b/.test(
      lowerUserOnly
    );
    const wantsOffer = /write an offer|make an offer|submit an offer|put in an offer/.test(
      lowerUserOnly
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
- Preferred Meeting Format: ${meetingFormat || "Not yet chosen (options: Phone Call, In-Person, or Google Meet / Zoom)"}
- Day/Time Selected: ${alreadyBookedTime ? "YES — already provided by lead" : "Not yet"}
- Partner Lender Available: ${
        partnerLender
          ? `${partnerLender.full_name} (${partnerLender.company}, ${partnerLender.phone})`
          : "None"
      }

STRICT RULES:
1. NEVER ask for information listed under ALREADY KNOWN FACTS above. If they already picked Phone Call, In-Person, or Google Meet / Zoom, acknowledge that exact choice and do NOT ask for meeting format again.
2. Always refer to the agent/brokerage as "someone from our team" (never say "senior advisor" or "advisor").
3. Offer three clear ways to connect: a quick phone call, an in-person meeting, or a Google Meet / Zoom video call.
4. Once both meeting format and day/time are confirmed, let them know someone from our team has everything noted and will reach out to confirm. Keep replies concise (2-3 short sentences max).`;

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
      const lastAssistantMsg =
        [...history].reverse().find((m: any) => m.role === "assistant")?.content || "";

      const formatLabel =
        meetingFormat === "Phone Call"
          ? "phone call"
          : meetingFormat === "In-Person"
          ? "in-person meeting"
          : meetingFormat === "Google Meet / Zoom"
          ? "Google Meet / Zoom video call"
          : "";

      if (/comp|comparable|recent sales/i.test(lowerMessage)) {
        if (meetingFormat && !alreadyBookedTime) {
          aiReply = `Got it, ${firstName}! Someone from our team is pulling the recent neighborhood comparable sales${
            knownAddress ? ` for ${knownAddress}` : ""
          } to go over on our ${formatLabel}. What day and time works best for you?`;
        } else if (!meetingFormat) {
          aiReply = `Got it, ${firstName}! Someone from our team is pulling the recent neighborhood comparable sales${
            knownAddress ? ` for ${knownAddress}` : ""
          }—would you prefer to go over them on a quick phone call, in person, or via Google Meet / Zoom?`;
        } else {
          aiReply = `Got it, ${firstName}! Someone from our team is pulling the recent neighborhood comparable sales${
            knownAddress ? ` for ${knownAddress}` : ""
          } and will have them ready for your ${formatLabel}.`;
        }
      } else if (roleTag === "Unclassified") {
        aiReply = `Thanks ${firstName}! Just to make sure I point you in the right direction—are you looking to buy a home, sell your current property, or both?`;
      } else if (roleTag.includes("Seller")) {
        if (!knownAddress) {
          aiReply = `No problem at all, ${firstName}—we can line up your next home search once we value your current place. What is the street address of the property you're thinking of selling?`;
        } else if (!knownTimeline) {
          aiReply = `Got it, ${firstName}—we have ${knownAddress} pulled up! What is your ideal timeline for selling, and would you prefer a quick phone call, an in-person visit, or a Google Meet / Zoom call with someone from our team?`;
        } else if (meetingFormat && !alreadyBookedTime) {
          aiReply = `Got it, ${firstName}—we'll set up a ${formatLabel} with someone from our team${
            knownAddress ? ` regarding ${knownAddress}` : ""
          }. What day and time works best for you?`;
        } else if (!meetingFormat && !alreadyBookedTime) {
          aiReply = `Thanks ${firstName}! We have ${knownAddress} and your ${knownTimeline} timeline noted. Would you prefer a quick phone call, an in-person meeting, or a Google Meet / Zoom call with someone from our team, and what day/time works best?`;
        } else if (!meetingFormat && alreadyBookedTime) {
          aiReply = `Got that time locked in, ${firstName}! Would you prefer a quick phone call, an in-person meeting at ${knownAddress}, or a Google Meet / Zoom video call with someone from our team?`;
        } else {
          aiReply = `You're all set, ${firstName}! Someone from our team has your ${knownAddress} details and ${formatLabel} time noted and will reach out shortly to confirm.`;
        }
      } else {
        if (needsLenderWarmTransfer && partnerLender) {
          aiReply = `Got it, ${firstName}! I can connect you with our partner loan officer ${partnerLender.full_name} at ${partnerLender.company} (${partnerLender.phone}) for a fast pre-approval${
            knownAddress ? ` for ${knownAddress}` : ""
          }. What day and time works best to connect with someone from our team (phone call, in person, or Google Meet / Zoom)?`;
        } else if (meetingFormat && !alreadyBookedTime) {
          aiReply = `Got it, ${firstName}—we'll arrange a ${formatLabel} with someone from our team${
            knownAddress ? ` for ${knownAddress}` : ""
          }. What day and time works best for you?`;
        } else if (!meetingFormat && !alreadyBookedTime) {
          aiReply = `Awesome, ${firstName}! Would you prefer a quick phone call, an in-person tour, or a Google Meet / Zoom call with someone from our team, and what day/time works best?`;
        } else if (!meetingFormat && alreadyBookedTime) {
          aiReply = `Got that time noted, ${firstName}! Would you prefer a quick phone call, an in-person walkthrough, or a Google Meet / Zoom call with someone from our team?`;
        } else {
          aiReply = `You're all set, ${firstName}! Someone from our team has your ${formatLabel} confirmed${
            knownAddress ? ` for ${knownAddress}` : ""
          } and will follow up shortly.`;
        }
      }

      if (aiReply === lastAssistantMsg) {
        aiReply = `You're all set, ${firstName}! Someone from our team has your updated notes${
          knownAddress ? ` for ${knownAddress}` : ""
        } and will be in touch shortly.`;
      }
    }

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

    const baseHistory = Array.isArray(history) ? [...history] : [];
    const lastItem = baseHistory[baseHistory.length - 1];
    if (
      !lastItem ||
      lastItem.role !== "user" ||
      String(lastItem.content || "").trim() !== String(message).trim()
    ) {
      baseHistory.push({
        role: "user",
        content: message,
        timestamp: new Date().toISOString(),
      });
    }

    const updatedHistory = [
      ...baseHistory,
      { role: "assistant", content: aiReply, timestamp: new Date().toISOString() },
    ];

    const summaryNote = `${roleTag} (${score}% qualified)${
      knownAddress ? ` • ${knownAddress}` : ""
    }${meetingFormat ? ` • ${meetingFormat}` : ""} • Latest: "${message.slice(0, 70)}"`;

    await supabase
      .from("leads")
      .update({
        tag: roleTag !== "Unclassified" ? roleTag : lead?.tag,
        qualification_score: score,
        intent_score: score,
        status: nextStatus,
        qualification_data: {
          ...(lead?.qualification_data || {}),
          ...(roleTag !== "Unclassified" ? { asset_type: roleTag } : {}),
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
      conversation_history: updatedHistory,
      lenderRouted: needsLenderWarmTransfer,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "AI Concierge error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}