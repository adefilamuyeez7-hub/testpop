const DEFAULT_PINATA_API_BASE = "/api/pinata";
const PINATA_API_BASE = (import.meta.env.VITE_PINATA_API_BASE_URL || DEFAULT_PINATA_API_BASE).replace(/\/$/, "");

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

async function postToPinataProxy(path: string, body: BodyInit): Promise<PinataUploadResponse> {
  const response = await fetch(`${PINATA_API_BASE}${path}`, {
    method: "POST",
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
    headers: {
      "Content-Type": "application/json",
    },
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

export function ipfsToHttp(uri: string): string {
  if (uri.startsWith("ipfs://")) {
    return `https://gateway.pinata.cloud/ipfs/${uri.slice(7)}`;
  }
  return uri;
}
