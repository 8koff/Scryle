import type { PackId } from "@retrofit/core";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { createBuild } from "./builds";
import type { Photo } from "./photo";
import { scanPhoto } from "./scan";

/**
 * Sends a photo to be read (a paid call), then opens the studio in place of this screen.
 * Returns an error message to show, or null once the studio is opening (or the screen is gone).
 */
export function useScan() {
  // A ref, not state: two taps in the same frame must not send two paid scans.
  const isScanning = useRef(false);
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return async (pack: PackId, photo: Photo, isAdultConfirmed: boolean): Promise<string | null> => {
    if (isScanning.current) return null;
    isScanning.current = true;
    const result = await scanPhoto(pack, photo, isAdultConfirmed);
    isScanning.current = false;
    // Gone from this screen: don't jump to the studio from wherever the person is now.
    if (!isMounted.current) return null;
    if (result.status === "error") return result.message;
    const build = createBuild(pack, photo.uri, result.data);
    router.replace({ pathname: "/studio/[id]", params: { id: build.id } });
    return null;
  };
}
