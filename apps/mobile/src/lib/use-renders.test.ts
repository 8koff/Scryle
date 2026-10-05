import type { RenderCard } from "@retrofit/core";
import { findRender, reloadRenders, resetRenders, thumbSource } from "./use-renders";

const mockGetApi = jest.fn();
jest.mock("./api", () => ({ getApi: (...args: unknown[]) => mockGetApi(...args) }));

const card = (jobId: string): RenderCard => ({
  jobId,
  pack: "room",
  width: 3,
  height: 4,
  labels: ["Green sofa"],
  selections: [],
  canReopen: true,
  createdAt: "2026-09-28T00:00:00Z",
  beforeUrl: "https://example.test/before.jpg",
  afterUrl: "https://example.test/after.jpg",
  thumbUrl: "https://example.test/thumb.jpg",
});

describe("thumbSource", () => {
  test("uses the small preview, cached under its own key", () => {
    expect(thumbSource(card("job-1"))).toEqual({ uri: "https://example.test/thumb.jpg", cacheKey: "thumb-job-1" });
  });

  test("falls back to the full picture when there is no preview yet", () => {
    expect(thumbSource({ ...card("job-1"), thumbUrl: "" })).toEqual({ uri: "https://example.test/after.jpg", cacheKey: "after-job-1" });
  });
});

describe("reloadRenders", () => {
  beforeEach(() => {
    resetRenders();
    mockGetApi.mockReset();
  });

  test("reads the list from the { renders } field the server sends", async () => {
    mockGetApi.mockResolvedValueOnce({ status: "ready", data: { renders: [card("job-1")] } });

    await reloadRenders();

    expect(mockGetApi).toHaveBeenCalledWith("/api/renders");
    expect(findRender("job-1")?.labels).toEqual(["Green sofa"]);
  });

  test("a failed reload keeps the list already loaded", async () => {
    mockGetApi.mockResolvedValueOnce({ status: "ready", data: { renders: [card("job-1")] } });
    await reloadRenders();
    mockGetApi.mockResolvedValueOnce({ status: "error", message: "offline" });

    await reloadRenders();

    expect(findRender("job-1")).toBeDefined();
  });

  test("sign-out clears the list", async () => {
    mockGetApi.mockResolvedValueOnce({ status: "ready", data: { renders: [card("job-1")] } });
    await reloadRenders();

    resetRenders();

    expect(findRender("job-1")).toBeUndefined();
  });
});
