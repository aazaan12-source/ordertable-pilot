"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export function ActionMenu({
  label = "Actions",
  children,
  className,
  menuClassName
}: {
  label?: string;
  children: React.ReactNode;
  className?: string;
  menuClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function updatePosition() {
    const button = buttonRef.current;
    const menu = menuRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const menuWidth = menu?.offsetWidth || 224;
    const menuHeight = menu?.offsetHeight || 220;
    const gap = 6;
    const viewportPadding = 8;
    const openUp = rect.bottom + gap + menuHeight > window.innerHeight && rect.top > menuHeight;
    const top = openUp ? rect.top - menuHeight - gap : rect.bottom + gap;
    const left = Math.min(Math.max(viewportPadding, rect.right - menuWidth), window.innerWidth - menuWidth - viewportPadding);
    setPosition({ top: Math.max(viewportPadding, top), left });
  }

  useLayoutEffect(() => {
    if (open) updatePosition();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={cn("flex h-9 w-9 items-center justify-center rounded-md border bg-white text-muted-foreground hover:bg-muted hover:text-foreground", className)}
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open ? (
        <div
          ref={menuRef}
          style={{ top: position.top, left: position.left }}
          className={cn("fixed z-[1000] w-56 rounded-md border bg-white p-2 text-sm shadow-xl", menuClassName)}
          onClick={() => window.setTimeout(() => setOpen(false), 0)}
        >
          {children}
        </div>
      ) : null}
    </>
  );
}
