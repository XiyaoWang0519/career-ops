"use client";

import { Send, MonitorOff } from "lucide-react";
import { ApplyView } from "@/components/apply-view";
import { ApplyBackdropMount } from "@/components/apply/apply-backdrop-mount";
import { useRuntime } from "@/components/runtime-provider";
import Link from "next/link";

export default function ApplyPage() {
  const { local, loaded } = useRuntime();

  if (loaded && !local) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <MonitorOff className="mx-auto size-8 text-muted" />
        <h1 className="mt-4 font-display text-2xl tracking-tight text-landing">Apply works on this computer only</h1>
        <p className="mt-2 text-sm text-muted">
          Applying opens a browser window on the machine running career-ops — you can&apos;t see or control it from here.
          Evaluate roles and generate CVs remotely; apply when you&apos;re at the host machine.
        </p>
        <Link href="/pipeline" className="mt-6 inline-block text-sm text-brand hover:underline">
          Back to Pipeline
        </Link>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      {/* full-viewport blurred form wallpaper (behind everything) */}
      <ApplyBackdropMount />
      <div className="relative z-10 mx-auto max-w-3xl px-6 py-8">
        <div className="flex items-center gap-3">
          <Send className="size-6 text-brand" />
          <h1 className="font-display text-2xl tracking-tight text-landing">Apply</h1>
        </div>
        <p className="mt-1.5 max-w-xl text-sm text-muted">
          career-ops reads the real application form on your machine and re-renders it here in plain language, pre-filled
          from your CV. You verify every answer — then it fills the real form behind the scenes and you submit it yourself.
          It never submits for you.
        </p>
        <div className="mt-6">
          <ApplyView />
        </div>
      </div>
    </div>
  );
}
