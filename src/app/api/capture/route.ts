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

    // 1. If tenantId wasn't passed, resolve it from the listing record
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

    // 2. Fallback to primary workspace if still empty
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

    const concierge = await runAiConcierge({
      workspaceName,
      leadName: fullName.trim().split(" ")[0],
      history: initialHistory,
      existingData: {
        location: propertyAddress || undefined,
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

    const { data: createdLead, error: leadError } = await supabase
      .from("leads")
      .insert([
        {
          ...(targetTenantId ? { tenant_id: targetTenantId } : {}),
          full_name: fullName.trim(),
          email: email?.trim() || null,
          phone: phone?.trim() || null,
          estimated_value: Number(estimatedValue) || 0,
          status: "New Leads",
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

    if (targetTenantId) {
      const { data: activeWorkflows } = await supabase
        .from("workflows")
        .select("id, triggers_count")
        .eq("tenant_id", targetTenantId)
        .eq("status", "Active");

      if (activeWorkflows && activeWorkflows.length > 0) {
        await Promise.all(
          activeWorkflows.map((wf) =>
            supabase
              .from("workflows")
              .update({ triggers_count: Number(wf.triggers_count || 0) + 1 })
              .eq("id", wf.id)
          )
        );
      }
    }

    return NextResponse.json({
      success: true,
      leadId: createdLead?.id,
      conciergeReply: concierge.reply,
      listingId: listingId || null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to submit capture form";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}