import { deliverPurchase } from "./purchases";

const mockSetCredits = jest.fn();
jest.mock("./use-account", () => ({ account: { setCredits: (n: number) => mockSetCredits(n) } }));
jest.mock("./api", () => ({ postJson: jest.fn() }));
jest.mock("expo-constants", () => ({ __esModule: true, default: { executionEnvironment: "standalone" }, ExecutionEnvironment: { StoreClient: "storeClient" } }));

const purchase = { productId: "io.scryapp.credits.starter", purchaseToken: "signed.jws.token" };

describe("deliverPurchase", () => {
  beforeEach(() => mockSetCredits.mockReset());

  test("sends Apple's signed transaction, then finishes it once the swaps are in", async () => {
    const order: string[] = [];
    const send = jest.fn(async () => {
      order.push("send");
      return { status: "ready" as const, data: { credits: 26, added: 25 } };
    });
    const finish = jest.fn(async () => {
      order.push("finish");
    });

    const result = await deliverPurchase(purchase, finish, send);

    expect(send).toHaveBeenCalledWith("signed.jws.token");
    expect(order).toEqual(["send", "finish"]);
    expect(mockSetCredits).toHaveBeenCalledWith(26);
    expect(result).toEqual({ status: "added", added: 25 });
  });

  test("a failed send keeps the transaction unfinished, so it is tried again", async () => {
    const finish = jest.fn();
    const send = jest.fn(async () => ({ status: "error" as const, message: "offline" }));

    const result = await deliverPurchase(purchase, finish, send);

    expect(finish).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "kept", message: "offline" });
  });

  test("a network crash also keeps it unfinished", async () => {
    const finish = jest.fn();
    const send = jest.fn(async () => {
      throw new Error("boom");
    });

    await expect(deliverPurchase(purchase, finish, send)).rejects.toThrow("boom");
    expect(finish).not.toHaveBeenCalled();
  });

  test("ignores other apps' products and purchases with no signed transaction", async () => {
    const send = jest.fn();

    expect(await deliverPurchase({ productId: "com.other.coins", purchaseToken: "x" }, jest.fn(), send)).toBeNull();
    expect(await deliverPurchase({ productId: purchase.productId, purchaseToken: null }, jest.fn(), send)).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  test("the same transaction isn't sent twice at the same time", async () => {
    let release: () => void = () => {};
    const send = jest.fn(
      () => new Promise<{ status: "ready"; data: { credits: number; added: number } }>((r) => (release = () => r({ status: "ready", data: { credits: 1, added: 1 } })))
    );
    const first = deliverPurchase(purchase, jest.fn(), send);

    expect(await deliverPurchase(purchase, jest.fn(), send)).toBeNull();
    release();
    await first;
    expect(send).toHaveBeenCalledTimes(1);
  });
});
