import appJson from "../app.json";

describe("app.json", () => {
  test("explains saving to Photos, or iOS closes the app when someone taps Save Image in the share sheet", () => {
    const text = (appJson.expo.ios as { infoPlist?: Record<string, string> }).infoPlist?.NSPhotoLibraryAddUsageDescription;
    expect(text).toMatch(/Photos/);
  });
});
