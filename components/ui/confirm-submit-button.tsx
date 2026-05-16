"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function ConfirmSubmitButton({
  children,
  message,
  pendingText = "Working...",
  variant = "destructive",
  size = "sm",
  className
}: {
  children: React.ReactNode;
  message: string;
  pendingText?: string;
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg" | "icon";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={className}
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {pending ? pendingText : children}
    </Button>
  );
}

export function SubmitButton({
  children,
  pendingText = "Saving...",
  variant = "default",
  size = "md",
  className
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg" | "icon";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} className={className} disabled={pending}>
      {pending ? pendingText : children}
    </Button>
  );
}
