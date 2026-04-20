import { Leaf, ShieldCheck, Wallet, Zap } from "lucide-react";

const benefits = [
  {
    icon: Leaf,
    title: "Reduce food waste",
    body: "Catch issues early and rotate inventory by real expiry risk.",
  },
  {
    icon: ShieldCheck,
    title: "Stay compliant",
    body: "Auditable temperature logs aligned with HACCP requirements.",
  },
  {
    icon: Wallet,
    title: "Save costs",
    body: "Lower spoilage and energy use across your storage network.",
  },
  {
    icon: Zap,
    title: "Decide in real time",
    body: "Sub-second alerts route the right person to the right room.",
  },
];

export function Benefits() {
  return (
    <section id="benefits" className="bg-surface py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand">Benefits</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Built to protect what matters
          </h2>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((b) => (
            <div
              key={b.title}
              className="rounded-3xl border border-border/60 bg-card p-6 shadow-[var(--shadow-soft)] transition-transform duration-300 hover:-translate-y-1"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-safe/10 text-safe">
                <b.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-base font-semibold text-foreground">{b.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
