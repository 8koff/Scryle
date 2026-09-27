import { ImageResponse } from "next/og";
import { BrandMark } from "@/lib/brand-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** The iPhone home screen icon. */
export default function AppleIcon() {
  return new ImageResponse(<BrandMark size={size.width} />, size);
}
