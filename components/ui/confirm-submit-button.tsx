"use client";

import { Button } from "@/components/ui/button";

export function ConfirmSubmitButton({
  children,
  message,
  variant = "destructive",
  size = "sm",
  className
}: {
  children: React.ReactNode;
  message: string;
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg" | "icon";
  className?: string;
}) {
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </Button>
  );
}
