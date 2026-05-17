"use client";

import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";

export function NetworkStatus() {
  const [online, setOnline] = useState(true);
  const [recentlyRestored, setRecentlyRestored] = useState(false);

  useEffect(() => {
    const sync = () => {
      const nextOnline = navigator.onLine;
      setOnline(nextOnline);
      if (nextOnline) {
        window.dispatchEvent(new Event("ordertable-network-online"));
        setRecentlyRestored(true);
        window.setTimeout(() => setRecentlyRestored(false), 2500);
      }
    };

    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (online && !recentlyRestored) return null;

  return (
    <div className={`no-print fixed left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-lg ${online ? "bg-green-600 text-white" : "bg-destructive text-destructive-foreground"}`}>
      {online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
      {online ? "Connection restored. Reconnecting..." : "Internet offline. Orders will reconnect automatically."}
    </div>
  );
}
