import { describe, expect, it } from "vitest";
import { getPack, type SceneAnalysis } from "@retrofit/core";
import { studioParts } from "./parts";

const box = { x: 0.1, y: 0.1, w: 0.2, h: 0.2 };

describe("studioParts", () => {
  it("lists detected parts once each, with the first box, in photo order", () => {
    const scene: SceneAnalysis = {
      subject: "a white sedan",
      parts: [
        { partId: "wheels", label: "Front wheel", current: "silver wheels", box },
        { partId: "wheels", label: "Rear wheel", current: "silver wheels", box: { ...box, x: 0.6 } },
        { partId: "headlights", label: "Headlight", current: "stock headlights", box },
      ],
    };
    const parts = studioParts(getPack("car"), scene);

    expect(parts.filter((p) => p.id === "wheels")).toHaveLength(1);
    expect(parts[0]).toMatchObject({ id: "wheels", label: "Wheels", boxes: [box, { ...box, x: 0.6 }] });
  });

  it("adds colour-only parts the photo reader didn't box, so paint and tint are always offered", () => {
    const parts = studioParts(getPack("car"), { subject: "a car", parts: [] });
    expect(parts.map((p) => p.id)).toEqual(expect.arrayContaining(["paint", "tint"]));
    expect(parts.find((p) => p.id === "paint")?.boxes).toEqual([]);
  });

  it("uses the photo reader's label for parts outside the pack list (anything pack)", () => {
    const scene: SceneAnalysis = { subject: "a bike", parts: [{ partId: "bike-saddle", label: "Saddle", current: "black saddle", box }] };
    expect(studioParts(getPack("anything"), scene)).toEqual([{ id: "bike-saddle", label: "Saddle", boxes: [box] }]);
  });
});
