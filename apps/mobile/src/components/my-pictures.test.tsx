import { act, fireEvent, render, screen } from "@testing-library/react-native";
import SwapViewer from "@/app/swap/[id]";
import { MyPictures } from "./my-pictures";

const mockRouter = { back: jest.fn(), navigate: jest.fn(), push: jest.fn() };
const mockAccount = { current: { status: "signed-in", userId: "u1", plan: null as object | null } };
const saved = {
  jobId: "job-1",
  pack: "room",
  width: 400,
  height: 300,
  labels: [],
  selections: [],
  canReopen: true,
  createdAt: "2026-10-20T00:00:00Z",
  beforeUrl: "https://scryle.test/before.jpg",
  afterUrl: "https://scryle.test/after.jpg",
  thumbUrl: "",
};

jest.mock("expo-router", () => ({
  // Wrappers: jest.mock runs before this file's consts are set.
  router: {
    back: () => mockRouter.back(),
    navigate: (...args: unknown[]) => mockRouter.navigate(...args),
    push: (...args: unknown[]) => mockRouter.push(...args),
  },
  useFocusEffect: () => {},
  useLocalSearchParams: () => ({ id: "job-1" }),
  Stack: { Screen: () => null },
}));
jest.mock("@/lib/use-account", () => ({ useAccount: () => mockAccount.current }));
jest.mock("@/lib/use-renders", () => ({
  useRenders: () => ({ renders: { status: "ready", data: [] }, reload: jest.fn() }),
  findRender: (id: string) => (id === "job-1" ? saved : undefined),
  pictureSource: (uri: string) => ({ uri }),
}));
jest.mock("@/lib/render", () => ({ trackedRenders: { recover: jest.fn(async () => {}) } }));
jest.mock("@/lib/tracked-renders", () => ({ useTrackedRenders: () => [] }));
jest.mock("@/lib/builds", () => ({ reopenSaved: jest.fn() }));
// The before/after slider is a native gesture view, and the thumbnails and store links animate with
// Reanimated, which doesn't load in Jest; their own screens cover them.
jest.mock("@/components/compare-slider", () => ({ CompareSlider: () => null }));
jest.mock("@/components/swap-thumb", () => ({ SwapThumb: () => null }));
jest.mock("@/components/shop-look", () => ({ ShopLook: () => null }));

beforeEach(() => {
  jest.clearAllMocks();
  mockAccount.current = { status: "signed-in", userId: "u1", plan: null };
});

describe("saved pictures without a plan", () => {
  test("My pictures opens, and its empty state leads back to the plans", async () => {
    await render(<MyPictures edges={[]} />);
    expect(screen.getByText("My pictures")).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByText("See plans")));
    expect(mockRouter.back).toHaveBeenCalled();
    expect(screen.queryByText("Make your first picture")).toBeNull();
  });

  test("with a plan, the empty state starts a new picture", async () => {
    mockAccount.current = { ...mockAccount.current, plan: { tier: "starter" } };
    await render(<MyPictures edges={[]} />);
    expect(screen.getByText("Make your first picture")).toBeTruthy();
  });

  test("a saved picture opens, but Swap more needs a plan", async () => {
    await render(<SwapViewer />);
    expect(screen.getByText("Drag the picture to compare.")).toBeTruthy();
    expect(screen.queryByText("Swap more")).toBeNull();
  });

  test("with a plan, a saved picture offers Swap more", async () => {
    mockAccount.current = { ...mockAccount.current, plan: { tier: "starter" } };
    await render(<SwapViewer />);
    expect(screen.getByText("Swap more")).toBeTruthy();
  });
});
