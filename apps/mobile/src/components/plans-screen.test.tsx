import { previewOffers } from "@retrofit/core";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { PlansScreen } from "./plans-screen";

const mockLoadOffers = jest.fn();
const mockBuyPlan = jest.fn();
const mockAccount = { current: { status: "signed-in", userId: "u1", email: "a@example.test", plan: null as object | null } };
const mockOpenBrowser = jest.fn();

jest.mock("@/lib/purchases", () => ({
  loadOffers: () => mockLoadOffers(),
  buyPlan: (...args: unknown[]) => mockBuyPlan(...args),
  restorePlan: jest.fn(),
}));
jest.mock("@/lib/use-account", () => ({ useAccount: () => mockAccount.current }));
jest.mock("expo-router", () => ({ router: { back: jest.fn(), push: jest.fn() } }));
jest.mock("expo-web-browser", () => ({ openBrowserAsync: (url: string) => mockOpenBrowser(url) }));
jest.mock("@/lib/config", () => ({ API_URL: "https://scryle.test" }));

const ready = { status: "ready", offers: previewOffers().map((o) => ({ ...o, pkg: { identifier: o.productId } })) };

beforeEach(() => {
  jest.clearAllMocks();
  mockAccount.current = { status: "signed-in", userId: "u1", email: "a@example.test", plan: null };
});

describe("PlansScreen", () => {
  test("when the plans can't load, Try again loads them once more", async () => {
    mockLoadOffers.mockResolvedValueOnce({ status: "unavailable", message: "Couldn't reach the App Store." }).mockResolvedValueOnce(ready);
    await render(<PlansScreen mode="gate" />);
    expect(await screen.findByText("Couldn't reach the App Store.")).toBeTruthy();

    await act(async () => fireEvent.press(screen.getByText("Try again")));

    expect(await screen.findByText(/Subscribe to Pro/)).toBeTruthy();
    expect(screen.queryByText("Try again")).toBeNull();
    expect(mockLoadOffers).toHaveBeenCalledTimes(2);
  });

  test("a plan billed on the website is changed there, never bought again through Apple", async () => {
    mockAccount.current = { ...mockAccount.current, plan: { tier: "starter", period: "monthly", store: "rc_billing" } };
    mockLoadOffers.mockResolvedValueOnce(ready);
    await render(<PlansScreen mode="sheet" />);

    const button = await screen.findByText("Billed on the website");
    fireEvent.press(button);
    expect(mockBuyPlan).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText("Manage on the website"));
    expect(mockOpenBrowser).toHaveBeenCalledWith("https://scryle.test/app/account");
  });

  test("an Apple plan can still be changed here", async () => {
    mockAccount.current = { ...mockAccount.current, plan: { tier: "starter", period: "monthly", store: "app_store" } };
    mockLoadOffers.mockResolvedValueOnce(ready);
    await render(<PlansScreen mode="sheet" />);

    expect(await screen.findByText("This is your plan")).toBeTruthy();
    fireEvent.press(screen.getByLabelText(/^Pro:/));
    expect(await screen.findByText(/Switch to Pro/)).toBeTruthy();
    expect(screen.queryByText("Manage on the website")).toBeNull();
  });
});
