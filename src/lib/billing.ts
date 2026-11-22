export async function startSubscriptionCheckout({
  plan,
  tenantId,
}: {
  plan: "agent" | "team" | "brokerage" | "clearclose_ai";
  tenantId: string;
}) {
  // 1. Google Play Store Android App (Trusted Web Activity)
  if (typeof window !== "undefined" && "getDigitalGoodsService" in window) {
    try {
      const service = await (window as any).getDigitalGoodsService(
        "https://play.google.com/billing"
      );

      if (service) {
        const playSkuMap: Record<string, string> = {
          agent: "closeflow_agent_monthly",
          team: "closeflow_team_monthly",
          brokerage: "closeflow_brokerage_monthly",
          clearclose_ai: "closeflow_clearclose_ai_monthly",
        };

        const sku = playSkuMap[plan];
        const paymentMethods = [
          {
            supportedMethods: "https://play.google.com/billing",
            data: { sku },
          },
        ];

        const paymentRequest = new PaymentRequest(paymentMethods, {
          total: {
            label: `CloseFlow ${plan.toUpperCase()}`,
            amount: { currency: "USD", value: "0.00" },
          },
        });

        const paymentResponse = await paymentRequest.show();
        const { purchaseToken } = paymentResponse.details;

        const verifyRes = await fetch("/api/billing/google-play/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ purchaseToken, sku, plan, tenantId }),
        });

        if (verifyRes.ok) {
          await paymentResponse.complete("success");
          return { provider: "google_play", success: true };
        } else {
          await paymentResponse.complete("fail");
          throw new Error("Google Play purchase verification failed.");
        }
      }
    } catch (err) {
      console.warn("Google Play Billing unavailable, falling back to Stripe:", err);
    }
  }

  // 2. Standard Web Browser -> Stripe Checkout
  const res = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, tenantId }),
  });

  return res.json();
}