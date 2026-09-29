import { isPackId, PACKS } from "@retrofit/core";
import { SwapHome } from "@/components/app/swap-home";

/** The app's home: start a swap. `?pack=room` opens that category (links from the landing page use it). */
export default async function AppHome({ searchParams }: PageProps<"/app">) {
  const { pack } = await searchParams;
  const initialPack = typeof pack === "string" && isPackId(pack) ? pack : PACKS[0]!.id;
  return <SwapHome initialPack={initialPack} />;
}
