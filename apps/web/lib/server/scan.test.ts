import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { SceneAnalysis } from "@retrofit/core";
import { handleScan, MAX_PHOTO_BYTES, PERSON_REFUSED, type ScanDeps } from "./scan";

const scene: SceneAnalysis = { subject: "a person", parts: [] };

function deps(overrides: Partial<ScanDeps> = {}): ScanDeps {
  return {
    upload: vi.fn(async () => "https://cdn/photo.jpg"),
    analyze: vi.fn(async () => scene),
    sign: vi.fn(() => "signed-token"),
    reserve: vi.fn(async () => true),
    release: vi.fn(async () => {}),
    ...overrides,
  };
}

function form(fields: Record<string, string | Blob>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

let jpegBytes: Uint8Array;
const jpeg = () => new Blob([jpegBytes as BlobPart], { type: "image/jpeg" });

beforeAll(async () => {
  jpegBytes = new Uint8Array(
    await sharp({ create: { width: 30, height: 40, channels: 3, background: { r: 9, g: 9, b: 9 } } }).jpeg().toBuffer(),
  );
});

describe("handleScan", () => {
  it("uploads the photo, analyzes it and returns the scene", async () => {
    const d = deps();
    const result = await handleScan(form({ pack: "car", photo: jpeg() }), d);

    expect(result).toEqual({
      status: 200,
      body: { success: true, data: { photoUrl: "https://cdn/photo.jpg", width: 30, height: 40, scene, token: "signed-token" } },
    });
    expect(d.sign).toHaveBeenCalledWith({ photoUrl: "https://cdn/photo.jpg", pack: "car", width: 30, height: 40, scene });
    expect(d.upload).toHaveBeenCalledWith(expect.any(Uint8Array), "image/jpeg");
    expect(d.analyze).toHaveBeenCalledWith(expect.objectContaining({ id: "car" }), "https://cdn/photo.jpg");
  });

  it("rejects an unknown pack", async () => {
    const result = await handleScan(form({ pack: "boats", photo: jpeg() }), deps());
    expect(result.status).toBe(400);
  });

  it("rejects a missing or non-image photo", async () => {
    expect((await handleScan(form({ pack: "car" }), deps())).status).toBe(400);
    const text = new Blob(["hello"], { type: "text/plain" });
    expect((await handleScan(form({ pack: "car", photo: text }), deps())).status).toBe(400);
  });

  it("rejects bytes that aren't really an image", async () => {
    const fake = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/jpeg" });
    expect((await handleScan(form({ pack: "car", photo: fake }), deps())).status).toBe(400);
  });

  it("rejects a photo that is too big", async () => {
    const big = new Blob([new Uint8Array(MAX_PHOTO_BYTES + 1)], { type: "image/jpeg" });
    expect((await handleScan(form({ pack: "car", photo: big }), deps())).status).toBe(413);
  });

  it("requires the 18+ confirmation for clothing", async () => {
    expect((await handleScan(form({ pack: "clothing", photo: jpeg() }), deps())).status).toBe(400);
    expect((await handleScan(form({ pack: "clothing", photo: jpeg(), adult: "yes" }), deps())).status).toBe(200);
  });

  it("refuses a photo with a person outside Clothing, without signing it", async () => {
    const d = deps({ analyze: vi.fn(async () => ({ ...scene, hasPerson: true })) });
    for (const pack of ["anything", "room", "car"]) {
      const result = await handleScan(form({ pack, photo: jpeg() }), d);
      expect(result).toEqual({ status: 422, body: { success: false, error: PERSON_REFUSED } });
    }
    expect(d.sign).not.toHaveBeenCalled();
  });

  it("accepts a person in Clothing", async () => {
    const d = deps({ analyze: vi.fn(async () => ({ ...scene, hasPerson: true })) });
    expect((await handleScan(form({ pack: "clothing", photo: jpeg(), adult: "yes" }), d)).status).toBe(200);
  });

  it("books every read against the daily cap before calling the photo reader", async () => {
    const d = deps();
    await handleScan(form({ pack: "car", photo: jpeg() }), d);
    expect(d.reserve).toHaveBeenCalledOnce();
    expect(d.release).not.toHaveBeenCalled();
  });

  it("refuses to read when today's budget is used up", async () => {
    const d = deps({ reserve: vi.fn(async () => false) });
    const result = await handleScan(form({ pack: "car", photo: jpeg() }), d);
    expect(result.status).toBe(503);
    expect(d.upload).not.toHaveBeenCalled();
    expect(d.analyze).not.toHaveBeenCalled();
  });

  it("fails closed when the cap can't be checked", async () => {
    const d = deps({ reserve: vi.fn(async () => Promise.reject(new Error("db down"))) });
    expect((await handleScan(form({ pack: "car", photo: jpeg() }), d)).status).toBe(502);
    expect(d.analyze).not.toHaveBeenCalled();
  });

  it("gives the booking back when the upload fails, but not after a read", async () => {
    const uploadFails = deps({ upload: vi.fn(async () => Promise.reject(new Error("upload down"))) });
    await handleScan(form({ pack: "car", photo: jpeg() }), uploadFails);
    expect(uploadFails.release).toHaveBeenCalledOnce();

    const readFails = deps({ analyze: vi.fn(async () => Promise.reject(new Error("reader down"))) });
    await handleScan(form({ pack: "car", photo: jpeg() }), readFails);
    expect(readFails.release).not.toHaveBeenCalled();
  });

  it("does not book bad requests", async () => {
    const d = deps();
    await handleScan(form({ pack: "car" }), d);
    expect(d.reserve).not.toHaveBeenCalled();
  });

  it("returns a friendly 502 when a provider fails, without leaking details", async () => {
    const d = deps({ analyze: vi.fn(async () => Promise.reject(new Error("secret upstream detail"))) });
    const result = await handleScan(form({ pack: "car", photo: jpeg() }), d);

    expect(result.status).toBe(502);
    expect(JSON.stringify(result.body)).not.toContain("secret upstream detail");
  });
});
