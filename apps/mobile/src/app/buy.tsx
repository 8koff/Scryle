import { PlansScreen } from "@/components/plans-screen";

/** Changing plan, opened from the app (Home's pill, Account). The hard paywall is app/paywall.tsx. */
export default function Buy() {
  return <PlansScreen mode="sheet" />;
}
