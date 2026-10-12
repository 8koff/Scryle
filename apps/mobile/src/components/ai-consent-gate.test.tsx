import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { resetAiConsent } from "@/lib/ai-consent";
import { AiConsentGate } from "./ai-consent-gate";

const mockGetApi = jest.fn();
const mockPostJson = jest.fn();
const mockBack = jest.fn();

jest.mock("@/lib/api", () => ({
  getApi: (...args: unknown[]) => mockGetApi(...args),
  postJson: (...args: unknown[]) => mockPostJson(...args),
}));
jest.mock("@/lib/use-account", () => ({
  account: { subscribe: () => () => {}, getSnapshot: () => ({ status: "signed-in", userId: "u1" }) },
}));
jest.mock("expo-router", () => ({ router: { back: () => mockBack() } }));
const mockOpenBrowser = jest.fn();
jest.mock("expo-web-browser", () => ({ openBrowserAsync: (url: string) => mockOpenBrowser(url) }));
jest.mock("@/lib/config", () => ({ API_URL: "https://scryle.test" }));

const answer = (hasConsented: boolean) => ({ status: "ready", data: { hasConsented, version: 1 } });
const Camera = () => <Text>camera</Text>;

beforeEach(() => {
  resetAiConsent();
  jest.clearAllMocks();
});

describe("AiConsentGate", () => {
  test("before the first scan: says the photo goes to AI partners, links to who they are, and hides the camera", async () => {
    mockGetApi.mockResolvedValueOnce(answer(false));
    await render(
      <AiConsentGate>
        <Camera />
      </AiConsentGate>,
    );

    expect(await screen.findByText("Before your first scan")).toBeTruthy();
    expect(screen.getByText(/trusted AI partners to read your photo/)).toBeTruthy();
    expect(screen.queryByText("camera")).toBeNull();

    // The partners are named on the Privacy page, one tap away.
    await fireEvent.press(screen.getByRole("link", { name: "Who we work with ›" }));
    expect(mockOpenBrowser).toHaveBeenCalledWith("https://scryle.test/privacy#ai");
  });

  test("Allow saves consent on the server, then opens the camera", async () => {
    mockGetApi.mockResolvedValueOnce(answer(false));
    mockPostJson.mockResolvedValueOnce(answer(true));
    await render(
      <AiConsentGate>
        <Camera />
      </AiConsentGate>,
    );

    await fireEvent.press(await screen.findByRole("button", { name: "Allow" }));

    expect(await screen.findByText("camera")).toBeTruthy();
    expect(mockPostJson).toHaveBeenCalledWith("/api/ai-consent", { version: 1 });
  });

  test("Not now sends nothing and leaves", async () => {
    mockGetApi.mockResolvedValueOnce(answer(false));
    await render(
      <AiConsentGate>
        <Camera />
      </AiConsentGate>,
    );

    await fireEvent.press(await screen.findByRole("button", { name: "Not now" }));

    expect(mockBack).toHaveBeenCalled();
    expect(mockPostJson).not.toHaveBeenCalled();
    expect(screen.queryByText("camera")).toBeNull();
  });

  test("someone who already allowed goes straight to the camera", async () => {
    mockGetApi.mockResolvedValueOnce(answer(true));
    await render(
      <AiConsentGate>
        <Camera />
      </AiConsentGate>,
    );

    expect(await screen.findByText("camera")).toBeTruthy();
    expect(screen.queryByText("Before your first scan")).toBeNull();
  });

  test("if the server can't be reached, the camera stays closed", async () => {
    mockGetApi.mockResolvedValueOnce({ status: "error", message: "Couldn't reach Scryle." });
    await render(
      <AiConsentGate>
        <Camera />
      </AiConsentGate>,
    );

    expect(await screen.findByText("Couldn't reach Scryle.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByText("camera")).toBeNull();
  });
});
