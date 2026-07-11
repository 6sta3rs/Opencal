"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddBlockModal } from "@/components/blocks/AddBlockModal";

export function AddBlockButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden />
        Dodaj
      </Button>
      <AddBlockModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
