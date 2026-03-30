// Vercel serverless function — proxies JSON metadata uploads to Pinata
// Deployed at: /api/pinata/json
// Called by: src/lib/pinata.ts → uploadMetadataToPinata()

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const pinataJwt = process.env.PINATA_JWT;
  if (!pinataJwt) {
    return res.status(500).json({ error: "PINATA_JWT is not configured on the server" });
  }

  try {
    let body = req.body;

    // body may arrive as a string if Vercel's default parser runs
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ error: "Invalid JSON body" });
      }
    }

    const metadata = body?.metadata;
    if (!metadata || typeof metadata !== "object") {
      return res.status(400).json({ error: "metadata object is required" });
    }

    const pinataResponse = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pinataJwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metadata),
    });

    const text = await pinataResponse.text();

    if (!pinataResponse.ok) {
      console.error("Pinata JSON upload failed:", pinataResponse.status, text);
      return res.status(pinataResponse.status).json({ error: text || "Pinata metadata upload failed" });
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return res.status(500).json({ error: "Unexpected response from Pinata" });
    }

    const cid = parsed?.IpfsHash;
    if (!cid) {
      return res.status(500).json({ error: "Pinata did not return an IpfsHash", raw: text });
    }

    return res.status(200).json({
      cid,
      uri: `ipfs://${cid}`,
    });
  } catch (err) {
    console.error("Pinata JSON proxy error:", err);
    return res.status(500).json({ error: err.message || "Pinata JSON proxy failed" });
  }
}
