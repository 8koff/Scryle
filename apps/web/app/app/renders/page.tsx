import type { Metadata } from "next";
import { MyRenders } from "@/components/renders/my-renders";

export const metadata: Metadata = { title: "My pictures" };

export default function RendersPage() {
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
      <div className="mb-6 flex items-baseline justify-between gap-4 border-b border-line pb-4">
        <h1 className="text-[1.5rem] font-semibold tracking-tight">My pictures</h1>
        <p className="text-[13px] text-muted">Kept in your account</p>
      </div>
      <MyRenders />
    </div>
  );
}
