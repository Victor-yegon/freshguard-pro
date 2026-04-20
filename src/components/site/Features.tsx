import {
  Activity,
  BellRing,
  Building2,
  Brain,
  CalendarClock,
  CloudSun,
} from "lucide-react";

const features = [
  {
    icon: Activity,
    title: "Real-Time Monitoring",
    body: "Continuous temperature and humidity readings streamed from every storage zone.",
  },
  {
    icon: BellRing,
    title: "Smart Alerts",
    body: "Tiered warnings at 10, 30 and 60 minutes so issues never silently escalate.",
  },
  {
    icon: Building2,
    title: "Multi-Room Management",
    body: "Manage cold rooms, freezers and dry stores from a single unified view.",
  },
  {
    icon: Brain,
    title: "Spoilage Prediction",
    body: "AI risk scoring tells you what will spoil first — before it happens.",
  },
  {
    icon: CalendarClock,
    title: "Expiry Tracking",
    body: "Per-product shelf-life and FEFO ordering keeps inventory rotating cleanly.",
  },
  {
    icon: CloudSun,
    title: "Weather Integration",
    body: "Open-Meteo data factored into ambient risk for refrigeration units.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand">
            Features
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Everything you need to keep food safe
          </h2>
          <p className="mt-4 text-muted-foreground">
            From sensor ingestion to actionable alerts — purpose-built for kitchens,
            warehouses and retailers.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-3xl border border-border/60 bg-card p-6 shadow-[var(--shadow-soft)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)]"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/10 text-brand transition-colors group-hover:bg-brand group-hover:text-brand-foreground">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-lg font-semibold text-foreground">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
