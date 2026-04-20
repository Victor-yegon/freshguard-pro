import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CtaSection() {
  return (
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div
          className="relative overflow-hidden rounded-[2rem] border border-border/60 p-10 text-center shadow-[var(--shadow-elevated)] sm:p-16"
          style={{ background: "var(--gradient-brand)" }}
        >
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(1_0_0/0.25),transparent_60%)]"
          />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-primary-foreground sm:text-4xl">
              Start monitoring your storage smarter today.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80">
              Set up your first room in minutes. No hardware required to start —
              run in simulation mode.
            </p>
            <div className="mt-8 flex justify-center">
              <Button
                size="lg"
                variant="secondary"
                className="rounded-xl bg-card text-foreground hover:bg-card/90"
              >
                Create Account
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
