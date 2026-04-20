import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { AlertTriangle, Droplets, Thermometer, TriangleAlert } from "lucide-react";

const data = [
  { t: "00", v: 3.8 },
  { t: "02", v: 4.1 },
  { t: "04", v: 4.0 },
  { t: "06", v: 4.4 },
  { t: "08", v: 5.1 },
  { t: "10", v: 4.7 },
  { t: "12", v: 4.3 },
  { t: "14", v: 4.6 },
  { t: "16", v: 5.3 },
  { t: "18", v: 4.9 },
  { t: "20", v: 4.2 },
  { t: "22", v: 4.0 },
];

export function DashboardMock() {
  return (
    <div className="relative">
      {/* glow */}
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-[var(--gradient-brand)] opacity-20 blur-3xl" />

      <div className="rounded-3xl border border-border/60 bg-card p-4 shadow-[var(--shadow-elevated)] sm:p-6">
        {/* top row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            label="Cold Room A"
            value="4.2°C"
            sub="Optimal"
            tone="safe"
            icon={<Thermometer className="h-4 w-4" />}
          />
          <StatCard
            label="Humidity"
            value="62%"
            sub="In range"
            tone="brand"
            icon={<Droplets className="h-4 w-4" />}
          />
          <StatCard
            label="Freezer B"
            value="-12°C"
            sub="Rising"
            tone="warning"
            icon={<TriangleAlert className="h-4 w-4" />}
          />
        </div>

        {/* chart */}
        <div className="mt-4 rounded-2xl border border-border/60 bg-surface p-4">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Temperature · last 24h</p>
              <p className="text-sm font-semibold text-foreground">Cold Room A</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-safe/10 px-2.5 py-1 text-xs font-medium text-safe">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-safe" />
              Live
            </span>
          </div>
          <div className="h-32 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 5, right: 5, left: -28, bottom: 0 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.66 0.16 230)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="oklch(0.66 0.16 230)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="t"
                  tick={{ fontSize: 10, fill: "oklch(0.52 0.025 250)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "oklch(0.52 0.025 250)" }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="oklch(0.66 0.16 230)"
                  strokeWidth={2}
                  fill="url(#g1)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* alerts */}
        <div className="mt-4 rounded-2xl border border-border/60 bg-surface p-4">
          <p className="mb-3 text-xs font-medium text-muted-foreground">Risk Alerts</p>
          <div className="space-y-2">
            <AlertRow tone="warning" title="Dairy shelf trending warm" meta="Room A · 8 min ago" />
            <AlertRow tone="critical" title="Freezer B above threshold" meta="Room B · 2 min ago" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "safe" | "warning" | "critical" | "brand";
  icon: React.ReactNode;
}) {
  const toneClass = {
    safe: "bg-safe/10 text-safe",
    warning: "bg-warning/15 text-warning-foreground",
    critical: "bg-critical/10 text-critical",
    brand: "bg-brand/10 text-brand",
  }[tone];
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-lg ${toneClass}`}>
          {icon}
        </span>
      </div>
      <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function AlertRow({
  tone,
  title,
  meta,
}: {
  tone: "warning" | "critical";
  title: string;
  meta: string;
}) {
  const dot = tone === "critical" ? "bg-critical" : "bg-warning";
  const Icon = tone === "critical" ? AlertTriangle : TriangleAlert;
  const iconCls =
    tone === "critical" ? "text-critical bg-critical/10" : "text-warning-foreground bg-warning/15";
  return (
    <div className="flex items-center gap-3 rounded-xl bg-card p-2.5">
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconCls}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground">{meta}</p>
      </div>
      <span className={`h-2 w-2 rounded-full ${dot}`} />
    </div>
  );
}
