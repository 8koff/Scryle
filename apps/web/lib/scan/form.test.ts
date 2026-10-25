import { describe, expect, it } from "vitest";
import { scanForm } from "./form";

const photo = new Blob(["photo"], { type: "image/jpeg" });

describe("website scan form", () => {
  it("sends an AI Allow only after the visitor has checked it", () => {
    expect(scanForm("room", photo, false, false).get("ai_consent")).toBeNull();
    expect(scanForm("room", photo, true, false).get("ai_consent")).toBe("yes");
  });

  it("keeps the Clothing 18+ answer separate from AI consent", () => {
    const form = scanForm("clothing", photo, true, false);
    expect(form.get("ai_consent")).toBe("yes");
    expect(form.get("adult")).toBeNull();
    expect(scanForm("clothing", photo, true, true).get("adult")).toBe("yes");
  });
});
