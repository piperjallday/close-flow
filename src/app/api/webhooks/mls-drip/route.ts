import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Extracts the first US street address from MLS email text/HTML
function extractFirstAddress(rawText: string): string {
  const cleaned = rawText
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");

  const addressRegex =
    /\b\d{1,6}\s+[A-Za-z0-9.\-'\s]{2,40}\b(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Ln|Lane|Ct|Court|Blvd|Boulevard|Way|Pl|Place|Cir|Circle|Ter|Terrace|Pkwy|Parkway)\b(?:,?\s*[A-Za-z\s]{2,25},?\s*[A-Z]{2}(?:\s*\d{5})?)?/i;

  const match = cleaned.match(addressRegex);
  return match ? match[0].trim() : "the first property in your latest home alert";
}

// Extracts UUID from drip+<leadId>@... in To/CC/BCC headers
function extractLeadIdFromInboundAddress(rawHeaders: string): string | null {
  const match = rawHeaders.match(
    /drip\+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})@/i
  );
  return match ? match[1] : null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const allRecipients = [
      body.to,
      body.cc,
      body.bcc,
      body.recipient,
      body.OriginalRecipient,
      JSON.stringify(body.headers || ""),
    ]
      .filter(Boolean)
      .join(" ");

    const taggedLeadId =
      body.leadId || extractLeadIdFromInboundAddress(allRecipients);

    const subject = body.subject || "New Properties Matching Your Search";
    const htmlBody = body.html || body.HtmlBody || "";
    const textBody = body.text || body.TextBody || htmlBody;

    // 1. Look up lead by tagged drip+<leadId>@ address first, or fallback to email
    let lead: any = null;

    if (taggedLeadId) {
      const { data } = await supabaseAdmin
        .from("leads")
        .select("id, tenant_id, full_name, email")
        .eq("id", taggedLeadId)
        .single();
      lead = data;
    }

    if (!lead && body.leadEmail) {
      const { data } = await supabaseAdmin
        .from("leads")
        .select("id, tenant_id, full_name, email")
        .ilike("email", body.leadEmail.trim())
        .limit(1);
      lead = data?.[0] || null;
    }

    if (!lead || !lead.email) {
      return NextResponse.json(
        { error: "Could not match a CloseFlow lead with an email address." },
        { status: 404 }
      );
    }

    const firstAddress = extractFirstAddress(textBody);
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "https://close-flow.vercel.app";

    // 2. Record the drip send & #1 home so open-tracking knows which home to pitch
    const { data: sendRecord, error: insertError } = await supabaseAdmin
      .from("property_drip_sends")
      .insert([
        {
          tenant_id: lead.tenant_id,
          lead_id: lead.id,
          lead_name: lead.full_name || "Prospect",
          lead_email: lead.email,
          featured_listing_address: firstAddress,
        },
      ])
      .select()
      .single();

    if (insertError || !sendRecord) {
      return NextResponse.json(
        { error: insertError?.message || "Failed to log MLS drip" },
        { status: 500 }
      );
    }

    const trackingPixelUrl = `${baseUrl}/api/tracking/open/${sendRecord.id}`;

    // 3. Inject invisible 1x1 open-tracking pixel & relay to the lead
    const wrappedHtml = htmlBody
      ? `${htmlBody}<img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />`
      : `<div style="font-family:Arial,sans-serif;line-height:1.6;"><p>${textBody}</p><img src="${trackingPixelUrl}" width="1" height="1" alt="" /></div>`;

    if (process.env.RESEND_API_KEY) {
      const { data: tenant } = await supabaseAdmin
        .from("tenants")
        .select("name")
        .eq("id", lead.tenant_id)
        .single();

      const senderName = tenant?.name || "Property Alerts";

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from:
            process.env.RESEND_FROM_EMAIL ||
            `${senderName} <onboarding@resend.dev>`,
          to: [lead.email],
          subject,
          html: wrappedHtml,
        }),
      });
    }

    // 4. Mark lead as actively enrolled in MLS Drip & log in workflow_logs
    await Promise.all([
      supabaseAdmin
        .from("leads")
        .update({
          notes: `MLS Drip Active • Latest #1 property sent: ${firstAddress}`,
        })
        .eq("id", lead.id),
      supabaseAdmin.from("workflow_logs").insert([
        {
          tenant_id: lead.tenant_id,
          lead_id: lead.id,
          lead_name: lead.full_name || "Prospect",
          channel: "Email",
          step_index: 1,
          status: "MLS Drip Relayed",
          message_sent: `MLS alert relayed to ${lead.email} • #1 Home: ${firstAddress}`,
        },
      ]),
    ]);

    return NextResponse.json({
      success: true,
      sendId: sendRecord.id,
      leadId: lead.id,
      detectedFirstAddress: firstAddress,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to process inbound MLS drip" },
      { status: 500 }
    );
  }
}