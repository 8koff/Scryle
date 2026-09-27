import { describe, expect, it, vi } from "vitest";
import { createHiggsfieldClient, HiggsfieldError, higgsfieldFromEnv } from "./client";

type Call = { url: string; init: RequestInit };

function fakeFetch(responses: Array<{ status?: number; body: unknown }>) {
  const calls: Call[] = [];
  const queue = [...responses];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const next = queue.shift();
    if (!next) throw new Error("fakeFetch ran out of responses");
    return new Response(next.body === null ? null : JSON.stringify(next.body), {
      status: next.status ?? 200,
    });
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}

const creds = { keyId: "kid", keySecret: "ksecret" };

describe("higgsfield client", () => {
  it("submits to the model endpoint with the Key auth header and JSON body", async () => {
    const { fetchImpl, calls } = fakeFetch([
      { body: { request_id: "r1", status: "queued", status_url: "s", cancel_url: "c" } },
    ]);
    const client = createHiggsfieldClient({ ...creds, fetch: fetchImpl });

    const queued = await client.submit("alibaba/qwen-image-3/edit", { prompt: "hi" });

    expect(queued).toEqual({ requestId: "r1", status: "queued" });
    expect(calls[0]?.url).toBe("https://api.higgsfield.ai/alibaba/qwen-image-3/edit");
    expect(calls[0]?.init.method).toBe("POST");
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Key kid:ksecret");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ prompt: "hi" });
  });

  it("adds the webhook as an encoded hf_webhook query parameter", async () => {
    const { fetchImpl, calls } = fakeFetch([{ body: { request_id: "r1", status: "queued" } }]);
    const client = createHiggsfieldClient({ ...creds, fetch: fetchImpl });

    await client.submit("marketing-studio/image", { prompt: "x" }, { webhookUrl: "https://a.b/hook?x=1" });

    expect(calls[0]?.url).toBe(
      "https://api.higgsfield.ai/marketing-studio/image?hf_webhook=https%3A%2F%2Fa.b%2Fhook%3Fx%3D1",
    );
  });

  it("refuses endpoints that could escape the API path", async () => {
    const { fetchImpl } = fakeFetch([]);
    const client = createHiggsfieldClient({ ...creds, fetch: fetchImpl });

    await expect(client.submit("../files/x", {})).rejects.toThrow(/invalid endpoint/i);
    await expect(client.submit("https://evil.com/x", {})).rejects.toThrow(/invalid endpoint/i);
  });

  it("maps a completed status with images", async () => {
    const { fetchImpl, calls } = fakeFetch([
      { body: { request_id: "r1", status: "completed", images: [{ url: "https://cdn/x.png" }] } },
    ]);
    const client = createHiggsfieldClient({ ...creds, fetch: fetchImpl });

    const status = await client.status("r1");

    expect(calls[0]?.url).toBe("https://api.higgsfield.ai/requests/r1/status");
    expect(status).toEqual({ requestId: "r1", status: "completed", images: ["https://cdn/x.png"] });
  });

  it("maps a completed video status", async () => {
    const { fetchImpl } = fakeFetch([
      { body: { request_id: "r2", status: "completed", video: { url: "https://cdn/v.mp4" } } },
    ]);
    const client = createHiggsfieldClient({ ...creds, fetch: fetchImpl });

    expect(await client.status("r2")).toEqual({ requestId: "r2", status: "completed", video: "https://cdn/v.mp4" });
  });

  it("throws a HiggsfieldError with the API's detail message on HTTP errors", async () => {
    const { fetchImpl } = fakeFetch([{ status: 422, body: { detail: "image_urls is required" } }]);
    const client = createHiggsfieldClient({ ...creds, fetch: fetchImpl });

    const error = await client.submit("alibaba/qwen-image-3/edit", {}).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HiggsfieldError);
    expect((error as HiggsfieldError).status).toBe(422);
    expect((error as HiggsfieldError).message).toContain("image_urls is required");
  });

  it("never puts the secret in an error message", async () => {
    const { fetchImpl } = fakeFetch([{ status: 401, body: { detail: "bad key" } }]);
    const client = createHiggsfieldClient({ ...creds, fetch: fetchImpl });

    const error = (await client.status("r1").catch((e: unknown) => e)) as Error;

    expect(error.message).not.toContain("ksecret");
  });

  it("uploads bytes via a presigned URL without sending our credentials there", async () => {
    const { fetchImpl, calls } = fakeFetch([
      {
        body: {
          public_url: "https://cdn/in.jpg",
          upload_url: "https://storage/presigned",
          upload_headers: { "Content-Type": "image/jpeg", "x-amz-tagging": "retention=temporary" },
        },
      },
      { body: null },
    ]);
    const client = createHiggsfieldClient({ ...creds, fetch: fetchImpl });

    const url = await client.uploadBytes(new Uint8Array([1, 2, 3]), "image/jpeg");

    expect(url).toBe("https://cdn/in.jpg");
    expect(calls[0]?.url).toBe("https://api.higgsfield.ai/files/generate-upload-url");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ content_type: "image/jpeg" });
    expect(calls[1]?.url).toBe("https://storage/presigned");
    expect(calls[1]?.init.method).toBe("PUT");
    const putHeaders = calls[1]?.init.headers as Record<string, string>;
    expect(putHeaders.Authorization).toBeUndefined();
    expect(putHeaders["x-amz-tagging"]).toBe("retention=temporary");
  });

  it("estimates a request's real price before running it", async () => {
    const { fetchImpl, calls } = fakeFetch([
      { body: { type: "estimate", credits: "1.600", usd: "0.100", discount: null } },
    ]);
    const client = createHiggsfieldClient({ ...creds, fetch: fetchImpl });

    const estimate = await client.estimate("xai/grok-imagine-image-2.0", { prompt: "x" });

    expect(calls[0]?.url).toBe("https://api.higgsfield.ai/estimate/xai/grok-imagine-image-2.0");
    expect(estimate).toEqual({ usd: 0.1, credits: 1.6 });
  });

  it("subtracts a discount from the estimate", async () => {
    const { fetchImpl } = fakeFetch([
      { body: { credits: "4.776", usd: "0.299", discount: { percentage: "15.00", credits: "0.843", usd: "0.053" } } },
    ]);
    const client = createHiggsfieldClient({ ...creds, fetch: fetchImpl });

    expect((await client.estimate("marketing-studio/image", {})).usd).toBeCloseTo(0.246);
  });

  it("rejects an estimate with no price", async () => {
    const { fetchImpl } = fakeFetch([{ body: { credits: "1" } }]);
    const client = createHiggsfieldClient({ ...creds, fetch: fetchImpl });

    await expect(client.estimate("m/x", {})).rejects.toThrow(/price/i);
  });

  it("waitFor polls until a terminal status", async () => {
    const { fetchImpl } = fakeFetch([
      { body: { request_id: "r1", status: "queued" } },
      { body: { request_id: "r1", status: "in_progress" } },
      { body: { request_id: "r1", status: "completed", images: [{ url: "u" }] } },
    ]);
    const sleep = vi.fn(async () => {});
    const client = createHiggsfieldClient({ ...creds, fetch: fetchImpl, sleep });

    const result = await client.waitFor("r1", { intervalMs: 10, timeoutMs: 1000 });

    expect(result.status).toBe("completed");
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("waitFor gives up after the timeout", async () => {
    const { fetchImpl } = fakeFetch(
      Array.from({ length: 50 }, () => ({ body: { request_id: "r1", status: "queued" } })),
    );
    let now = 0;
    const client = createHiggsfieldClient({
      ...creds,
      fetch: fetchImpl,
      sleep: async (ms) => {
        now += ms;
      },
      now: () => now,
    });

    await expect(client.waitFor("r1", { intervalMs: 100, timeoutMs: 450 })).rejects.toThrow(/timed out/i);
  });

  it("reads credentials from env, including a combined id:secret key", async () => {
    const { fetchImpl, calls } = fakeFetch([
      { body: { request_id: "a", status: "queued" } },
      { body: { request_id: "b", status: "queued" } },
      { body: { request_id: "c", status: "queued" } },
    ]);
    const auth = () => (calls.at(-1)?.init.headers as Record<string, string>).Authorization;

    await higgsfieldFromEnv({ HF_API_KEY_ID: "kid", HF_API_KEY_SECRET: "ks" }, fetchImpl).submit("m/x", {});
    expect(auth()).toBe("Key kid:ks");

    await higgsfieldFromEnv({ HF_API_KEY_ID: "kid:ks", HF_API_KEY_SECRET: "" }, fetchImpl).submit("m/x", {});
    expect(auth()).toBe("Key kid:ks");

    await higgsfieldFromEnv({ HF_CREDENTIALS: "kid:ks" }, fetchImpl).submit("m/x", {});
    expect(auth()).toBe("Key kid:ks");
  });

  it("requires both key parts", () => {
    expect(() => createHiggsfieldClient({ keyId: "", keySecret: "s" })).toThrow(/HF_API_KEY_ID/);
    expect(() => createHiggsfieldClient({ keyId: "k", keySecret: "" })).toThrow(/HF_API_KEY_SECRET/);
  });
});
