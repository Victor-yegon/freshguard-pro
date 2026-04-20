import { DashboardMock } from "./DashboardMock";

const badges = [
  { label: "Live Data", tone: "safe" },
  { label: "AI Insights", tone: "brand" },
  { label: "Risk Alerts", tone: "critical" },
] as const;

export function DashboardPreview() {
  return (
    <section id="dashboard" className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-brand">
              The dashboard
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Every cold chain, one calm view
            </h2>
            <p className="mt-4 max-w-lg text-muted-foreground">
              Temperature, humidity, weather context, products at risk and active
              alerts — all visible at a glance, drill-down on demand.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {badges.map((b) => (
                <span
                  key={b.label}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                    b.tone === "safe"
                      ? "bg-safe/10 text-safe"
                      : b.tone === "brand"
                        ? "bg-brand/10 text-brand"
                        : "bg-critical/10 text-critical"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      b.tone === "safe"
                        ? "bg-safe"
                        : b.tone === "brand"
                          ? "bg-brand"
                          : "bg-critical"
                    }`}
                  />
                  {b.label}
                </span>
              ))}
            </div>

            <ul className="mt-8 space-y-3 text-sm text-foreground">
              {[
                "Per-room temperature & humidity cards",
                "Open-Meteo weather context",
                "Status indicators by product",
                "Active alerts & history",
                "24h trend charts",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand" />
                  <span className="text-muted-foreground">{t}</span>
                </li>
              ))}
            </ul>
          </div>

          <DashboardMock />
        </div>
      </div>
    </section>
  );
}
