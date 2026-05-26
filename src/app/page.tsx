"use client";

import { useState } from "react";
import { Quiz } from "@/components/Quiz";
import { CategoryPicker } from "@/components/CategoryPicker";
import type { CategoryKey } from "@/lib/paintings";

export default function Page() {
  const [category, setCategory] = useState<CategoryKey | null>(null);

  return (
    <main className="min-h-dvh">
      {category === null ? (
        <CategoryPicker onPick={setCategory} />
      ) : (
        <Quiz category={category} onChangeCategory={() => setCategory(null)} />
      )}
    </main>
  );
}
