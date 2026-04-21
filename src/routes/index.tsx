import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/components/site/Hero";
import { Features } from "@/components/site/Features";
import { HowItWorks } from "@/components/site/HowItWorks";
import { DashboardPreview } from "@/components/site/DashboardPreview";
import { Benefits } from "@/components/site/Benefits";
import { CtaSection } from "@/components/site/CtaSection";
import { PublicLayout } from "@/components/layouts/PublicLayout";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FoodSafe Monitor — Smart Monitoring for Safer Food Storage" },
      {
        name: "description",
        content:
          "Track temperature, prevent spoilage and protect inventory in real-time with FoodSafe Monitor smart food storage monitoring.",
      },
      {
        property: "og:title",
        content: "FoodSafe Monitor — Smart Monitoring for Safer Food Storage",
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
    <PublicLayout>
      <Hero />
      <Features />
      <HowItWorks />
      <DashboardPreview />
      <Benefits />
      <CtaSection />
    </PublicLayout>
  );
}
