import { Share } from "react-native";
import { makeShareLink } from "./share";

const mockPostJson = jest.fn();
jest.mock("./api", () => ({ postJson: (...args: unknown[]) => mockPostJson(...args), withTimeout: jest.fn() }));
jest.mock("./builds", () => ({ claimOf: () => ({ claim: {}, token: "t" }) }));
jest.mock("./config", () => ({ API_URL: "https://scryle.test" }));
jest.mock("./use-account", () => ({ account: {} }));
jest.mock("expo-file-system", () => ({ File: jest.fn(), Paths: {} }));
jest.mock("expo-sharing", () => ({ shareAsync: jest.fn() }));

describe("makeShareLink", () => {
  test("returns the new link and leaves opening the share sheet to the screen, so it opens once", async () => {
    const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
    mockPostJson.mockResolvedValueOnce({ status: "ok", data: { id: "abcdefgh23" } });

    const result = await makeShareLink({} as never, { jobId: "j", jobToken: "jt" }, []);

    expect(result).toEqual({ url: "https://scryle.test/b/abcdefgh23" });
    expect(share).not.toHaveBeenCalled();
  });
});
