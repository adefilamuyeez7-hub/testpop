// Vercel serverless function - proxies file uploads to Pinata
// Deployed at: /api/pinata/file
// Called by: src/lib/pinata.ts -> uploadFileToPinata()

import { requirePinataAuthStrategies } from "../../server/pinataAuth.js";
import { requireApiBearerAuth } from "../../server/requestAuth.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    requireApiBearerAuth(req, process.env);
    const pinataAuthStrategies = requirePinataAuthStrategies(process.env);

    const chunks = [];
    let totalBytes = 0;
    for await (const chunk of req) {
      const nextChunk = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
      totalBytes += nextChunk.length;
      if (totalBytes > MAX_UPLOAD_BYTES) {
        return res.status(413).json({ error: "File upload exceeds 10MB limit" });
      }
      chunks.push(nextChunk);
    }
    const rawBody = Buffer.concat(chunks);

    const contentType = req.headers["content-type"];
    if (!contentType || !contentType.includes("multipart/form-data")) {
      return res.status(400).json({ error: "Expected multipart/form-data" });
    }

    let pinataResponse = null;
    let text = "";
    let authMode = null;

    for (let index = 0; index < pinataAuthStrategies.length; index += 1) {
      const strategy = pinataAuthStrategies[index];
      authMode = strategy.mode;
      pinataResponse = await fetch("https://uploads.pinata.cloud/v3/files", {
        method: "POST",
        headers: {
          ...strategy.headers,
          "Content-Type": contentType,
        },
        body: rawBody,
      });

      text = await pinataResponse.text();
      if (pinataResponse.ok || pinataResponse.status !== 401 || index === pinataAuthStrategies.length - 1) {
        break;
      }

      console.warn(`Pinata file upload auth failed with ${strategy.mode}, retrying with next credential.`);
    }

    if (!pinataResponse.ok) {
      console.error("Pinata file upload failed:", authMode, pinataResponse.status, text);
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
    const statusCode = Number(err?.statusCode) || 500;
    console.error("Pinata proxy error:", err);
    return res.status(statusCode).json({ error: err.message || "Pinata proxy failed" });
  }
}
