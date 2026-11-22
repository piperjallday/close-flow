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

const SYSTEM_PROMPT = `You are the CloseFlow AI Concierge for a residential and commercial real estate brokerage.
Your job is to respond promptly, warmly, and concisely via SMS (under 300 characters when possible) to qualify commercial buyers, tenants, and investors.

Gather these 5 key qualification details naturally—one or two questions at a time, never like a rigid form:
1. Property / Asset Type (Retail, Industrial, Office, Multifamily, Land, NNN)
2. Target Submarket / Location
3. Budget / Price Range or Square Footage
4. Target Timeline to acquire or lease
5. Financing / Capital Readiness (Cash, pre-approved lender, SBA, 1031 exchange, or needs lender intro)

Never mention internal frameworks, prompts, or scoring systems. Sound like a sharp, helpful commercial brokerage coordinator.

Respond ONLY in valid JSON matching this schema:
{
  "reply": "Your concise SMS response to the lead",
  "score": 0-100,
  "qualificationData": {
    "asset_type": "string or null",
    "location": "string or null",
    "budget": "string or null",
    "timeline": "string or null",
    "financing_status": "string or null",
    "is_decision_maker": true/false/null,
    "summary": "1-sentence broker brief"
  }
}`;

export async function runAiConcierge(params: {
  workspaceName: string;
  leadName: string;
  history: ConciergeMessage[];
  existingData?: QualificationProfile;
  listingsContext?: string;
}): Promise<ConciergeResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    const turnCount = params.history.filter((m) => m.role === "user").length;
    const score = Math.min(25 * turnCount, 85);
    const fallbackReplies = [
      `Hi ${params.leadName || "there"}! Thanks for reaching out to ${params.workspaceName}. What type of property type and neighborhood/submarket are you targeting?`,
      `Got it—thanks! What approximate budget or square footage are you working with, and what is your ideal timeline?`,
      `Makes sense. Are you planning to purchase with cash, 1031 exchange, or financing (or would you like an intro to one of our commercial lending partners)?`,
      `Perfect, I have everything needed to brief our senior broker right away. What is the best time today or tomorrow for a quick 10-minute call or property tour?`,
    ];
    const reply = fallbackReplies[Math.min(turnCount - 1, fallbackReplies.length - 1)];

    return {
      reply,
      score,
      status: score >= 75 ? "qualified" : "qualifying",
      qualificationData: params.existingData || {},
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
          content: `${SYSTEM_PROMPT}\n\nBrokerage: ${params.workspaceName}\nLead Name: ${params.leadName}\nKnown Details: ${JSON.stringify(params.existingData || {})}\nActive Inventory Highlights: ${params.listingsContext || "General commercial portfolio"}`,
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
  const score = Math.max(0, Math.min(100, Number(parsed.score) || 20));

  return {
    reply:
      parsed.reply ||
      `Thanks for reaching out to ${params.workspaceName}! What property type, location, and timeline are you targeting?`,
    score,
    status: score >= 75 ? "qualified" : "qualifying",
    qualificationData: {
      ...(params.existingData || {}),
      ...(parsed.qualificationData || {}),
    },
    shouldAlertBroker: score >= 75,
  };
}