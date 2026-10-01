import AsyncStorage from "@react-native-async-storage/async-storage";
import { checkRender, forgetPending, MAX_POLLS, rememberPending, resumePendingRenders, waitForRender } from "./render";
import { reloadRenders } from "./use-renders";

jest.mock("@react-native-async-storage/async-storage", () =>
  // jest.mock factories run before imports, so the library's own mock is loaded with require.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("./api", () => ({
  postJson: jest.fn(),
  withTimeout: (run: (signal: AbortSignal) => Promise<unknown>) => run(new AbortController().signal),
}));
jest.mock("./use-renders", () => ({ reloadRenders: jest.fn() }));
jest.mock("./config", () => ({ API_URL: "https://example.test" }));

const answer = (data: unknown) => Promise.resolve(new Response(JSON.stringify({ success: true, data })));
const noWait = () => Promise.resolve();

describe("checkRender", () => {
  test("asks the right address and reads a finished render", async () => {
    const fetcher = jest.fn(() => answer({ status: "completed", imageUrl: "https://cdn.test/a.jpg" }));

    const end = await checkRender("job-1", "tok/1", fetcher as unknown as typeof fetch);

    expect(fetcher).toHaveBeenCalledWith("https://example.test/api/render/job-1?t=tok%2F1", expect.objectContaining({ signal: expect.anything() }));
    expect(end).toEqual({ status: "done", imageUrl: "https://cdn.test/a.jpg" });
  });

  test("still running, or a network blink, is null", async () => {
    expect(await checkRender("j", "t", (() => answer({ status: "in_progress" })) as unknown as typeof fetch)).toBeNull();
    expect(await checkRender("j", "t", (() => Promise.reject(new Error("offline"))) as unknown as typeof fetch)).toBeNull();
  });

  test("the safety filter has its own message", async () => {
    const end = await checkRender("j", "t", (() => answer({ status: "nsfw" })) as unknown as typeof fetch);
    expect(end).toEqual({ status: "failed", message: "That swap was blocked by the safety filter." });
  });
});

describe("waitForRender", () => {
  test("polls until the render finishes", async () => {
    const fetcher = jest
      .fn()
      .mockImplementationOnce(() => answer({ status: "queued" }))
      .mockImplementationOnce(() => answer({ status: "completed", imageUrl: "https://cdn.test/b.jpg" }));

    const end = await waitForRender("j", "t", new AbortController().signal, noWait, fetcher as unknown as typeof fetch);

    expect(end).toEqual({ status: "done", imageUrl: "https://cdn.test/b.jpg" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  test("gives up after the poll limit", async () => {
    const fetcher = jest.fn(() => answer({ status: "queued" }));

    const end = await waitForRender("j", "t", new AbortController().signal, noWait, fetcher as unknown as typeof fetch);

    expect(end).toEqual({ status: "timeout" });
    expect(fetcher).toHaveBeenCalledTimes(MAX_POLLS);
  });

  test("stops when the screen closes", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = jest.fn();

    await waitForRender("j", "t", controller.signal, noWait, fetcher as unknown as typeof fetch);

    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("pending renders", () => {
  beforeEach(() => AsyncStorage.clear());

  const savedIds = async () =>
    (JSON.parse((await AsyncStorage.getItem("retrofit:pending-renders")) ?? "[]") as { jobId: string }[]).map((p) => p.jobId);

  test("remembers and forgets", async () => {
    await rememberPending("job-a", "ta");
    await rememberPending("job-b", "tb");
    await forgetPending("job-b");

    expect(await savedIds()).toEqual(["job-a"]);
  });

  test("drops finished ones, keeps running ones, and reloads My swaps", async () => {
    jest.useFakeTimers();
    await rememberPending("job-done", "t1");
    await rememberPending("job-running", "t2");
    const fetcher = jest.fn((url: string) =>
      url.includes("job-done") ? answer({ status: "completed", imageUrl: "https://cdn.test/c.jpg" }) : answer({ status: "in_progress" }),
    );

    await resumePendingRenders(fetcher as unknown as typeof fetch);
    jest.runAllTimers();
    jest.useRealTimers();

    expect(await savedIds()).toEqual(["job-running"]);
    expect(reloadRenders).toHaveBeenCalled();
  });

  test("an unknown job (404) is dropped instead of asked about forever", async () => {
    await rememberPending("job-gone", "t");
    const fetcher = jest.fn(() => Promise.resolve(new Response(JSON.stringify({ success: false, error: "Unknown render." }), { status: 404 })));

    await resumePendingRenders(fetcher as unknown as typeof fetch);

    expect(await savedIds()).toEqual([]);
  });
});
