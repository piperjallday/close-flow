export interface ConciergeMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface QualificationProfile {
  asset_type?: string;
  location?: string;
  budget?: string;
  timeline?: string;
  financing_status?: string;
  is_decision_maker?: boolean;
  summary?: string;
}

export interface ConciergeResult {
  reply: string;
  score: number;
  status: "new" | "qualifying" | "qualified";
  qualificationData: QualificationProfile;
  shouldAlertBroker: boolean;
}

const SYSTEM_PROMPT = `You are the CloseFlow AI Real Estate Concierge for a residential and commercial brokerage.
Your job is to respond promptly, warmly, and in plain, everyday English (never use confusing jargon like "submarket" or "asset class"). Keep replies concise (2-3 short sentences max).

Follow this exact sequence:
1. FIRST, confirm any property address the lead already submitted.
2. SECOND, confirm whether they are looking to SELL only, BUY only, or BOTH (sell their current home and buy their next one):
   - If they submitted a Property Valuation request, acknowledge that they are exploring selling the entered address and ask if they are only looking to sell or also planning to buy their next home.
   - If they inquired about a specific listing for sale, confirm that property address and ask if they'd like to schedule a tour or if they also have a home to sell first.
   - If neither is known yet, ask simply: "Are you looking to buy a home, sell your current property, or both?"
3. THIRD, ask tailored follow-up questions ONE AT A TIME based on their answer (never re-ask for an address, timeline, or pre-approval they already gave):
   - For Sellers: confirm target selling timeline and offer a quick 15-minute pricing/CMA call.
   - For Buyers: confirm target move timeframe, pre-approval/financing status, and preferred tour day/time.

Respond ONLY in valid JSON matching this schema:
{
  "reply": "Your concise, friendly response to the lead",
  "score": 0-100,
  "qualificationData": {
    "asset_type": "Buyer | Seller | Buyer + Seller | null",
    "location": "string or null",
    "budget": "string or null",
    "timeline": "string or null",
    "financing_status": "string or null",
    "is_decision_maker": true/false/null,
    "summary": "1-sentence agent brief"
  }
}`;

export async function runAiConcierge(params: {
  workspaceName: string;
  leadName: string;
  history: ConciergeMessage[];
  existingData?: QualificationProfile;
  listingsContext?: string;
  sourceType?: string;
}): Promise<ConciergeResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const firstName = params.leadName || "there";
  const knownAddress =
    params.existingData?.location || params.listingsContext || "";
  const isValuation =
    params.sourceType === "Valuation Funnel" ||
    /valuation/i.test(params.existingData?.summary || "");
  const isPropertyInquiry =
    params.sourceType === "Property Capture" ||
    (!isValuation && Boolean(knownAddress));

  if (!apiKey) {
    const turnCount = params.history.filter((m) => m.role === "user").length;
    const baseScore = isValuation || isPropertyInquiry ? 55 : 30;
    const score = Math.min(baseScore + (turnCount - 1) * 20, 90);

    let reply = "";

    if (turnCount <= 1) {
      if (isValuation && knownAddress) {
        reply = `Hi ${firstName}! Thanks for requesting a home valuation for ${knownAddress} with ${params.workspaceName}. Just to confirm we have the right address—are you looking to just sell ${knownAddress}, or are you planning to buy your next home as well?`;
      } else if (isPropertyInquiry && knownAddress) {
        reply = `Hi ${firstName}! Thanks for reaching out to ${params.workspaceName} about ${knownAddress}. Would you like to schedule a private tour of this home, or are you also looking to sell a current property first?`;
      } else {
        reply = `Hi ${firstName}! Thanks for reaching out to ${params.workspaceName}. To point you in the right direction—are you looking to buy a home, sell your current property, or both?`;
      }
    } else {
      const fallbackReplies = [
        `Got it, ${firstName}! What is your ideal timeline for making this move?`,
        `Makes sense. Have you already been pre-approved with a lender (or paying cash), or would you like an intro to our trusted local lender?`,
        `Perfect, ${firstName}—I have everything needed to brief our advisor right away. What day and time works best for a quick 15-minute call or tour?`,
      ];
      reply =
        fallbackReplies[Math.min(turnCount - 2, fallbackReplies.length - 1)];
    }

    const detectedRole = isValuation
      ? "Seller"
      : isPropertyInquiry
      ? "Buyer"
      : params.existingData?.asset_type;

    return {
      reply,
      score,
      status: score >= 75 ? "qualified" : "qualifying",
      qualificationData: {
        ...(params.existingData || {}),
        ...(detectedRole ? { asset_type: detectedRole } : {}),
        ...(knownAddress ? { location: knownAddress } : {}),
      },
      shouldAlertBroker: score >= 75,
    };
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${SYSTEM_PROMPT}\n\nBrokerage: ${params.workspaceName}\nLead Name: ${firstName}\nLead Source: ${params.sourceType || "Direct"}\nEntered Property Address: ${knownAddress || "None yet"}\nKnown Details: ${JSON.stringify(params.existingData || {})}`,
        },
        ...params.history.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI Concierge upstream error: ${response.status}`);
  }

  const raw = await response.json();
  const parsed = JSON.parse(raw.choices[0].message.content || "{}");
  const score = Math.max(0, Math.min(100, Number(parsed.score) || 35));

  return {
    reply:
      parsed.reply ||
      (knownAddress
        ? `Hi ${firstName}! Thanks for reaching out to ${params.workspaceName} about ${knownAddress}. Are you looking to buy, sell, or both?`
        : `Hi ${firstName}! Thanks for reaching out to ${params.workspaceName}. Are you looking to buy a home, sell your current property, or both?`),
    score,
    status: score >= 75 ? "qualified" : "qualifying",
    qualificationData: {
      ...(params.existingData || {}),
      ...(parsed.qualificationData || {}),
      ...(knownAddress ? { location: knownAddress } : {}),
    },
    shouldAlertBroker: score >= 75,
  };
}