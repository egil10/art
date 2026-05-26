"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Quiz } from "@/components/Quiz";
import { CategoryPicker } from "@/components/CategoryPicker";
import type { CategoryKey } from "@/lib/paintings";
import { usePaintings } from "@/lib/usePaintings";

export default function Page() {
  const [category, setCategory] = useState<CategoryKey>("popular");
  const [pickerOpen, setPickerOpen] = useState(false);
  const { paintings, error, loading } = usePaintings();

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
            <div className="text-sm font-semibold text-red-700">Couldn&rsquo;t load paintings</div>
            <div className="mt-1 text-xs text-ink-muted">{error.message}</div>
          </div>
        </div>
      )}
      {paintings && (
        <Quiz
          paintings={paintings}
          category={category}
          onChangeCategory={() => setPickerOpen(true)}
        />
      )}
      {paintings && pickerOpen && (
        <CategoryPicker
          paintings={paintings}
          current={category}
          onPick={(c) => {
            setCategory(c);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </main>
  );
}
