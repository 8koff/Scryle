import { AI_CONSENT_VERSION } from "@retrofit/core";
import { allowAiConsent, checkAiConsent, resetAiConsent } from "./ai-consent";

const mockGetApi = jest.fn();
const mockPostJson = jest.fn();
jest.mock("./api", () => ({
  getApi: (...args: unknown[]) => mockGetApi(...args),
  postJson: (...args: unknown[]) => mockPostJson(...args),
}));

const answer = (hasConsented: boolean) => ({ status: "ready", data: { hasConsented, version: AI_CONSENT_VERSION } });

beforeEach(() => {
  resetAiConsent();
  mockGetApi.mockReset();
  mockPostJson.mockReset();
});

describe("checkAiConsent", () => {
  test("asks the server, which decides", async () => {
    mockGetApi.mockResolvedValueOnce(answer(false));
    expect(await checkAiConsent("u1")).toEqual({ status: "needed" });
    expect(mockGetApi).toHaveBeenCalledWith("/api/ai-consent");
  });

  test("once the server says yes, it doesn't ask again this session", async () => {
    mockGetApi.mockResolvedValueOnce(answer(true));
    expect(await checkAiConsent("u1")).toEqual({ status: "allowed" });
    expect(await checkAiConsent("u1")).toEqual({ status: "allowed" });
    expect(mockGetApi).toHaveBeenCalledTimes(1);
  });

  test("a yes for one account isn't a yes for another", async () => {
    mockGetApi.mockResolvedValueOnce(answer(true)).mockResolvedValueOnce(answer(false));
    await checkAiConsent("u1");
    expect(await checkAiConsent("u2")).toEqual({ status: "needed" });
  });

  test("offline is an error to show, never a yes", async () => {
    mockGetApi.mockResolvedValueOnce({ status: "error", message: "offline" });
    expect(await checkAiConsent("u1")).toEqual({ status: "error", message: "offline" });
  });

  test("permission for different wording does not open the camera", async () => {
    mockGetApi.mockResolvedValueOnce({ status: "ready", data: { hasConsented: true, version: AI_CONSENT_VERSION + 1 } });
    expect(await checkAiConsent("u1")).toMatchObject({ status: "error" });
    mockGetApi.mockResolvedValueOnce(answer(false));
    expect(await checkAiConsent("u1")).toEqual({ status: "needed" });
  });
});

describe("allowAiConsent", () => {
  test("sends the version of the wording this build shows", async () => {
    mockPostJson.mockResolvedValueOnce(answer(true));
    expect(await allowAiConsent("u1")).toEqual({ status: "allowed" });
    expect(mockPostJson).toHaveBeenCalledWith("/api/ai-consent", { version: AI_CONSENT_VERSION });
    // Remembered: the next check doesn't need the server.
    expect(await checkAiConsent("u1")).toEqual({ status: "allowed" });
    expect(mockGetApi).not.toHaveBeenCalled();
  });

  test("a failed save is not remembered as a yes", async () => {
    mockPostJson.mockResolvedValueOnce({ status: "error", message: "Please update the app" });
    expect(await allowAiConsent("u1")).toEqual({ status: "error", message: "Please update the app" });
    mockGetApi.mockResolvedValueOnce(answer(false));
    expect(await checkAiConsent("u1")).toEqual({ status: "needed" });
  });

  test.each([
    { hasConsented: false, version: AI_CONSENT_VERSION },
    { hasConsented: true, version: AI_CONSENT_VERSION + 1 },
  ])("an unconfirmed save stays blocked and is not remembered: %j", async (data) => {
    mockPostJson.mockResolvedValueOnce({ status: "ready", data });
    expect(await allowAiConsent("u1")).toMatchObject({ status: "error" });
    mockGetApi.mockResolvedValueOnce(answer(false));
    expect(await checkAiConsent("u1")).toEqual({ status: "needed" });
  });
});
