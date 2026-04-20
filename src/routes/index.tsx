import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/site/Navbar";
import { Hero } from "@/components/site/Hero";
import { Features } from "@/components/site/Features";
import { HowItWorks } from "@/components/site/HowItWorks";
import { DashboardPreview } from "@/components/site/DashboardPreview";
import { Benefits } from "@/components/site/Benefits";
import { CtaSection } from "@/components/site/CtaSection";
import { Footer } from "@/components/site/Footer";

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
    <div className="min-h-screen scroll-smooth bg-background text-foreground antialiased">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <DashboardPreview />
        <Benefits />
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
}
