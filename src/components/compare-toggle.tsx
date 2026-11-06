"use client";

import { GitCompareArrows } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCompare } from "./compare-context";

export function CompareToggle({ id, name, size = "sm" }: { id: string; name: string; size?: "sm" | "default" }) {
  const { has, toggle } = useCompare();
  const selected = has(id);
  return (
    <Button
      variant={selected ? "secondary" : "outline"}
      size={size}
      onClick={() => toggle({ id, name })}
      aria-pressed={selected}
    >
      <GitCompareArrows /> {selected ? "En comparación" : "Comparar"}
    </Button>
  );
}
