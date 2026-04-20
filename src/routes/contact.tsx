import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — ChillSense" },
      {
        name: "description",
        content: "Contact ChillSense for demos, onboarding, and support.",
      },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [status, setStatus] = React.useState<string>("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Thanks! This form is a placeholder. Connect it to your email/helpdesk next.");
  }

  return (
    <main className="mx-auto max-w-4xl px-4 pb-20 pt-28 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold uppercase tracking-wider text-brand">Contact</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Let’s talk
      </h1>
      <p className="mt-4 text-muted-foreground">
        Send a message and we’ll respond with setup help, pricing, or a quick demo.
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-10 rounded-3xl border border-border/60 bg-card p-6 shadow-[var(--shadow-soft)]"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Name</label>
            <Input required placeholder="Your name" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Email</label>
            <Input required type="email" placeholder="you@company.com" />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <label className="text-sm font-medium text-foreground">Message</label>
          <Textarea required rows={6} placeholder="Tell us what you need…" />
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">{status || " "}</p>
          <Button type="submit" className="rounded-xl">
            Send
          </Button>
        </div>
      </form>
    </main>
  );
}
