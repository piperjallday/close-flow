import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const {
      tenantId,
      fullName,
      email,
      phone,
      sourceType, // 'property_page' | 'home_valuation'
      sourceLabel,
      estimatedValue,
      addressInput,
    } = await req.json();

    if (!tenantId || !fullName || (!email && !phone)) {
      return NextResponse.json(
        { error: "Name and either email or phone are required." },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch workspace custom AI opening script
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("name, ai_opening_script")
      .eq("id", tenantId)
      .single();

    const initialScore = sourceType === "home_valuation" ? 50 : 60;
    const tag = sourceType === "home_valuation" ? "Seller Lead" : "Buyer Lead";

    const { data: lead, error } = await supabaseAdmin
      .from("leads")
      .insert([
        {
          tenant_id: tenantId,
          full_name: fullName.trim(),
          email: email?.trim() || null,
          phone: phone?.trim() || null,
          tag,
          status: "New Leads",
          estimated_value: Number(estimatedValue) || 450000,
          intent_score: initialScore,
          lead_source: sourceLabel || "Public Landing Page",
          lpmama_data: {
            location: addressInput || sourceLabel || "",
            price: estimatedValue ? `$${Number(estimatedValue).toLocaleString()}` : "",
            mortgage: "",
            agent_status: "",
            motivation: "",
            appointment: "",
            qualified: false,
          },
        },
      ])
      .select()
      .single();

    if (error || !lead) {
      return NextResponse.json(
        { error: error?.message || "Failed to capture lead" },
        { status: 500 }
      );
    }

    // Personalize opening SMS/AI hook
    const firstName = fullName.trim().split(" ")[0];
    const rawScript =
      tenant?.ai_opening_script ||
      "Hi {{first_name}}, thanks for checking out {{source_label}}! Are you looking to make a move in the next 3-6 months?";

    const openingMessage = rawScript
      .replace(/\{\{first_name\}\}/gi, firstName)
      .replace(/\{\{source_label\}\}/gi, sourceLabel || "our property report");

    await supabaseAdmin.from("lead_events").insert([
      {
        tenant_id: tenantId,
        lead_id: lead.id,
        event_type: "lead_captured",
        points_delta: initialScore,
        message_sender: "ai",
        message_text: openingMessage,
      },
    ]);

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      openingMessage,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Unexpected error" },
      { status: 500 }
    );
  }
}