// Vercel serverless function — proxies file uploads to Pinata
// Deployed at: /api/pinata/file
// Called by: src/lib/pinata.ts → uploadFileToPinata()

export const config = {
  api: {
    bodyParser: false, // we need raw multipart stream
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const pinataJwt = process.env.PINATA_JWT;
  if (!pinataJwt) {
    return res.status(500).json({ error: "PINATA_JWT is not configured on the server" });
  }

  try {
    // Read raw body as a Buffer
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    const rawBody = Buffer.concat(chunks);

    // Extract Content-Type from the incoming request (includes boundary)
    const contentType = req.headers["content-type"];
    if (!contentType || !contentType.includes("multipart/form-data")) {
      return res.status(400).json({ error: "Expected multipart/form-data" });
    }

    // Forward the raw multipart body directly to Pinata
    const pinataResponse = await fetch("https://uploads.pinata.cloud/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pinataJwt}`,
        "Content-Type": contentType,
      },
      body: rawBody,
    });

    const text = await pinataResponse.text();

    if (!pinataResponse.ok) {
      console.error("Pinata file upload failed:", pinataResponse.status, text);
      return res.status(pinataResponse.status).json({ error: text || "Pinata upload failed" });
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return res.status(500).json({ error: "Unexpected response from Pinata" });
    }

    const cid = parsed?.data?.cid || parsed?.cid;
    if (!cid) {
      return res.status(500).json({ error: "Pinata did not return a CID", raw: text });
    }

    return res.status(200).json({
      cid,
      uri: `ipfs://${cid}`,
    });
  } catch (err) {
    console.error("Pinata proxy error:", err);
    return res.status(500).json({ error: err.message || "Pinata proxy failed" });
  }
}
