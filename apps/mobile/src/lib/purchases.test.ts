/* eslint-disable @typescript-eslint/no-require-imports -- Reload module state between native SDK mocks. */
import { previewOffers } from "@retrofit/core";

const mockAccount = { getSnapshot: jest.fn(), refreshCredits: jest.fn() };
const mockSdk = {
  isConfigured: jest.fn(), configure: jest.fn(), logIn: jest.fn(), logOut: jest.fn(),
  getOfferings: jest.fn(), purchasePackage: jest.fn(), restorePurchases: jest.fn(),
  PURCHASES_ERROR_CODE: { PURCHASE_CANCELLED_ERROR: "cancelled" },
};
jest.mock("./config", () => ({ API_URL: "https://example.test", REVENUECAT_IOS_KEY: "test-only-key" }));
jest.mock("./use-account", () => ({ account: mockAccount }));
jest.mock("expo-constants", () => ({ __esModule: true, default: { executionEnvironment: "standalone" }, ExecutionEnvironment: { StoreClient: "storeClient" } }));
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn() }));
jest.mock("react-native-purchases", () => ({ __esModule: true, default: mockSdk }));

const offer = { ...previewOffers()[0]!, pkg: { identifier: "test-package" } };
let purchases: typeof import("./purchases");
beforeEach(() => {
  jest.resetModules();
  jest.resetAllMocks();
  mockSdk.isConfigured.mockResolvedValue(false);
  mockSdk.restorePurchases.mockResolvedValue({ entitlements: { active: { swaps: {} } } });
  mockAccount.getSnapshot.mockReturnValue({ status: "signed-in", userId: "u1", plan: {} });
  mockAccount.refreshCredits.mockResolvedValue(25);
  require("react-native").Platform.OS = "ios";
  purchases = require("./purchases");
});

test("identifies the signed-in account before Apple opens its payment sheet", async () => {
  mockSdk.purchasePackage.mockImplementation(async () => {
    expect(mockSdk.configure).toHaveBeenCalledWith({ apiKey: "test-only-key", appUserID: "u1" });
  });
  expect(purchases.canBuyHere()).toBe(true);
  expect(await purchases.buyPlan(offer)).toEqual({ kind: "active" });
  expect(mockAccount.refreshCredits).toHaveBeenCalledTimes(1);
});

test("a failed account switch never buys against the previous account", async () => {
  mockSdk.isConfigured.mockResolvedValue(true);
  mockSdk.logIn.mockRejectedValue(new Error("offline"));
  const warning = jest.spyOn(console, "warn").mockImplementation(() => {});
  expect(await purchases.buyPlan(offer)).toMatchObject({ kind: "error" });
  expect(mockSdk.purchasePackage).not.toHaveBeenCalled();
  warning.mockRestore();
});

test("signed-out users cannot buy or restore", async () => {
  mockAccount.getSnapshot.mockReturnValue({ status: "signed-out" });
  expect(await purchases.buyPlan(offer)).toMatchObject({ kind: "error" });
  expect(await purchases.restorePlan()).toMatchObject({ kind: "error" });
  expect(mockSdk.purchasePackage).not.toHaveBeenCalled();
  expect(mockSdk.restorePurchases).not.toHaveBeenCalled();
});

test("restores into the current account and waits for the server", async () => {
  expect(await purchases.restorePlan()).toEqual({ kind: "active" });
  expect(mockSdk.configure).toHaveBeenCalledWith({ apiKey: "test-only-key", appUserID: "u1" });
  expect(mockSdk.restorePurchases).toHaveBeenCalledTimes(1);
  expect(mockAccount.refreshCredits).toHaveBeenCalledTimes(1);
});

test("an unrelated entitlement is not a restored Scryle plan", async () => {
  mockSdk.restorePurchases.mockResolvedValue({ entitlements: { active: { other: {} } } });
  expect(await purchases.restorePlan()).toMatchObject({ kind: "error" });
  expect(mockAccount.refreshCredits).not.toHaveBeenCalled();
});

test("Apple confirmation alone does not unlock the app", async () => {
  jest.useFakeTimers();
  try {
    mockAccount.getSnapshot.mockReturnValue({ status: "signed-in", userId: "u1", plan: null });
    const result = purchases.buyPlan(offer);
    await jest.advanceTimersByTimeAsync(30_000);
    expect(await result).toEqual({ kind: "pending" });
  } finally { jest.useRealTimers(); }
});

test("another account's plan cannot confirm a purchase", async () => {
  mockSdk.purchasePackage.mockImplementation(async () => {
    mockAccount.getSnapshot.mockReturnValue({ status: "signed-in", userId: "u2", plan: {} });
  });
  expect(await purchases.buyPlan(offer)).toEqual({ kind: "cancelled" });
  expect(mockAccount.refreshCredits).not.toHaveBeenCalled();
});

test("closing Apple's sheet does not claim a purchase", async () => {
  mockSdk.purchasePackage.mockRejectedValue({ userCancelled: true });
  expect(await purchases.buyPlan(offer)).toEqual({ kind: "cancelled" });
  expect(mockAccount.refreshCredits).not.toHaveBeenCalled();
});
