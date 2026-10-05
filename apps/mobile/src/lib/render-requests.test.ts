import { createRenderRequests, type RenderIntent, type RenderRequestDeps } from "./render-requests";

const intent: RenderIntent = {
  claim: { pack: "room", photoUrl: "https://example.test/photo.jpg", width: 3, height: 4, scene: { subject: "room", parts: [] } },
  token: "test-photo-proof",
  selections: [{ partId: "wall-colour", productId: "room-wall-colour-sage-green-matte-paint" }],
};
const id = "62cde81a-c140-491a-8c36-48d3c31e0a68";
const started = { jobId: "test-job", jobToken: "test-job-proof", costUsd: 0.03, requestId: id };

function harness() {
  const saved = new Map<string, string>();
  let owner: string | null = "user-a";
  const storage = {
    getItem: jest.fn(async (key: string) => saved.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { saved.set(key, value); }),
  };
  const getStatus = jest.fn<ReturnType<RenderRequestDeps["getStatus"]>, Parameters<RenderRequestDeps["getStatus"]>>(async () => ({ status: "ready", data: { requestId: id, state: "missing" } }));
  const post = jest.fn<ReturnType<RenderRequestDeps["post"]>, Parameters<RenderRequestDeps["post"]>>(async () => ({ status: "ready", data: started }));
  const checkJob = jest.fn<ReturnType<RenderRequestDeps["checkJob"]>, Parameters<RenderRequestDeps["checkJob"]>>(async () => null);
  const deps = { storage, owner: () => owner, newId: () => id, fingerprint: async (input: RenderIntent) => JSON.stringify(input), getStatus, post, checkJob, onSettled: jest.fn() };
  return { ...deps, saved, switchOwner: (next: string | null) => { owner = next; }, make: () => createRenderRequests(deps) };
}

test("persists before sending and returns the same accepted job for a retry", async () => {
  const h = harness();
  const queue = h.make();
  h.post.mockImplementation(async () => {
    expect(h.saved.size).toBe(1);
    return { status: "ready", data: started };
  });
  expect(await queue.start(intent, "Room")).toEqual({ status: "ready", data: started });
  expect(await queue.start(intent, "Room")).toEqual({ status: "ready", data: started });
  expect(h.post).toHaveBeenCalledTimes(1);
  expect(h.post).toHaveBeenCalledWith({ ...intent, requestId: id });
});

test("recovers after process restart and lost response without another POST", async () => {
  const h = harness();
  h.post.mockRejectedValueOnce(new Error("lost response"));
  expect((await h.make().start(intent, "Room")).status).toBe("error");
  h.getStatus.mockResolvedValue({ status: "ready", data: { requestId: id, state: "finished", result: { success: true, data: started } } });
  const restarted = h.make();
  await restarted.recover();
  expect(restarted.snapshot("user-a")[0]?.state).toBe("running");
  expect(await restarted.start(intent, "Room")).toEqual({ status: "ready", data: started });
  expect(h.post).toHaveBeenCalledTimes(1);
});

test("a missing request can be resent explicitly with the same ID", async () => {
  const h = harness();
  h.post.mockRejectedValueOnce(new Error("offline"));
  const queue = h.make();
  await queue.start(intent, "Room");
  await queue.recover();
  expect(h.post).toHaveBeenCalledTimes(1);
  await queue.start(intent, "Room");
  expect(h.post).toHaveBeenCalledTimes(2);
  expect(h.post.mock.calls[1]?.[0]).toMatchObject({ requestId: id });
});

test("storage failure prevents paid work", async () => {
  const h = harness();
  h.storage.setItem.mockRejectedValue(new Error("disk full"));
  expect((await h.make().start(intent, "Room")).status).toBe("error");
  expect(h.post).not.toHaveBeenCalled();
});

test("corrupt recovery data fails closed instead of silently starting fresh", async () => {
  const h = harness();
  h.storage.getItem.mockResolvedValue("not-json");
  expect((await h.make().start(intent, "Room")).status).toBe("error");
  expect(h.post).not.toHaveBeenCalled();
});

test("an old server without recovery support is never sent a paid request", async () => {
  const h = harness();
  h.getStatus.mockResolvedValue({ status: "error", message: "Not found" });
  expect((await h.make().start(intent, "Room")).status).toBe("error");
  expect(h.post).not.toHaveBeenCalled();
});

test("does not show or recover another account's pending requests", async () => {
  const h = harness();
  const queue = h.make();
  await queue.start(intent, "Room");
  h.switchOwner("user-b");
  await queue.recover();
  expect(queue.snapshot("user-b")).toEqual([]);
  expect(h.checkJob).not.toHaveBeenCalled();
});

test("sign-out during capability checking prevents a POST under another account", async () => {
  const h = harness();
  h.getStatus.mockImplementation(async () => {
    h.switchOwner("user-b");
    return { status: "ready", data: { requestId: id, state: "missing" } };
  });
  expect((await h.make().start(intent, "Room")).status).toBe("error");
  expect(h.post).not.toHaveBeenCalled();
});

test("concurrent taps share one operation", async () => {
  const h = harness();
  const queue = h.make();
  await Promise.all([queue.start(intent, "Room"), queue.start(intent, "Room")]);
  expect(h.post).toHaveBeenCalledTimes(1);
});

test("marks terminal jobs and refreshes saved swaps", async () => {
  const h = harness();
  const queue = h.make();
  await queue.start(intent, "Room");
  h.checkJob.mockResolvedValue({ status: "done", imageUrl: "https://example.test/after.jpg" });
  await queue.recover();
  expect(queue.snapshot("user-a")[0]?.state).toBe("ready");
  expect(h.onSettled).toHaveBeenCalled();
});

test("a late recovery response cannot move a completed swap back to running", async () => {
  const h = harness();
  h.post.mockRejectedValueOnce(new Error("lost response"));
  const queue = h.make();
  await queue.start(intent, "Room");
  let release!: () => void;
  let checking!: () => void;
  const began = new Promise<void>((resolve) => { checking = resolve; });
  h.getStatus.mockImplementationOnce(async () => {
    checking();
    await new Promise<void>((resolve) => { release = resolve; });
    return { status: "ready", data: { requestId: id, state: "finished", result: { success: true, data: started } } };
  });
  const recovery = queue.recover();
  await began;
  h.getStatus.mockResolvedValue({ status: "ready", data: { requestId: id, state: "finished", result: { success: true, data: started } } });
  await queue.start(intent, "Room");
  await queue.finishJob(started.jobId, { status: "done", imageUrl: "https://example.test/after.jpg" });
  release();
  await recovery;
  expect(queue.snapshot("user-a")[0]?.state).toBe("ready");
});

test("pending server requests are read without resubmission, including repeated fresh taps", async () => {
  const h = harness();
  h.getStatus.mockResolvedValue({ status: "ready", data: { requestId: id, state: "pending" } });
  const queue = h.make();
  expect(await queue.start(intent, "Room")).toMatchObject({ status: "error", code: "render_pending" });
  await queue.start(intent, "Room", true);
  await queue.recover();
  expect(h.post).not.toHaveBeenCalled();
  expect(queue.snapshot("user-a")).toHaveLength(1);
});

test("server rejections are terminal and do not repeatedly poll", async () => {
  const h = harness();
  h.getStatus.mockResolvedValue({ status: "ready", data: { requestId: id, state: "finished", result: { success: false, code: "no_credits", error: "Out of swaps" } } });
  const queue = h.make();
  expect(await queue.start(intent, "Room")).toMatchObject({ status: "error", code: "no_credits" });
  await queue.recover();
  expect(queue.snapshot("user-a")[0]).toMatchObject({ state: "failed", message: "Out of swaps" });
  expect(h.getStatus).toHaveBeenCalledTimes(1);
  expect(h.post).not.toHaveBeenCalled();
});

test("an unrecognised start response remains recoverable instead of accepting an unbound job", async () => {
  const h = harness();
  h.post.mockResolvedValue({ status: "ready", data: { ...started, requestId: undefined } });
  const queue = h.make();
  expect(await queue.start(intent, "Room")).toMatchObject({ status: "error", code: "render_pending" });
  expect(queue.snapshot("user-a")[0]).toMatchObject({ state: "checking" });
});

test("a signed-out session never starts or recovers a swap", async () => {
  const h = harness();
  h.switchOwner(null);
  const queue = h.make();
  expect(await queue.start(intent, "Room")).toMatchObject({ status: "error", code: "sign_in" });
  await queue.recover();
  await queue.finishJob(started.jobId, { status: "timeout" });
  expect(h.storage.getItem).not.toHaveBeenCalled();
  expect(h.post).not.toHaveBeenCalled();
  expect(queue.snapshot(null)).toEqual([]);
});

test("timeout keeps the job recoverable and a later failure refreshes the account", async () => {
  const h = harness();
  const queue = h.make();
  await queue.start(intent, "Room");
  await queue.finishJob(started.jobId, { status: "timeout" });
  expect(queue.snapshot("user-a")[0]?.state).toBe("running");
  await queue.finishJob(started.jobId, { status: "failed", message: "Blocked by safety filter" });
  expect(queue.snapshot("user-a")[0]).toMatchObject({ state: "failed", message: "Blocked by safety filter" });
  expect(h.onSettled).toHaveBeenCalledTimes(1);
});
