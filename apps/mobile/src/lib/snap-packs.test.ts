import { getPack } from "@retrofit/core";
import { packsFor } from "./snap-packs";

describe("packsFor", () => {
  test("never offers Clothing, even for a live camera photo", () => {
    expect(packsFor("camera").map((p) => p.id)).not.toContain("clothing");
    expect(packsFor("library").map((p) => p.id)).not.toContain("clothing");
  });

  test("offers every other category for a camera photo", () => {
    expect(packsFor("camera").map((p) => p.id)).toEqual(["car", "room", "anything"]);
  });

  test("offers only categories that take uploads for a library photo", () => {
    expect(packsFor("library").every((p) => getPack(p.id).capture.allowUpload)).toBe(true);
  });
});
