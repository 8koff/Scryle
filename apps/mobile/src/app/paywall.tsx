import { PlansScreen } from "@/components/plans-screen";

/** The hard paywall: signed in without a plan, this is the app (app/_layout.tsx). */
export default function Paywall() {
  return <PlansScreen mode="gate" />;
}
