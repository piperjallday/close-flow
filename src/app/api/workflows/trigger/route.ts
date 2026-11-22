import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export interface DripStep {
  day: number;
  channel: "SMS" | "Email";
  delay_label: string;
  message: string;
}

export async function POST(request: Request) {
  try {
    const { tenantId, leadId, stage, workflowId } = await request.json();

    if (!tenantId) {
      return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, name, twilio_phone_number")
      .eq("id", tenantId)
      .single();

    const workspaceName = tenant?.name || "CloseFlow Real Estate";

    let lead: any = null;
    if (leadId) {
      const { data: leadRow } = await supabase
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .single();
      lead = leadRow;
    }

    let wfQuery = supabase
      .from("workflows")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("status", "Active");

    if (workflowId) {
      wfQuery = wfQuery.eq("id", workflowId);
    } else if (stage) {
      wfQuery = wfQuery.eq("trigger_stage", stage);
    }

    const { data: matchingWorkflows } = await wfQuery;

    if (!matchingWorkflows || matchingWorkflows.length === 0) {
      return NextResponse.json({ triggered: 0, logs: [] });
    }

    const firstName = (lead?.full_name || lead?.name || "there").split(" ")[0];
    const cleanPhone = String(lead?.phone || "").trim();
    const cleanEmail = String(lead?.email || "").trim();
    const createdLogs: any[] = [];

    for (const wf of matchingWorkflows) {
      // Idempotency guard: prevent duplicate fire on same lead+workflow within 10 minutes
      if (lead?.id) {
        const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const { data: recentDup } = await supabase
          .from("workflow_logs")
          .select("id")
          .eq("workflow_id", wf.id)
          .eq("lead_id", lead.id)
          .gte("created_at", tenMinsAgo)
          .limit(1);

        if (recentDup && recentDup.length > 0) {
          continue;
        }
      }

      const steps: DripStep[] =
        Array.isArray(wf.steps) && wf.steps.length > 0
          ? wf.steps
          : [
              {
                day: 0,
                channel: "SMS",
                delay_label: "Instant (0m)",
                message: `Hi ${firstName}, thanks for connecting with ${workspaceName}! How can our team help you today?`,
              },
            ];

      const stepOne = steps[0];
      const renderedMessage = stepOne.message
        .replace(/\{\{first_name\}\}/gi, firstName)
        .replace(/\{\{workspace_name\}\}/gi, workspaceName);

      let deliveryStatus = "simulated_sent";

      if (
        stepOne.channel === "SMS" &&
        cleanPhone &&
        tenant?.twilio_phone_number &&
        process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN
      ) {
        const sid = process.env.TWILIO_ACCOUNT_SID;
        const token = process.env.TWILIO_AUTH_TOKEN;
        const twilioRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: cleanPhone,
              From: tenant.twilio_phone_number,
              Body: renderedMessage,
            }),
          }
        );
        deliveryStatus = twilioRes.ok ? "sent_sms" : "sms_failed";
      } else if (stepOne.channel === "Email" && cleanEmail && process.env.RESEND_API_KEY) {
        const resendRes = await fetch("https://api.resend.com/emails", {
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
            subject: `${wf.title} — ${workspaceName}`,
            html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;color:#111827;line-height:1.6;">
              <p>${renderedMessage}</p>
              <p style="font-size:12px;color:#6b7280;margin-top:20px;">— ${workspaceName}</p>
            </div>`,
          }),
        });
        deliveryStatus = resendRes.ok ? "sent_email" : "email_failed";
      } else if (stepOne.channel === "Email" && cleanEmail) {
        deliveryStatus = "queued_email";
      }

      const { data: logEntry } = await supabase
        .from("workflow_logs")
        .insert([
          {
            tenant_id: tenantId,
            workflow_id: wf.id,
            lead_id: lead?.id || null,
            lead_name: lead?.full_name || lead?.name || "Test Prospect",
            step_index: 1,
            channel: stepOne.channel,
            message_sent: renderedMessage,
            status: deliveryStatus,
          },
        ])
        .select()
        .single();

      if (logEntry) createdLogs.push(logEntry);

      await supabase
        .from("workflows")
        .update({ triggers_count: Number(wf.triggers_count || 0) + 1 })
        .eq("id", wf.id);
    }

    return NextResponse.json({
      triggered: createdLogs.length,
      logs: createdLogs,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to trigger workflow";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}