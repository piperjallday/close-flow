import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runAiConcierge, ConciergeMessage } from "../../../lib/concierge";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      tenantId,
      listingId,
      fullName,
      email,
      phone,
      sourceType = "Property Capture",
      propertyAddress = "",
      estimatedValue = 0,
      inquiryNotes = "",
    } = body;

    if (!tenantId || !fullName?.trim()) {
      return NextResponse.json(
        { error: "Workspace ID and full name are required." },
        { status: 400 }
      );
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Fetch workspace branding & Twilio config
    const { data: tenant } = await adminSupabase
      .from("tenants")
      .select("id, name, twilio_phone_number, ai_opening_script")
      .eq("id", tenantId)
      .single();

    if (!tenant) {
      return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
    }

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

    // 2. Generate personalized AI Concierge greeting & initial score
    const concierge = await runAiConcierge({
      workspaceName: tenant.name || "CloseFlow Commercial",
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

    // 3. Insert lead into the tenant's Kanban pipeline
    const { data: createdLead, error: leadError } = await adminSupabase
      .from("leads")
      .insert([
        {
          tenant_id: tenant.id,
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

    // 4. Send automated SMS greeting if phone + Twilio configured
    const cleanPhone = String(phone || "").trim();
    if (
      cleanPhone &&
      tenant.twilio_phone_number &&
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

    // 5. Increment active workflow trigger counters for this tenant
    const { data: activeWorkflows } = await adminSupabase
      .from("workflows")
      .select("id, triggers_count")
      .eq("tenant_id", tenant.id)
      .eq("status", "Active");

    if (activeWorkflows && activeWorkflows.length > 0) {
      await Promise.all(
        activeWorkflows.map((wf) =>
          adminSupabase
            .from("workflows")
            .update({ triggers_count: Number(wf.triggers_count || 0) + 1 })
            .eq("id", wf.id)
        )
      );
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