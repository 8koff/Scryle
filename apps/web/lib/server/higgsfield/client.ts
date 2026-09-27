/**
 * Thin client for the Higgsfield API. Server-side only: it holds the API secret.
 * Docs: https://docs.higgsfield.ai/docs (auth, requests, polling, file uploads, webhooks).
 */

const DEFAULT_BASE_URL = "https://api.higgsfield.ai";
const ENDPOINT = /^[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)*$/i;
const TERMINAL = new Set(["completed", "failed", "nsfw", "canceled"]);

export type JobStatus = {
  requestId: string;
  /** queued | in_progress | completed | failed | nsfw | canceled */
  status: string;
  images?: string[];
  video?: string;
  error?: string;
};

export type ClientOptions = {
  keyId: string;
  keySecret: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  /** Injected for tests. */
  sleep?: (ms: number) => Promise<void>;
  /** Injected for tests. */
  now?: () => number;
};

export class HiggsfieldError extends Error {
  readonly status: number;
  readonly detail: unknown;

  constructor(status: number, detail: unknown, message: string) {
    super(message);
    this.name = "HiggsfieldError";
    this.status = status;
    this.detail = detail;
  }
}

export function isTerminal(status: string): boolean {
  return TERMINAL.has(status);
}

export function createHiggsfieldClient(options: ClientOptions) {
  if (!options.keyId?.trim()) throw new Error("Missing HF_API_KEY_ID");
  if (!options.keySecret?.trim()) throw new Error("Missing HF_API_KEY_SECRET");

  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const fetchImpl = options.fetch ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = options.now ?? Date.now;
  const authorization = `Key ${options.keyId.trim()}:${options.keySecret.trim()}`;

  async function call(method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: authorization,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const payload = await readBody(response);
    if (!response.ok) {
      throw new HiggsfieldError(
        response.status,
        payload,
        `Higgsfield ${method} ${path.split("?")[0]} failed (${response.status}): ${describe(payload)}`,
      );
    }
    return payload;
  }

  function checkEndpoint(endpoint: string): void {
    if (!ENDPOINT.test(endpoint) || endpoint.includes("..")) throw new Error(`Invalid endpoint: ${endpoint}`);
  }

  return {
    /**
     * The real price of a request with these exact settings, after any account discount.
     * Free to call. Published "per image" rates are for the cheapest settings only.
     */
    async estimate(endpoint: string, input: Record<string, unknown>): Promise<{ usd: number; credits: number }> {
      checkEndpoint(endpoint);
      const data = record(await call("POST", `/estimate/${endpoint}`, input));
      const usd = Number(data.usd);
      const credits = Number(data.credits);
      if (!Number.isFinite(usd)) throw new HiggsfieldError(502, data, "Estimate response has no price");
      const discount = record(data.discount);
      const discountUsd = Number(discount.usd);
      const discountCredits = Number(discount.credits);
      return {
        usd: Number.isFinite(discountUsd) ? usd - discountUsd : usd,
        credits: Number.isFinite(discountCredits) ? credits - discountCredits : credits,
      };
    },

    /** Queue a generation. `endpoint` is a model endpoint ID like "alibaba/qwen-image-3/edit". */
    async submit(
      endpoint: string,
      input: Record<string, unknown>,
      opts: { webhookUrl?: string } = {},
    ): Promise<{ requestId: string; status: string }> {
      checkEndpoint(endpoint);
      const query = opts.webhookUrl ? `?hf_webhook=${encodeURIComponent(opts.webhookUrl)}` : "";
      const data = record(await call("POST", `/${endpoint}${query}`, input));
      const requestId = str(data.request_id);
      if (!requestId) throw new HiggsfieldError(502, data, "Higgsfield response is missing request_id");
      return { requestId, status: str(data.status) ?? "queued" };
    },

    async status(requestId: string): Promise<JobStatus> {
      return toJobStatus(await call("GET", `/requests/${encodeURIComponent(requestId)}/status`), requestId);
    },

    /** Upload raw bytes and get back a public URL the models can read. */
    async uploadBytes(bytes: Uint8Array, contentType: string): Promise<string> {
      const data = record(await call("POST", "/files/generate-upload-url", { content_type: contentType }));
      const uploadUrl = str(data.upload_url);
      const publicUrl = str(data.public_url);
      if (!uploadUrl || !publicUrl) throw new HiggsfieldError(502, data, "Upload URL response is incomplete");

      const headers = Object.fromEntries(
        Object.entries(record(data.upload_headers)).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
      );
      // Presigned storage URL: never send our credentials here.
      const put = await fetchImpl(uploadUrl, { method: "PUT", headers, body: bytes as BodyInit });
      if (!put.ok) throw new HiggsfieldError(put.status, null, `Upload to storage failed (${put.status})`);
      return publicUrl;
    },

    /** Poll until the job reaches a terminal status or the timeout passes. */
    async waitFor(
      requestId: string,
      { intervalMs = 3000, timeoutMs = 5 * 60_000 }: { intervalMs?: number; timeoutMs?: number } = {},
    ): Promise<JobStatus> {
      const deadline = now() + timeoutMs;
      for (;;) {
        const current = await this.status(requestId);
        if (isTerminal(current.status)) return current;
        if (now() + intervalMs > deadline) {
          throw new Error(`Timed out waiting for Higgsfield request ${requestId} (last status: ${current.status})`);
        }
        await sleep(intervalMs);
      }
    },
  };
}

export type HiggsfieldClient = ReturnType<typeof createHiggsfieldClient>;

/**
 * Builds a client from HF_API_KEY_ID + HF_API_KEY_SECRET, or from one combined
 * "id:secret" value in HF_CREDENTIALS or HF_API_KEY_ID (the console hands it out that way).
 */
export function higgsfieldFromEnv(
  env: Record<string, string | undefined> = process.env,
  fetchImpl?: typeof fetch,
): HiggsfieldClient {
  let keyId = env.HF_API_KEY_ID?.trim() ?? "";
  let keySecret = env.HF_API_KEY_SECRET?.trim() ?? "";
  const combined = env.HF_CREDENTIALS?.trim() || (!keySecret && keyId.includes(":") ? keyId : "");
  if (combined) {
    const split = combined.indexOf(":");
    keyId = combined.slice(0, split);
    keySecret = combined.slice(split + 1);
  }
  return createHiggsfieldClient({ keyId, keySecret, ...(fetchImpl ? { fetch: fetchImpl } : {}) });
}

function toJobStatus(payload: unknown, fallbackId: string): JobStatus {
  const data = record(payload);
  const images = Array.isArray(data.images)
    ? data.images.map((item) => str(record(item).url)).filter((u): u is string => Boolean(u))
    : [];
  const video = str(record(data.video).url);
  const error = data.error == null ? undefined : describe(data.error);
  return {
    requestId: str(data.request_id) ?? fallbackId,
    status: str(data.status) ?? "unknown",
    ...(images.length ? { images } : {}),
    ...(video ? { video } : {}),
    ...(error ? { error } : {}),
  };
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function describe(payload: unknown): string {
  if (typeof payload === "string") return payload.slice(0, 500);
  const detail = record(payload).detail;
  if (typeof detail === "string") return detail;
  if (detail !== undefined) return JSON.stringify(detail).slice(0, 500);
  return JSON.stringify(payload ?? null).slice(0, 500);
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}
