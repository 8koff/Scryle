import { render, screen } from "@testing-library/react-native";
import { PlanCard } from "./plan-card";

const plan = { tier: "starter", period: "monthly", swapsPerMonth: 25, expiresAt: "2026-12-01T00:00:00Z", willRenew: true, hasBillingIssue: false };
const mockAccount = { current: { status: "signed-in", userId: "u1", credits: 20, plan: { ...plan, store: "app_store" } } as object };

jest.mock("@/lib/purchases", () => ({ manageSubscription: jest.fn() }));
jest.mock("@/lib/use-account", () => ({ useAccount: () => mockAccount.current }));
jest.mock("expo-router", () => ({ router: { back: jest.fn() } }));

describe("PlanCard", () => {
  test("offers Manage for a plan someone pays for", async () => {
    mockAccount.current = { status: "signed-in", userId: "u1", credits: 20, plan: { ...plan, store: "app_store" } };
    await render(<PlanCard />);
    expect(screen.getByText("Manage")).toBeTruthy();
  });

  test("a free promotional plan has no billing, so no Manage link to a closed website page", async () => {
    // App Review's demo account has one; Manage would open the website's account page.
    mockAccount.current = { status: "signed-in", userId: "u1", credits: 20, plan: { ...plan, store: "promotional" } };
    await render(<PlanCard />);
    expect(screen.queryByText("Manage")).toBeNull();
    expect(screen.getByText(/20/)).toBeTruthy();
  });
});
