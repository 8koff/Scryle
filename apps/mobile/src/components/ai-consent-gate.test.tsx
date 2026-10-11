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
jest.mock("@/components/legal-links", () => ({ LegalLinks: () => null }));

const answer = (hasConsented: boolean) => ({ status: "ready", data: { hasConsented, version: 1 } });
const Camera = () => <Text>camera</Text>;

beforeEach(() => {
  resetAiConsent();
  jest.clearAllMocks();
});

describe("AiConsentGate", () => {
  test("before the first scan: explains what is sent and to whom, and hides the camera", async () => {
    mockGetApi.mockResolvedValueOnce(answer(false));
    await render(
      <AiConsentGate>
        <Camera />
      </AiConsentGate>,
    );

    expect(await screen.findByText("Your photo and our AI")).toBeTruthy();
    expect(screen.getByText("Anthropic (Claude)")).toBeTruthy();
    expect(screen.getByText("Higgsfield")).toBeTruthy();
    expect(screen.getByText(/deletes the photo within 30 days/)).toBeTruthy();
    expect(screen.queryByText("camera")).toBeNull();
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
    expect(screen.queryByText("Your photo and our AI")).toBeNull();
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
