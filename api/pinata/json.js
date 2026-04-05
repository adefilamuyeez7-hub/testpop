// Vercel serverless function - proxies JSON metadata uploads to Pinata
// Deployed at: /api/pinata/json
// Called by: src/lib/pinata.ts -> uploadMetadataToPinata()

import { requirePinataAuthStrategies } from "../../server/pinataAuth.js";
import { requireApiBearerAuth } from "../../server/requestAuth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    requireApiBearerAuth(req, process.env);
    const pinataAuthStrategies = requirePinataAuthStrategies(process.env);
    let body = req.body;

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

    const payload = JSON.stringify(metadata);
    let pinataResponse = null;
    let text = "";
    let authMode = null;

    for (let index = 0; index < pinataAuthStrategies.length; index += 1) {
      const strategy = pinataAuthStrategies[index];
      authMode = strategy.mode;
      pinataResponse = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
        method: "POST",
        headers: {
          ...strategy.headers,
          "Content-Type": "application/json",
        },
        body: payload,
      });

      text = await pinataResponse.text();
      if (pinataResponse.ok || pinataResponse.status !== 401 || index === pinataAuthStrategies.length - 1) {
        break;
      }

      console.warn(`Pinata JSON upload auth failed with ${strategy.mode}, retrying with next credential.`);
    }

    if (!pinataResponse.ok) {
      console.error("Pinata JSON upload failed:", authMode, pinataResponse.status, text);
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
    const statusCode = Number(err?.statusCode) || 500;
    console.error("Pinata JSON proxy error:", err);
    return res.status(statusCode).json({ error: err.message || "Pinata JSON proxy failed" });
  }
}
