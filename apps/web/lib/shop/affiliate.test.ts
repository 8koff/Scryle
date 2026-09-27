import { describe, expect, it } from "vitest";
import { affiliateConfigFromEnv, affiliateUrl } from "./affiliate";

describe("affiliateUrl", () => {
  it("adds our Associates tag to Amazon links", () => {
    expect(affiliateUrl("https://www.amazon.com/dp/B0TEST?th=1", { amazonTag: "retrofit-20" })).toBe(
      "https://www.amazon.com/dp/B0TEST?th=1&tag=retrofit-20",
    );
  });

  it("replaces a tag that was already in the link", () => {
    expect(affiliateUrl("https://amazon.com/dp/B0TEST?tag=someone-else", { amazonTag: "retrofit-20" })).toBe(
      "https://amazon.com/dp/B0TEST?tag=retrofit-20",
    );
  });

  it("sends other stores through Skimlinks", () => {
    expect(affiliateUrl("https://www.ikea.com/us/en/p/sofa-123/", { skimlinksId: "12345X678" })).toBe(
      "https://go.skimresources.com/?id=12345X678&xs=1&url=https%3A%2F%2Fwww.ikea.com%2Fus%2Fen%2Fp%2Fsofa-123%2F",
    );
  });

  it("goes straight to the store when nothing is set up", () => {
    expect(affiliateUrl("https://www.ikea.com/us/en/p/sofa-123/", {})).toBe("https://www.ikea.com/us/en/p/sofa-123/");
  });

  it("doesn't treat look-alike hosts as Amazon", () => {
    expect(affiliateUrl("https://amazon.com.evil.example/x", { amazonTag: "retrofit-20" })).toBe("https://amazon.com.evil.example/x");
  });

  it("refuses links that aren't plain https", () => {
    expect(affiliateUrl("http://www.ikea.com/x", {})).toBeNull();
    expect(affiliateUrl("javascript:alert(1)", {})).toBeNull();
    expect(affiliateUrl("https://user:pass@www.ikea.com/x", {})).toBeNull();
    expect(affiliateUrl("not a url", {})).toBeNull();
  });
});

describe("affiliateConfigFromEnv", () => {
  it("reads both ids and ignores malformed ones", () => {
    expect(affiliateConfigFromEnv({ AMAZON_ASSOCIATE_TAG: " retrofit-20 ", SKIMLINKS_PUBLISHER_ID: "12345X678" })).toEqual({
      amazonTag: "retrofit-20",
      skimlinksId: "12345X678",
    });
    expect(affiliateConfigFromEnv({ AMAZON_ASSOCIATE_TAG: "bad tag&x=1", SKIMLINKS_PUBLISHER_ID: "abc" })).toEqual({});
  });
});
