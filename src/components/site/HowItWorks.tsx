import { Boxes, Gauge, BellRing } from "lucide-react";

const steps = [
  {
    icon: Boxes,
    title: "Add Products & Rooms",
    body: "Define your storage zones and the products inside them with safe ranges.",
  },
  {
    icon: Gauge,
    title: "Monitor Conditions",
    body: "Live readings from sensors and weather feeds compared against thresholds.",
  },
  {
    icon: BellRing,
    title: "Get Alerts & Act",
    body: "Targeted notifications with severity, source and recommended action.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="bg-surface py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand">How it works</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            From sensor to action in three steps
          </h2>
        </div>

        <div className="relative mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* connector line */}
          <div
            aria-hidden
            className="absolute left-0 right-0 top-12 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block"
          />
          {steps.map((s, i) => (
            <div
              key={s.title}
              className="relative rounded-3xl border border-border/60 bg-card p-6 text-center shadow-[var(--shadow-soft)]"
            >
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--gradient-brand)] text-primary-foreground shadow-[var(--shadow-glow)]">
                <s.icon className="h-5 w-5" />
              </span>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Step {i + 1}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-foreground">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
