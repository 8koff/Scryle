import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  isConfigured: vi.fn(), configure: vi.fn(), getSharedInstance: vi.fn(),
  getAppUserId: vi.fn(), changeUser: vi.fn(), getCustomerInfo: vi.fn(),
}));
vi.mock("@revenuecat/purchases-js", () => ({ Purchases: sdk }));

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_REVENUECAT_WEB_KEY", "test-only-key");
  sdk.isConfigured.mockReturnValue(true);
  sdk.getSharedInstance.mockReturnValue(sdk);
  sdk.getAppUserId.mockReturnValue("u1");
});

describe("subscription management", () => {
  it("sends Apple subscribers to Apple's cancellation page", async () => {
    const { subscriptionManagementUrl } = await import("./subscribe");
    expect(await subscriptionManagementUrl("u1", "app_store")).toBe("https://apps.apple.com/account/subscriptions");
    expect(sdk.getCustomerInfo).not.toHaveBeenCalled();
  });

  it("uses the signed-in customer's web billing portal", async () => {
    sdk.getAppUserId.mockReturnValueOnce("previous").mockReturnValue("u1");
    sdk.getCustomerInfo.mockResolvedValue({ managementURL: "https://billing.example.test/customer" });
    const { subscriptionManagementUrl } = await import("./subscribe");
    expect(await subscriptionManagementUrl("u1", "rc_billing")).toBe("https://billing.example.test/customer");
    expect(sdk.changeUser).toHaveBeenCalledWith("u1");
  });

  it.each([null, "javascript:alert(1)", "http://billing.example.test/customer"])("does not navigate to an absent or unsafe portal: %s", async (managementURL) => {
    sdk.getCustomerInfo.mockResolvedValue({ managementURL });
    const { subscriptionManagementUrl } = await import("./subscribe");
    expect(await subscriptionManagementUrl("u1", "rc_billing")).toBeNull();
  });
});
