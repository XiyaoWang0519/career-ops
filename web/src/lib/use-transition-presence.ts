"use client";

import { useCallback, useEffect, useState } from "react";

type ModalPhase = "opening" | "open" | "closing";

function cssDuration(name: string, fallback: number): number {
  const value = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isFinite(value) ? value : fallback;
}

export function modalPhaseClass(phase: ModalPhase): string {
  return phase === "open" ? "is-open" : phase === "closing" ? "is-closing" : "";
}

export function useTransitionPresence(visible: boolean) {
  const [mounted, setMounted] = useState(visible);
  const [phase, setPhase] = useState<ModalPhase>(visible ? "open" : "opening");

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setPhase("opening");
      const frame = requestAnimationFrame(() => setPhase("open"));
      return () => cancelAnimationFrame(frame);
    }

    if (!mounted) return;
    setPhase("closing");
    const timer = window.setTimeout(() => setMounted(false), cssDuration("--modal-close-dur", 150));
    return () => window.clearTimeout(timer);
  }, [visible, mounted]);

  return { mounted, phaseClass: modalPhaseClass(phase) };
}

export function useTransitionClose(onClose: () => void) {
  const [phase, setPhase] = useState<ModalPhase>("opening");

  useEffect(() => {
    const frame = requestAnimationFrame(() => setPhase("open"));
    return () => cancelAnimationFrame(frame);
  }, []);

  const close = useCallback(() => {
    setPhase("closing");
    window.setTimeout(onClose, cssDuration("--modal-close-dur", 150));
  }, [onClose]);

  return { close, phaseClass: modalPhaseClass(phase) };
}
