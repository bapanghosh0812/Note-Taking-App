"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { toast } from "@/lib/toast";
import { api, errorMessage, unwrap } from "@/lib/api-client";
import type { Preferences } from "@/lib/preferences";

type Ctx = {
  prefs: Preferences;
  update: (patch: Partial<Preferences>, opts?: { silent?: boolean }) => Promise<void>;
  replace: (next: Preferences) => void;
};

const PreferencesContext = createContext<Ctx | null>(null);

/** Mirrors appearance settings onto <html> so a change is visible instantly. */
function applyToDocument(patch: Partial<Preferences>) {
  const root = document.documentElement;
  if (patch.accent) root.dataset.accent = patch.accent;
  if (patch.fontScale) root.dataset.font = patch.fontScale;
  if (patch.reduceMotion !== undefined) root.dataset.motion = patch.reduceMotion ? "reduce" : "full";
}

export function PreferencesProvider({ initial, children }: { initial: Preferences; children: React.ReactNode }) {
  const [prefs, setPrefs] = useState(initial);

  const update = useCallback(async (patch: Partial<Preferences>, opts?: { silent?: boolean }) => {
    let previous: Preferences | undefined;
    // Optimistic: apply now, roll back if the server refuses.
    setPrefs((p) => {
      previous = p;
      return { ...p, ...patch };
    });
    applyToDocument(patch);
    try {
      const res = await unwrap(api.account.preferences.$patch({ json: patch }));
      setPrefs(res.preferences);
      if (!opts?.silent) toast.success("Preference saved");
    } catch (error) {
      if (previous) {
        setPrefs(previous);
        applyToDocument(previous);
      }
      toast.error(errorMessage(error));
    }
  }, []);

  const replace = useCallback((next: Preferences) => {
    setPrefs(next);
    applyToDocument(next);
  }, []);

  return <PreferencesContext.Provider value={{ prefs, update, replace }}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used inside <PreferencesProvider>");
  return ctx;
}
