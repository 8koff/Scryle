import { getPack } from "@retrofit/core";
import { describe, expect, it, vi } from "vitest";
import { analyzeScene, buildAnalyzeRequest, VisionError, type VisionClient } from "./analyze";

const car = getPack("car");
const anything = getPack("anything");

describe("buildAnalyzeRequest", () => {
  it("sends the photo first, then the instructions", () => {
    const req = buildAnalyzeRequest(car, { url: "https://cdn/car.jpg" });
    const content = req.messages[0]!.content as Array<{ type: string }>;
    expect(content[0]).toEqual({ type: "image", source: { type: "url", url: "https://cdn/car.jpg" } });
    expect(content[1]?.type).toBe("text");
  });

  it("accepts a base64 JPEG", () => {
    const req = buildAnalyzeRequest(car, { base64: "AAAA", mediaType: "image/jpeg" });
    const content = req.messages[0]!.content as Array<{ source?: unknown }>;
    expect(content[0]?.source).toEqual({ type: "base64", media_type: "image/jpeg", data: "AAAA" });
  });

  it("lists every allowed part id for a pack with fixed parts", () => {
    const text = JSON.stringify(buildAnalyzeRequest(car, { url: "u" }).messages);
    for (const part of car.parts) expect(text).toContain(part.id);
  });

  it("lets the model invent part ids for the anything pack", () => {
    const text = JSON.stringify(buildAnalyzeRequest(anything, { url: "u" }).messages);
    expect(text).toMatch(/choose your own part ids/i);
  });

  it("uses Opus 5.5 with refusal fallbacks and structured output by default", () => {
    const req = buildAnalyzeRequest(car, { url: "u" });
    expect(req.model).toBe("claude-opus-5-5");
    expect(req.fallbacks).toBe("default");
    expect(req.betas).toContain("server-side-fallback-2026-07-01");
    expect(req.output_config?.format).toBeDefined();
  });

  it("allows a model override", () => {
    expect(buildAnalyzeRequest(car, { url: "u" }, { model: "claude-sonnet-5" }).model).toBe("claude-sonnet-5");
  });
});

function fakeClient(response: object): VisionClient {
  return { beta: { messages: { parse: vi.fn(async () => response) } } } as unknown as VisionClient;
}

describe("analyzeScene", () => {
  it("returns a cleaned-up scene analysis", async () => {
    const client = fakeClient({
      stop_reason: "end_turn",
      parsed_output: {
        subject: "a white sedan",
        has_person: false,
        details: [{ key: "make", value: "Honda" }],
        parts: [{ part_id: "wheels", label: "Front wheel", current: "silver wheels", x0: 100, y0: 500, x1: 300, y1: 800 }],
      },
    });

    const scene = await analyzeScene(client, car, { url: "u" });

    expect(scene.subject).toBe("a white sedan");
    expect(scene.parts[0]?.box).toEqual({ x: 0.1, y: 0.5, w: 0.2, h: 0.3 });
  });

  it("throws a VisionError when the model refuses", async () => {
    const client = fakeClient({ stop_reason: "refusal", parsed_output: null });
    await expect(analyzeScene(client, car, { url: "u" })).rejects.toBeInstanceOf(VisionError);
  });

  it("throws a VisionError when the output did not parse", async () => {
    const client = fakeClient({ stop_reason: "max_tokens", parsed_output: null });
    await expect(analyzeScene(client, car, { url: "u" })).rejects.toThrow(/could not read/i);
  });
});
