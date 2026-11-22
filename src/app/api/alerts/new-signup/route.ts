import { NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(req: Request) {
  try {
    const { userEmail, workspaceName, selectedPlan } = await req.json();
    const resendKey = process.env.RESEND_API_KEY;
    const founderEmail = process.env.FOUNDER_ALERT_EMAIL;

    if (!resendKey || resendKey.includes("placeholder") || !founderEmail) {
      return NextResponse.json({
        alerted: false,
        message:
          "Add RESEND_API_KEY and FOUNDER_ALERT_EMAIL in .env.local to receive instant signup alerts.",
      });
    }

    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: "CloseFlow Alerts <onboarding@resend.dev>",
      to: founderEmail,
      subject: `🚀 New CloseFlow Signup: ${workspaceName || userEmail}`,
      html: `
        <div style="font-family:sans-serif;background:#111315;color:#ffffff;padding:28px;border-radius:12px;max-width:480px;">
          <h2 style="margin-top:0;color:#22c55e;">New CloseFlow Workspace Created</h2>
          <p style="color:#d1d5db;font-size:14px;line-height:1.6;">
            <strong>User:</strong> ${userEmail}<br/>
            <strong>Workspace:</strong> ${workspaceName || "New Workspace"}<br/>
            <strong>Selected Tier:</strong> ${selectedPlan || "14-Day Free Trial"}
          </p>
        </div>
      `,
    });

    return NextResponse.json({ alerted: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to send signup alert" },
      { status: 500 }
    );
  }
}