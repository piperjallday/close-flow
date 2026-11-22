import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const {
      address,
      price,
      beds,
      baths,
      sqft,
      tag,
      description,
      captureUrl,
      brokerageName = "CloseFlow Real Estate",
    } = await request.json();

    const formattedPrice = price ? `$${Number(price).toLocaleString()}` : "Contact for Pricing";
    const specsLine = [
      beds ? `${beds} Beds/Units` : null,
      baths ? `${baths} Baths` : null,
      sqft ? `${Number(sqft).toLocaleString()} SqFt` : null,
    ]
      .filter(Boolean)
      .join(" • ");

    const fallbackPack = {
      facebook: `🏡 JUST LISTED | ${address}\n\nOffered at ${formattedPrice}${specsLine ? ` (${specsLine})` : ""}.\n\n${
        description || "Prime opportunity with standout features, flexible layout, and strong local upside."
      }\n\n👉 View full details, photos & schedule a private tour here:\n${captureUrl}\n\nListed by ${brokerageName} #RealEstate #JustListed #PropertyTour #HomeSearch #InvestmentProperty`,
      instagram: `✨ NEW ON THE MARKET ✨\n📍 ${address}\n💰 ${formattedPrice}${specsLine ? `\n📐 ${specsLine}` : ""}\n\n${
        description || "Turnkey opportunity ready for its next owner. Tap the link in bio or comment 'TOUR' for the full property packet!"
      }\n\n🔗 ${captureUrl}\n\n#RealEstate #NewListing #DreamProperty #LuxuryRealEstate #OpenHouse #PropertyInvestment #RealtorLife`,
      linkedin: `New Market Opportunity: ${address} — Offered at ${formattedPrice}.\n\n${
        description ||
        "Strategically positioned property offering strong value and immediate potential for buyers and investors."
      }${specsLine ? `\n\nKey Highlights: ${specsLine}` : ""}\n\nRequest the full property packet or schedule a private walkthrough with ${brokerageName}:\n${captureUrl}\n\n#RealEstate #PropertyAcquisition #MarketUpdate #RealEstateInvesting`,
      youtube: `TITLE: Inside This ${formattedPrice} Property at ${address}! 🏡 #Shorts\n\nHOOK (0-3s): "Stop scrolling—wait until you see what ${formattedPrice} gets you at ${address}!"\nBODY (3-20s): Walk through the main entrance, highlight ${
        specsLine || "the layout and standout upgrades"
      }, and point out the neighborhood location.\nCTA (20-30s): "Want the full price sheet or a private tour? Click the link in the description or pinned comment right now!"\n\nDESCRIPTION LINK: ${captureUrl}`,
      tiktok: `HOOK (0-3s): "POV: You just found the best deal on the market at ${address} 👀"\nVOICEOVER / TEXT ON SCREEN:\n- Price: ${formattedPrice}\n- Specs: ${
        specsLine || "Must-see layout & location"
      }\n- Highlight: ${
        description || "Move-in ready with serious upside"
      }\nCTA (Last 3s): "Grab the full info packet & book a tour at the link in bio before it goes under contract!"\n\nCAPTION: ${address} (${formattedPrice}) 🔥 Link in bio for full details! #realestate #housetour #propertytok #justlisted #investing`,
    };

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ posts: fallbackPack });
    }

    const prompt = `You are an elite real estate social media marketer for ${brokerageName}.
Generate high-converting, ready-to-publish social media posts and 30-second vertical video scripts for this listing:
- Address: ${address}
- Price: ${formattedPrice}
- Specs: ${specsLine || "N/A"}
- Badge/Tag: ${tag || "Featured"}
- Notes: ${description || "Prime property opportunity"}
- Lead Capture Link: ${captureUrl}

Return ONLY valid JSON with exact keys: "facebook", "instagram", "linkedin", "youtube", "tiktok".
- "facebook": Engaging post with bullet highlights, clear call-to-action, and the capture link.
- "instagram": Visual-first caption with emojis, strong CTA ("comment TOUR or click link"), capture link, and 8 relevant hashtags.
- "linkedin": Professional real estate advisory post highlighting value, specs, and capture link.
- "youtube": YouTube Shorts title, 30-second spoken script (Hook, Walkthrough, CTA), and description with capture link.
- "tiktok": Viral TikTok hook, on-screen text cues, voiceover script, and caption with hashtags.`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiRes.ok) {
      return NextResponse.json({ posts: fallbackPack });
    }

    const aiData = await aiRes.json();
    const parsed = JSON.parse(aiData.choices?.[0]?.message?.content || "{}");

    return NextResponse.json({
      posts: {
        facebook: parsed.facebook || fallbackPack.facebook,
        instagram: parsed.instagram || fallbackPack.instagram,
        linkedin: parsed.linkedin || fallbackPack.linkedin,
        youtube: parsed.youtube || fallbackPack.youtube,
        tiktok: parsed.tiktok || fallbackPack.tiktok,
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to generate social posts" }, { status: 500 });
  }
}