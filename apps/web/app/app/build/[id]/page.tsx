import type { Metadata } from "next";
import { Studio } from "@/components/studio/studio";

export const metadata: Metadata = { title: "Studio" };

export default async function BuildPage({ params }: PageProps<"/app/build/[id]">) {
  const { id } = await params;
  return <Studio id={id} />;
}
