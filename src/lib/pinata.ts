import { getRuntimeApiToken } from "@/lib/runtimeSession";

const DEFAULT_PINATA_API_BASE = "/api/pinata";
const PINATA_API_BASE = (import.meta.env.VITE_PINATA_API_BASE_URL || DEFAULT_PINATA_API_BASE).replace(/\/$/, "");
const DEFAULT_IPFS_GATEWAY_BASE = "https://gateway.pinata.cloud/ipfs";
const IPFS_GATEWAY_BASE = (import.meta.env.VITE_IPFS_GATEWAY_URL || DEFAULT_IPFS_GATEWAY_BASE).replace(/\/$/, "");
const USE_MEDIA_PROXY = String(import.meta.env.VITE_USE_MEDIA_PROXY || "true").toLowerCase() !== "false";

type PinataUploadResponse = {
  cid: string;
  uri?: string;
};

async function parseErrorResponse(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text || `${response.status} ${response.statusText}`;
  } catch {
    return `${response.status} ${response.statusText}`;
  }
}

function getPinataAuthHeaders(headers?: HeadersInit): Headers {
  const nextHeaders = new Headers(headers);
  const token = getRuntimeApiToken();

  if (token) {
    nextHeaders.set("Authorization", `Bearer ${token}`);
  }

  return nextHeaders;
}

async function postToPinataProxy(path: string, body: BodyInit): Promise<PinataUploadResponse> {
  const response = await fetch(`${PINATA_API_BASE}${path}`, {
    method: "POST",
    headers: getPinataAuthHeaders(),
    body,
    credentials: "include",
  });

  if (!response.ok) {
    const message = await parseErrorResponse(response);
    throw new Error(`Pinata proxy request failed: ${message}`);
  }

  return (await response.json()) as PinataUploadResponse;
}

export async function uploadFileToPinata(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const data = await postToPinataProxy("/file", formData);
  if (!data.cid) {
    throw new Error("Pinata proxy did not return a CID");
  }

  return data.cid;
}

export async function uploadMetadataToPinata(metadata: object): Promise<string> {
  const response = await fetch(`${PINATA_API_BASE}/json`, {
    method: "POST",
    headers: getPinataAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({ metadata }),
    credentials: "include",
  });

  if (!response.ok) {
    const message = await parseErrorResponse(response);
    throw new Error(`Pinata metadata upload failed: ${message}`);
  }

  const data = (await response.json()) as PinataUploadResponse;
  if (data.uri) return data.uri;
  if (data.cid) return `ipfs://${data.cid}`;

  throw new Error("Pinata proxy did not return a CID or URI");
}

function isBareIpfsCid(value: string): boolean {
  return /^(bafy[a-z2-7]+|bafk[a-z2-7]+|Qm[1-9A-HJ-NP-Za-km-z]{44,})$/i.test(value);
}

function isTransientOrInvalidMediaValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    !normalized ||
    normalized === "null" ||
    normalized === "undefined" ||
    normalized === "[object object]" ||
    normalized.startsWith("blob:") ||
    normalized.startsWith("file:") ||
    normalized.startsWith("about:")
  );
}

export function ipfsToHttp(uri: string): string {
  const normalized = uri.trim();
  if (!normalized) return "";
  if (normalized.startsWith("/api/media/proxy")) return normalized;

  const toProxyUrl = (value: string) => `/api/media/proxy?url=${encodeURIComponent(value)}`;
  const httpGatewayMatch = normalized.match(/^https?:\/\/[^/]+\/ipfs\/(.+)$/i);
  if (httpGatewayMatch?.[1]) {
    const canonical = `ipfs://${httpGatewayMatch[1]}`;
    return USE_MEDIA_PROXY ? toProxyUrl(canonical) : `${IPFS_GATEWAY_BASE}/${httpGatewayMatch[1]}`;
  }

  if (normalized.startsWith("ipfs://ipfs/")) {
    const canonical = `ipfs://${normalized.slice("ipfs://ipfs/".length)}`;
    return USE_MEDIA_PROXY ? toProxyUrl(canonical) : `${IPFS_GATEWAY_BASE}/${canonical.slice("ipfs://".length)}`;
  }

  if (normalized.startsWith("ipfs://")) {
    return USE_MEDIA_PROXY ? toProxyUrl(normalized) : `${IPFS_GATEWAY_BASE}/${normalized.slice(7)}`;
  }

  if (isBareIpfsCid(normalized)) {
    return USE_MEDIA_PROXY ? toProxyUrl(`ipfs://${normalized}`) : `${IPFS_GATEWAY_BASE}/${normalized}`;
  }

  return normalized;
}

export function resolveMediaUrl(...candidates: Array<string | null | undefined>): string {
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (!value) continue;
    if (isTransientOrInvalidMediaValue(value)) continue;
    return ipfsToHttp(value);
  }

  return "";
}
