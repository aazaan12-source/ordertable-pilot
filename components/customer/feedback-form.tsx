"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function FeedbackForm({ orderId }: { orderId: string }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);

  async function submit() {
    const response = await fetch("/api/customer/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, rating, comment })
    });
    if (response.ok) setSent(true);
  }

  if (sent) return <p className="mt-5 rounded-md bg-muted p-3 text-sm">Thank you for your feedback.</p>;

  return (
    <div className="mt-5 rounded-md border p-4">
      <p className="font-semibold">How was your experience?</p>
      <div className="mt-3 flex gap-2">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            onClick={() => setRating(value)}
            className={`h-9 w-9 rounded-md border text-sm font-bold ${rating === value ? "bg-primary text-primary-foreground" : "bg-white"}`}
          >
            {value}
          </button>
        ))}
      </div>
      <Textarea className="mt-3" placeholder="Optional comment" value={comment} onChange={(event) => setComment(event.target.value)} />
      <Button className="mt-3 w-full" variant="outline" onClick={submit}>Send feedback</Button>
    </div>
  );
}
