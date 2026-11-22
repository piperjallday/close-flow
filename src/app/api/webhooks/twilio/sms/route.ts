import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runAiConcierge, ConciergeMessage } from "../../../../../lib/concierge";

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function twimlResponse(message: string) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`;
  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const fromPhone = String(formData.get("From") || "").trim();
    const toPhone = String(formData.get("To") || "").trim();
    const incomingBody = String(formData.get("Body") || "").trim();

    if (!fromPhone || !incomingBody) {
      return twimlResponse("Thanks for messaging CloseFlow. How can our team assist with your property search?");
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Resolve tenant by Twilio number (fallback to primary unlimited/founder workspace)
    let { data: tenant } = await supabase
      .from("tenants")
      .select("id, name, alert_phone, alert_email")
      .eq("twilio_phone_number", toPhone)
      .single();

    if (!tenant) {
      const { data: defaultTenant } = await supabase
        .from("tenants")
        .select("id, name, alert_phone, alert_email")
        .order("is_unlimited", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1)
        .single();
      tenant = defaultTenant;
    }

    if (!tenant) {
      return twimlResponse("Thank you for reaching out! A commercial advisor will follow up shortly.");
    }

    // 2. Find or create lead by phone number inside this tenant
    let { data: lead } = await supabase
      .from("leads")
      .select("*")
      .eq("tenant_id", tenant.id)
      .eq("phone", fromPhone)
      .single();

    const now = new Date().toISOString();
    const existingHistory: ConciergeMessage[] = Array.isArray(lead?.conversation_history)
      ? lead.conversation_history
      : [];

    const updatedHistory: ConciergeMessage[] = [
      ...existingHistory,
      { role: "user", content: incomingBody, timestamp: now },
    ];

    if (!lead) {
      const { data: createdLead } = await supabase
        .from("leads")
        .insert([
          {
            tenant_id: tenant.id,
            name: `SMS Lead (${fromPhone})`,
            phone: fromPhone,
            source: "AI Concierge SMS",
            status: "qualifying",
            qualification_score: 15,
            conversation_history: updatedHistory,
            last_contacted_at: now,
          },
        ])
        .select()
        .single();
      lead = createdLead;
    }

    // 3. Fetch active listings summary for property-aware answers
    const { data: listings } = await supabase
      .from("listings")
      .select("title, address, price, property_type")
      .eq("tenant_id", tenant.id)
      .limit(5);

    const listingsContext = (listings || [])
      .map((l) => `${l.title || l.address} (${l.property_type || "Commercial"} - $${l.price || "Call"})`)
      .join("; ");

    // 4. Run AI Concierge qualification
    const result = await runAiConcierge({
      workspaceName: tenant.name || "CloseFlow Real Estate",
      leadName: lead?.name?.startsWith("SMS Lead") ? "there" : lead?.name || "there",
      history: updatedHistory,
      existingData: lead?.qualification_data || {},
      listingsContext,
    });

    const finalHistory: ConciergeMessage[] = [
      ...updatedHistory,
      { role: "assistant", content: result.reply, timestamp: new Date().toISOString() },
    ];

    const previouslyQualified = (lead?.qualification_score || 0) >= 75;

    // 5. Persist updated score, structured profile, and thread
    if (lead?.id) {
      await supabase
        .from("leads")
        .update({
          status: result.status,
          qualification_score: result.score,
          qualification_data: result.qualificationData,
          conversation_history: finalHistory,
          notes: result.qualificationData.summary || lead.notes,
          last_contacted_at: new Date().toISOString(),
        })
        .eq("id", lead.id);
    }

    // 6. Send instant broker alert when lead crosses 75+ readiness threshold
    if (result.shouldAlertBroker && !previouslyQualified && tenant.alert_phone) {
      const twilioSid = process.env.TWILIO_ACCOUNT_SID;
      const twilioToken = process.env.TWILIO_AUTH_TOKEN;
      if (twilioSid && twilioToken && toPhone) {
        const alertText = `🔥 Qualified Lead (${result.score}/100) in ${tenant.name}: ${fromPhone} — ${result.qualificationData.summary || incomingBody}`;
        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: tenant.alert_phone,
            From: toPhone,
            Body: alertText,
          }),
        });
      }
    }

    return twimlResponse(result.reply);
  } catch (error) {
    console.error("AI Concierge webhook error:", error);
    return twimlResponse("Thanks for contacting us! Our commercial team received your note and will reply shortly.");
  }
}