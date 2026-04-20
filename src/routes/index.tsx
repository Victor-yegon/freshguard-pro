import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/components/site/Hero";
import { Features } from "@/components/site/Features";
import { HowItWorks } from "@/components/site/HowItWorks";
import { DashboardPreview } from "@/components/site/DashboardPreview";
import { Benefits } from "@/components/site/Benefits";
import { CtaSection } from "@/components/site/CtaSection";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ChillSense — Smart Monitoring for Safer Food Storage" },
      {
        name: "description",
        content:
          "Track temperature, prevent spoilage and protect inventory in real-time with ChillSense smart food storage monitoring.",
      },
      {
        property: "og:title",
        content: "ChillSense — Smart Monitoring for Safer Food Storage",
      },
      {
        property: "og:description",
        content:
          "Real-time temperature, humidity and spoilage risk monitoring for kitchens, warehouses and retailers.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <main>
      <Hero />
      <Features />
      <HowItWorks />
      <DashboardPreview />
      <Benefits />
      <CtaSection />
    </main>
  );
}
