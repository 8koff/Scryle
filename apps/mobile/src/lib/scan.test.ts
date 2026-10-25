import { scanForm } from "./scan";

jest.mock("./use-account", () => ({ account: { authFetch: jest.fn() } }));

const photo = { uri: "file:///photo.jpg", width: 1536, height: 2048 };

// The server reads these fields; `adult` is how the 18+ rule reaches it.
describe("scanForm", () => {
  test("sends the category and the photo", () => {
    const form = scanForm("room", photo, false);

    expect(form.get("pack")).toBe("room");
    // Jest runs Node's FormData, which can't show React Native's { uri } file shape; check it's there.
    expect(form.has("photo")).toBe(true);
    expect(form.get("adult")).toBeNull();
  });

  test("adds adult=yes only after the 18+ confirmation", () => {
    expect(scanForm("clothing", photo, true).get("adult")).toBe("yes");
    expect(scanForm("clothing", photo, false).get("adult")).toBeNull();
  });
});
