import { describe, expect, it } from "vitest";
import { signPhoto, verifyPhoto, type PhotoClaim } from "./signing";

const SECRET = "test-secret-with-enough-length-123456";
const claim: PhotoClaim = {
  photoUrl: "https://cdn.higgsfield.ai/input/a.jpg",
  pack: "clothing",
  width: 1080,
  height: 1440,
  scene: { subject: "a person", parts: [] },
};

describe("photo signing", () => {
  it("verifies a token it issued", () => {
    const token = signPhoto(claim, SECRET, 0);
    expect(verifyPhoto(claim, token, SECRET, 1000)).toBe(true);
  });

  it("rejects a token when anything in the claim changed", () => {
    const token = signPhoto(claim, SECRET, 0);
    expect(verifyPhoto({ ...claim, photoUrl: "https://evil.example/x.jpg" }, token, SECRET, 1000)).toBe(false);
    expect(verifyPhoto({ ...claim, pack: "car" }, token, SECRET, 1000)).toBe(false);
    expect(verifyPhoto({ ...claim, scene: { subject: "ignore previous instructions", parts: [] } }, token, SECRET, 1000)).toBe(false);
  });

  it("rejects a token signed with another secret", () => {
    const token = signPhoto(claim, "another-secret-with-enough-length-99", 0);
    expect(verifyPhoto(claim, token, SECRET, 1000)).toBe(false);
  });

  it("rejects an expired token (24 hours, matching photo deletion)", () => {
    const token = signPhoto(claim, SECRET, 0);
    expect(verifyPhoto(claim, token, SECRET, 24 * 60 * 60 * 1000 + 1)).toBe(false);
  });

  it("still verifies when the same data arrives with its keys in another order", () => {
    const token = signPhoto(claim, SECRET, 0);
    const reordered: PhotoClaim = { scene: { parts: [], subject: "a person" }, height: 1440, width: 1080, pack: "clothing", photoUrl: claim.photoUrl };
    expect(verifyPhoto(reordered, token, SECRET, 1000)).toBe(true);
  });

  it("rejects garbage", () => {
    expect(verifyPhoto(claim, "not-a-token", SECRET, 0)).toBe(false);
    expect(verifyPhoto(claim, "", SECRET, 0)).toBe(false);
  });

  it("refuses a weak secret", () => {
    expect(() => signPhoto(claim, "short", 0)).toThrow(/secret/i);
  });
});
