"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPkTime } from "@/lib/utils";

type WaiterRequest = {
  id: string;
  type: string;
  createdAt: string;
  table: { tableNumber: number };
  order: { orderNumber: string } | null;
};

const storageKey = "ordertable:manager-alerts-enabled";

export function ManagerAlerts() {
  const [enabled, setEnabled] = useState(true);
  const [requests, setRequests] = useState<WaiterRequest[]>([]);
  const [popup, setPopup] = useState<WaiterRequest | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const initialized = useRef(false);
  const audioContext = useRef<AudioContext | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    setEnabled(stored !== "false");
  }, []);

  useEffect(() => {
    loadRequests();
    const timer = window.setInterval(loadRequests, 1000);
    return () => window.clearInterval(timer);
  }, [enabled]);

  async function loadRequests() {
    try {
      const response = await fetch("/api/dashboard/waiter-requests", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json();
      const nextRequests: WaiterRequest[] = payload.requests || [];
      setRequests(nextRequests);

      if (!initialized.current) {
        nextRequests.forEach((request) => seen.current.add(request.id));
        initialized.current = true;
        return;
      }

      const fresh = nextRequests.filter((request) => !seen.current.has(request.id));
      fresh.forEach((request) => seen.current.add(request.id));
      if (fresh.length > 0) {
        const latest = fresh[0];
        setPopup(latest);
        if (enabled) {
          ringBell();
          speakRequest(latest);
        }
      }
    } catch {
      // Orders and request pages already show connection warnings; this alert stays quiet on transient failures.
    }
  }

  function toggleAlerts() {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem(storageKey, String(next));
    if (next) {
      primeAudio();
      ringBell();
    }
  }

  function primeAudio() {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioContext.current = audioContext.current || new AudioContextClass();
      void audioContext.current.resume();
    } catch {
      // Some browsers block audio until user interaction; the visual alert still works.
    }
  }

  function ringBell() {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const context = audioContext.current || new AudioContextClass();
      audioContext.current = context;
      void context.resume();

      [0, 0.18, 0.36].forEach((offset) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.frequency.value = 1046;
        gain.gain.setValueAtTime(0.0001, context.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + offset + 0.14);
        oscillator.start(context.currentTime + offset);
        oscillator.stop(context.currentTime + offset + 0.15);
      });
    } catch {
      // Speech or visual popup may still work.
    }
  }

  function speakRequest(request: WaiterRequest) {
    if (!("speechSynthesis" in window)) return;
    const message =
      request.type === "BILL_REQUEST"
        ? `Bill requested on table number ${request.table.tableNumber}`
        : request.type === "CALL_WAITER"
          ? `Call for waiter on table number ${request.table.tableNumber}`
          : `${request.type.replaceAll("_", " ").toLowerCase()} on table number ${request.table.tableNumber}`;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  }

  const pendingCount = requests.length;
  const popupTitle = useMemo(() => {
    if (!popup) return "";
    if (popup.type === "BILL_REQUEST") return "Bill requested";
    if (popup.type === "CALL_WAITER") return "Call for waiter";
    return popup.type.replaceAll("_", " ");
  }, [popup]);

  return (
    <>
      <div className="no-print fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
        {popup ? (
          <div className="w-[min(360px,calc(100vw-2rem))] rounded-lg border border-orange-300 bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-orange-700">Table {popup.table.tableNumber}</p>
                <h2 className="text-lg font-bold">{popupTitle}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{formatPkTime(popup.createdAt)}</p>
                {popup.order ? <p className="mt-1 text-sm">Order {popup.order.orderNumber}</p> : null}
              </div>
              <button className="rounded-md p-1 hover:bg-muted" onClick={() => setPopup(null)} aria-label="Close alert">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}

        <Button variant={enabled ? "default" : "outline"} onClick={toggleAlerts} className="shadow-lg">
          {enabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          {enabled ? "Bell On" : "Bell Off"}
          {pendingCount > 0 ? <span className="ml-1 rounded bg-white/20 px-1.5">{pendingCount}</span> : null}
        </Button>
      </div>
    </>
  );
}
