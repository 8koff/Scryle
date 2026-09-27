import { ImageResponse } from "next/og";
import { BrandMark } from "@/lib/brand-mark";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/** Tab icon and the Android home screen icon. */
export default function Icon() {
  return new ImageResponse(<BrandMark size={size.width} />, size);
}
