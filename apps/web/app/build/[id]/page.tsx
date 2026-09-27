import type { Metadata } from "next";
import { BRAND } from "@retrofit/core";
import { Studio } from "@/components/studio/studio";

export const metadata: Metadata = { title: `Studio · ${BRAND.name}`, robots: { index: false } };

export default async function BuildPage({ params }: PageProps<"/build/[id]">) {
  const { id } = await params;
  return <Studio id={id} />;
}
