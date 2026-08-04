"use client";

import dynamic from "next/dynamic";

const StudioDashboard = dynamic(
  () => import("@/components/studio-dashboard").then((module) => module.StudioDashboard),
  {
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-[#070707] text-sm text-white/45">
        Loading Studio…
      </div>
    ),
    ssr: false,
  }
);

export function StudioApp() {
  if (process.env.NODE_ENV !== "test") {
    console.info("[shiro:studio]", "Studio loaded");
  }
  return <StudioDashboard />;
}
