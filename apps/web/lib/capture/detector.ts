import type { Detection } from "./frame-check";

export type Detector = {
  /** Finds objects in the current video frame. Boxes are frame-relative (0..1), unmirrored. */
  detect: (video: HTMLVideoElement) => Promise<Detection[]>;
};

let loading: Promise<Detector> | null = null;

/**
 * Loads COCO-SSD (lite MobileNet, ~5 MB) on first use. It runs on the device, so framing
 * checks are free and the camera feed never leaves the phone.
 */
export function loadDetector(): Promise<Detector> {
  loading ??= (async () => {
    const tf = await import("@tensorflow/tfjs-core");
    await import("@tensorflow/tfjs-backend-webgl");
    await tf.setBackend("webgl");
    await tf.ready();
    const coco = await import("@tensorflow-models/coco-ssd");
    const model = await coco.load({ base: "lite_mobilenet_v2" });

    return {
      async detect(video: HTMLVideoElement) {
        const width = video.videoWidth;
        const height = video.videoHeight;
        if (!width || !height) return [];
        const predictions = await model.detect(video, 6, 0.4);
        return predictions.map((p) => ({
          label: p.class,
          score: p.score,
          box: { x: p.bbox[0] / width, y: p.bbox[1] / height, w: p.bbox[2] / width, h: p.bbox[3] / height },
        }));
      },
    };
  })().catch((error: unknown) => {
    loading = null; // allow a retry
    throw error;
  });
  return loading;
}
