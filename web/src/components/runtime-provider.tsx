"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type RuntimeFlags = {
  defaultCli: string | null;
  pinned: boolean;
  simple: boolean;
  local: boolean;
  authEnabled: boolean;
  loaded: boolean;
};

const DEFAULTS: RuntimeFlags = {
  defaultCli: null,
  pinned: false,
  simple: false,
  local: true,
  authEnabled: false,
  loaded: false,
};

const Ctx = createContext<RuntimeFlags>(DEFAULTS);

export function useRuntime() {
  return useContext(Ctx);
}

/** Fetches server-pinned flags once (default CLI, simple nav, local vs remote). */
export function RuntimeProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<RuntimeFlags>(DEFAULTS);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/runtime")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) {
          if (!cancelled) setFlags((f) => ({ ...f, loaded: true }));
          return;
        }
        setFlags({
          defaultCli: d.defaultCli || null,
          pinned: !!d.pinned,
          simple: !!d.simple,
          local: d.local !== false,
          authEnabled: !!d.authEnabled,
          loaded: true,
        });
      })
      .catch(() => {
        if (!cancelled) setFlags((f) => ({ ...f, loaded: true }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <Ctx.Provider value={flags}>{children}</Ctx.Provider>;
}
