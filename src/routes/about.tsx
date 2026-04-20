import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — ChillSense" },
      {
        name: "description",
        content:
          "Learn how ChillSense helps kitchens, warehouses, and retailers monitor cold storage and reduce food waste.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 pb-20 pt-28 sm:px-6 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-brand">About</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Built for calmer cold-chain operations
          </h1>
          <p className="mt-4 max-w-xl text-muted-foreground">
            ChillSense helps teams monitor temperature and humidity, receive alerts fast, and keep
            inventory rotating safely — with audit-ready logs that support food safety programs.
          </p>

          <dl className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              {
                k: "Real-time monitoring",
                v: "Rooms, freezers, and dry stores in one view.",
              },
              {
                k: "Actionable alerts",
                v: "Tiered severity with clear recommended actions.",
              },
              {
                k: "Expiry tracking",
                v: "FEFO workflows to reduce spoilage and waste.",
              },
              {
                k: "Compliance-friendly",
                v: "Auditable logs aligned with HACCP needs.",
              },
            ].map((i) => (
              <div
                key={i.k}
                className="rounded-2xl border border-border/60 bg-card p-4 shadow-[var(--shadow-soft)]"
              >
                <dt className="text-sm font-semibold text-foreground">{i.k}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">{i.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-[var(--shadow-elevated)]">
          <h2 className="text-lg font-semibold text-foreground">Ready to try it?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create an account or sign in to connect your first room and start collecting readings.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="rounded-xl">
              <Link to="/register">Create account</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-xl">
              <Link to="/login">Login</Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
