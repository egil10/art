"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Quiz } from "@/components/Quiz";
import { CategoryPicker } from "@/components/CategoryPicker";
import { ModePicker } from "@/components/ModePicker";
import type { CategoryKey, GameMode } from "@/lib/paintings";
import { usePaintings } from "@/lib/usePaintings";

const MODE_KEY = "canvas.mode.v1";
const VALID_MODES: GameMode[] = ["painter", "title", "movement", "country", "decade"];

export default function Page() {
  const [category, setCategory] = useState<CategoryKey>("popular");
  const [mode, setMode] = useState<GameMode>("painter");
  const [pickerOpen, setPickerOpen] = useState<"none" | "category" | "mode">("none");
  const { paintings, error, loading } = usePaintings();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = localStorage.getItem(MODE_KEY) as GameMode | null;
    if (v && VALID_MODES.includes(v)) setMode(v);
  }, []);

  function handlePickMode(m: GameMode) {
    setMode(m);
    if (typeof window !== "undefined") localStorage.setItem(MODE_KEY, m);
    setPickerOpen("none");
  }

  return (
    <main className="min-h-dvh">
      {loading && (
        <div className="grid min-h-dvh place-items-center text-ink-muted">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 size={16} className="animate-spin" />
            <span>Loading the gallery…</span>
          </div>
        </div>
      )}
      {error && (
        <div className="grid min-h-dvh place-items-center px-6 text-center">
          <div className="max-w-sm">
            <div className="text-sm font-semibold text-red-700">
              Couldn&rsquo;t load paintings
            </div>
            <div className="mt-1 text-xs text-ink-muted">{error.message}</div>
          </div>
        </div>
      )}
      {paintings && (
        <Quiz
          paintings={paintings}
          category={category}
          mode={mode}
          onChangeCategory={() => setPickerOpen("category")}
          onChangeMode={() => setPickerOpen("mode")}
        />
      )}
      {paintings && pickerOpen === "category" && (
        <CategoryPicker
          paintings={paintings}
          current={category}
          onPick={(c) => {
            setCategory(c);
            setPickerOpen("none");
          }}
          onClose={() => setPickerOpen("none")}
        />
      )}
      {paintings && pickerOpen === "mode" && (
        <ModePicker
          paintings={paintings}
          category={category}
          current={mode}
          onPick={handlePickMode}
          onClose={() => setPickerOpen("none")}
        />
      )}
    </main>
  );
}
