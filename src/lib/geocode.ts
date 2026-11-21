export async function geocodeAddress(
  address: string
): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const encoded = encodeURIComponent(address.trim());
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=1`,
      {
        headers: {
          "Accept-Language": "en-US,en",
        },
      }
    );

    if (!res.ok) return null;
    const results = await res.json();

    if (Array.isArray(results) && results.length > 0) {
      return {
        latitude: parseFloat(results[0].lat),
        longitude: parseFloat(results[0].lon),
      };
    }
    return null;
  } catch {
    return null;
  }
}