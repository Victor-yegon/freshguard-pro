import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardMock } from "./DashboardMock";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
      {/* background */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{ background: "var(--gradient-hero)" }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-[60rem] bg-[radial-gradient(ellipse_at_top,oklch(0.66_0.16_230/0.18),transparent_60%)]"
      />

      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <ShieldCheck className="h-3.5 w-3.5 text-safe" />
            HACCP-ready monitoring
          </span>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Smart Monitoring for{" "}
            <span className="bg-[var(--gradient-brand)] bg-clip-text text-transparent">
              Safer Food Storage
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Track temperature, prevent spoilage, and protect your inventory in
            real-time — across every cold room, freezer and shelf.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" className="rounded-xl shadow-[var(--shadow-glow)]">
              Get Started
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="rounded-xl">
              Login
            </Button>
          </div>

          <dl className="mt-10 grid max-w-md grid-cols-3 gap-6">
            {[
              { k: "99.9%", v: "Uptime" },
              { k: "<2s", v: "Alert latency" },
              { k: "30%", v: "Less waste" },
            ].map((s) => (
              <div key={s.v}>
                <dt className="text-2xl font-semibold tracking-tight text-foreground">
                  {s.k}
                </dt>
                <dd className="text-xs text-muted-foreground">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
          <DashboardMock />
        </div>
      </div>
    </section>
  );
}
