import { fitWithin, MAX_EDGE } from "./photo";

jest.mock("expo-image-manipulator", () => ({ ImageManipulator: {}, SaveFormat: { JPEG: "jpeg" } }));
jest.mock("expo-file-system", () => ({ File: jest.fn() }));

describe("fitWithin", () => {
  test("leaves a photo that already fits", () => {
    expect(fitWithin(1600, 1200)).toBeNull();
    expect(fitWithin(MAX_EDGE, 1000)).toBeNull();
  });

  test("shrinks the long edge to 2048 and keeps the shape", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 2048, height: 1536 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1536, height: 2048 });
  });
});
