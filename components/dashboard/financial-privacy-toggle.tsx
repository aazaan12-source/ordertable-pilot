"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

const key = "ordertable:hideFinancials";

export function useHideFinancials() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const load = () => setHidden(localStorage.getItem(key) === "1");
    load();
    window.addEventListener("ordertable-financials", load);
    return () => window.removeEventListener("ordertable-financials", load);
  }, []);
  return hidden;
}

export function FinancialPrivacyToggle() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    setHidden(localStorage.getItem(key) === "1");
  }, []);
  function toggle() {
    const next = !hidden;
    setHidden(next);
    localStorage.setItem(key, next ? "1" : "0");
    window.dispatchEvent(new Event("ordertable-financials"));
  }
  const Icon = hidden ? Eye : EyeOff;
  return (
    <Button type="button" variant="outline" size="sm" onClick={toggle} className="justify-start">
      <Icon className="h-4 w-4" />
      {hidden ? "Show Financials" : "Hide Financials"}
    </Button>
  );
}
