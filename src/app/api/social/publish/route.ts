import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const {
      tenantId,
      listingId,
      platform,
      caption,
      videoScript,
      captureUrl,
      mediaUrl,
      scheduledFor,
    } = await request.json();

    if (!tenantId || !platform || !caption) {
      return NextResponse.json(
        { error: "tenantId, platform, and caption are required." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: tenant } = await supabase
      .from("tenants")
      .select("social_webhook_url, meta_page_id, meta_access_token, linkedin_access_token")
      .eq("id", tenantId)
      .single();

    let deliveryMode = "logged_ready";
    let apiDetail = "Saved to Social Queue & copied for instant posting.";

    // 1. Direct Facebook Page API publish if configured
    if (
      platform === "facebook" &&
      tenant?.meta_page_id &&
      tenant?.meta_access_token &&
      !scheduledFor
    ) {
      const fbRes = await fetch(
        `https://graph.facebook.com/v20.0/${tenant.meta_page_id}/feed`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: caption,
            link: captureUrl,
            access_token: tenant.meta_access_token,
          }),
        }
      );
      if (fbRes.ok) {
        deliveryMode = "published_direct";
        apiDetail = "Published directly to your connected Facebook Page!";
      }
    }

    // 2. Direct Instagram Business Graph API publish (requires image URL)
    if (
      platform === "instagram" &&
      tenant?.meta_page_id &&
      tenant?.meta_access_token &&
      mediaUrl &&
      !scheduledFor
    ) {
      const containerRes = await fetch(
        `https://graph.facebook.com/v20.0/${tenant.meta_page_id}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_url: mediaUrl,
            caption,
            access_token: tenant.meta_access_token,
          }),
        }
      );
      const containerData = await containerRes.json();
      if (containerData?.id) {
        const pubRes = await fetch(
          `https://graph.facebook.com/v20.0/${tenant.meta_page_id}/media_publish`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              creation_id: containerData.id,
              access_token: tenant.meta_access_token,
            }),
          }
        );
        if (pubRes.ok) {
          deliveryMode = "published_direct";
          apiDetail = "Published directly to your connected Instagram Business account!";
        }
      }
    }

    // 3. Universal Make / Zapier / Buffer Webhook Dispatch (supports FB, IG, LinkedIn, YouTube, TikTok)
    if (tenant?.social_webhook_url) {
      const hookRes = await fetch(tenant.social_webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          caption,
          video_script: videoScript || null,
          capture_url: captureUrl,
          media_url: mediaUrl || null,
          scheduled_for: scheduledFor || new Date().toISOString(),
        }),
      });
      if (hookRes.ok) {
        deliveryMode = scheduledFor ? "scheduled_webhook" : "published_webhook";
        apiDetail = scheduledFor
          ? `Scheduled for ${new Date(scheduledFor).toLocaleString()} via your Social Autoposter webhook!`
          : `Dispatched to ${platform.toUpperCase()} via your Social Autoposter webhook!`;
      }
    }

    const { data: savedPost } = await supabase
      .from("social_posts")
      .insert([
        {
          tenant_id: tenantId,
          listing_id: listingId || null,
          platform,
          caption,
          video_script: videoScript || null,
          capture_url: captureUrl || null,
          media_url: mediaUrl || null,
          status: deliveryMode,
          scheduled_for: scheduledFor || null,
        },
      ])
      .select()
      .single();

    return NextResponse.json({
      success: true,
      mode: deliveryMode,
      message: apiDetail,
      post: savedPost,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to publish post";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}