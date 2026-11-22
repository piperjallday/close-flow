import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runAiConcierge, ConciergeMessage } from "../../../lib/concierge";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      tenantId: rawTenantId,
      listingId,
      fullName,
      email,
      phone,
      sourceType = "Property Capture",
      propertyAddress = "",
      estimatedValue = 0,
      inquiryNotes = "",
    } = body;

    if (!fullName?.trim()) {
      return NextResponse.json(
        { error: "Full name is required." },
        { status: 400 }
      );
    }

    if (!email?.trim() && !phone?.trim()) {
      return NextResponse.json(
        { error: "Please provide either an email address or phone number." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Database configuration missing in environment variables." },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    let resolvedTenantId = String(rawTenantId || "").trim();

    if (!resolvedTenantId && listingId) {
      const { data: listingRow } = await supabase
        .from("listings")
        .select("tenant_id")
        .eq("id", listingId)
        .single();
      if (listingRow?.tenant_id) {
        resolvedTenantId = listingRow.tenant_id;
      }
    }

    if (!resolvedTenantId) {
      const { data: primaryTenant } = await supabase
        .from("tenants")
        .select("id")
        .order("is_unlimited", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1)
        .single();
      if (primaryTenant?.id) {
        resolvedTenantId = primaryTenant.id;
      }
    }

    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, name, twilio_phone_number, ai_opening_script")
      .eq("id", resolvedTenantId)
      .single();

    const workspaceName = tenant?.name || "CloseFlow Real Estate";
    const targetTenantId = tenant?.id || resolvedTenantId || null;
    const firstName = fullName.trim().split(" ")[0];

    const now = new Date().toISOString();
    const initialContext = propertyAddress
      ? `Inquired about ${propertyAddress}${inquiryNotes ? ` — "${inquiryNotes}"` : ""}`
      : inquiryNotes || `Submitted ${sourceType} landing page`;

    const initialHistory: ConciergeMessage[] = [
      {
        role: "user",
        content: initialContext,
        timestamp: now,
      },
    ];

    const timelineMatch = inquiryNotes.match(
      /(Immediately|Within 3 months|3[–-]6 months|Just exploring value|ASAP \(Under 30 days\)|Within 30[–-]60 days|Just browsing)/i
    );

    const concierge = await runAiConcierge({
      workspaceName,
      leadName: firstName,
      history: initialHistory,
      sourceType,
      existingData: {
        asset_type: sourceType === "Valuation Funnel" ? "Seller" : "Buyer",
        location: propertyAddress || undefined,
        timeline: timelineMatch ? timelineMatch[0] : undefined,
        summary: initialContext,
      },
      listingsContext: propertyAddress,
    });

    const fullHistory: ConciergeMessage[] = [
      ...initialHistory,
      {
        role: "assistant",
        content: concierge.reply,
        timestamp: new Date().toISOString(),
      },
    ];

    const initialStage = concierge.score >= 80 ? "Property Tours" : "New Leads";

    const { data: createdLead, error: leadError } = await supabase
      .from("leads")
      .insert([
        {
          ...(targetTenantId ? { tenant_id: targetTenantId } : {}),
          full_name: fullName.trim(),
          email: email?.trim() || null,
          phone: phone?.trim() || null,
          estimated_value: Number(estimatedValue) || 0,
          status: initialStage,
          tag: sourceType === "Valuation Funnel" ? "Seller / Valuation" : "Property Inquiry",
          lead_source: sourceType,
          qualification_score: concierge.score,
          intent_score: concierge.score,
          qualification_data: concierge.qualificationData,
          conversation_history: fullHistory,
          notes: concierge.qualificationData.summary || initialContext,
          last_contacted_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (leadError) {
      return NextResponse.json({ error: leadError.message }, { status: 400 });
    }

    const cleanPhone = String(phone || "").trim();
    const cleanEmail = String(email || "").trim();

    // 1. Instant SMS Speed-to-Lead via Twilio
    if (
      cleanPhone &&
      tenant?.twilio_phone_number &&
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN
    ) {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const token = process.env.TWILIO_AUTH_TOKEN;
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: cleanPhone,
          From: tenant.twilio_phone_number,
          Body: concierge.reply,
        }),
      }).catch((err) => console.error("Twilio outbound welcome failed:", err));
    }

    // 2. Instant Email Speed-to-Lead via Resend
    if (cleanEmail && process.env.RESEND_API_KEY) {
      const subject = propertyAddress
        ? `Info & Showing Times for ${propertyAddress}`
        : `Your ${workspaceName} Request`;
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from:
            process.env.RESEND_FROM_EMAIL ||
            `${workspaceName} <onboarding@resend.dev>`,
          to: [cleanEmail],
          subject,
          html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;color:#111827;line-height:1.6;">
            <p>${concierge.reply}</p>
            <p style="font-size:12px;color:#6b7280;margin-top:20px;">— ${workspaceName} Concierge</p>
          </div>`,
        }),
      }).catch((err) => console.error("Resend welcome email failed:", err));
    }

    // 3. Fire matching "New Leads" workflows & record real execution logs
    if (targetTenantId && createdLead?.id) {
      const { data: stageWorkflows } = await supabase
        .from("workflows")
        .select("*")
        .eq("tenant_id", targetTenantId)
        .eq("status", "Active")
        .eq("trigger_stage", "New Leads");

      if (stageWorkflows && stageWorkflows.length > 0) {
        for (const wf of stageWorkflows) {
          const stepOne = Array.isArray(wf.steps) && wf.steps.length > 0
            ? wf.steps[0]
            : {
                channel: cleanPhone ? "SMS" : "Email",
                message: `Hi ${firstName}, thanks for reaching out to ${workspaceName}!`,
              };

          const renderedMsg = String(stepOne.message || "")
            .replace(/\{\{first_name\}\}/gi, firstName)
            .replace(/\{\{workspace_name\}\}/gi, workspaceName);

          await Promise.all([
            supabase.from("workflow_logs").insert([
              {
                tenant_id: targetTenantId,
                workflow_id: wf.id,
                lead_id: createdLead.id,
                lead_name: createdLead.full_name,
                step_index: 1,
                channel: stepOne.channel || (cleanPhone ? "SMS" : "Email"),
                message_sent: renderedMsg,
                status: "Auto-Triggered on Capture",
              },
            ]),
            supabase
              .from("workflows")
              .update({ triggers_count: Number(wf.triggers_count || 0) + 1 })
              .eq("id", wf.id),
          ]);
        }
      }
    }

    return NextResponse.json({
      success: true,
      leadId: createdLead?.id,
      conciergeReply: concierge.reply,
      qualificationScore: concierge.score,
      stage: initialStage,
      listingId: listingId || null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to submit capture form";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}