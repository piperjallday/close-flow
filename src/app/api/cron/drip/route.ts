import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

interface DripStep {
  day: number;
  channel: "SMS" | "Email";
  delay_label: string;
  message: string;
}

export async function GET(request: Request) {
  try {
    // Verify Vercel Cron authorization header if CRON_SECRET is configured
    const authHeader = request.headers.get("authorization");
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 1. Load all active workflows that have multi-step sequences
    const { data: workflows, error: wfError } = await supabase
      .from("workflows")
      .select("id, tenant_id, title, trigger_stage, steps, triggers_count")
      .eq("status", "Active");

    if (wfError || !workflows || workflows.length === 0) {
      return NextResponse.json({ processed: 0, message: "No active workflows." });
    }

    let dispatchedCount = 0;

    for (const wf of workflows) {
      const steps: DripStep[] = Array.isArray(wf.steps) ? wf.steps : [];
      if (steps.length <= 1) continue; // Step 1 (Day 0) fires immediately on trigger

      // 2. Load tenant workspace info for SMS sender & branding
      const { data: tenant } = await supabase
        .from("tenants")
        .select("name, twilio_phone_number")
        .eq("id", wf.tenant_id)
        .single();

      const workspaceName = tenant?.name || "CloseFlow Real Estate";

      // 3. Fetch all logs for this workflow to determine which step each lead is on
      const { data: logs } = await supabase
        .from("workflow_logs")
        .select("lead_id, lead_name, step_index, created_at")
        .eq("workflow_id", wf.id)
        .not("lead_id", "is", null)
        .order("created_at", { ascending: true });

      if (!logs || logs.length === 0) continue;

      // Group logs by lead_id
      const leadProgress = new Map<
        string,
        { enrolledAt: number; maxStepSent: number; leadName: string }
      >();

      for (const log of logs) {
        if (!log.lead_id) continue;
        const existing = leadProgress.get(log.lead_id);
        const logTime = new Date(log.created_at).getTime();

        if (!existing) {
          leadProgress.set(log.lead_id, {
            enrolledAt: logTime,
            maxStepSent: Number(log.step_index || 1),
            leadName: log.lead_name || "Prospect",
          });
        } else {
          existing.enrolledAt = Math.min(existing.enrolledAt, logTime);
          existing.maxStepSent = Math.max(
            existing.maxStepSent,
            Number(log.step_index || 1)
          );
        }
      }

      // 4. Evaluate each enrolled lead for due follow-up steps
      for (const [leadId, progress] of leadProgress.entries()) {
        const nextStepIndex = progress.maxStepSent + 1; // 1-based index
        if (nextStepIndex > steps.length) continue; // Sequence complete

        const nextStep = steps[nextStepIndex - 1];
        const dueAt =
          progress.enrolledAt + Number(nextStep.day || 0) * 24 * 60 * 60 * 1000;

        if (Date.now() < dueAt) continue; // Not due yet

        // Fetch lead contact info & verify they haven't moved to Closed Deals
        const { data: lead } = await supabase
          .from("leads")
          .select("id, full_name, email, phone, status")
          .eq("id", leadId)
          .single();

        if (!lead || lead.status === "Closed Deals") continue;

        const firstName = (lead.full_name || progress.leadName || "there").split(" ")[0];
        const renderedMessage = nextStep.message
          .replace(/\{\{first_name\}\}/gi, firstName)
          .replace(/\{\{workspace_name\}\}/gi, workspaceName);

        let deliveryStatus = "scheduled_dispatched";
        const cleanPhone = String(lead.phone || "").trim();

        // Dispatch SMS via Twilio if configured
        if (
          nextStep.channel === "SMS" &&
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
        } else if (nextStep.channel === "Email" && lead.email && process.env.RESEND_API_KEY) {
          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: `${workspaceName} <onboarding@resend.dev>`,
              to: [lead.email],
              subject: `Quick follow-up from ${workspaceName}`,
              text: renderedMessage,
            }),
          });
          deliveryStatus = emailRes.ok ? "sent_email" : "email_failed";
        }

        // Record step in workflow_logs so it is never duplicated
        await supabase.from("workflow_logs").insert([
          {
            tenant_id: wf.tenant_id,
            workflow_id: wf.id,
            lead_id: lead.id,
            lead_name: lead.full_name || progress.leadName,
            step_index: nextStepIndex,
            channel: nextStep.channel,
            message_sent: renderedMessage,
            status: deliveryStatus,
          },
        ]);

        dispatchedCount++;
      }

      if (dispatchedCount > 0) {
        await supabase
          .from("workflows")
          .update({ triggers_count: Number(wf.triggers_count || 0) + dispatchedCount })
          .eq("id", wf.id);
      }
    }

    return NextResponse.json({
      success: true,
      dispatched: dispatchedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Cron drip execution error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}