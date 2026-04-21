import { Link } from "@tanstack/react-router";
import { Globe, Mail, Send } from "lucide-react";
import logo from "@/assets/logo.svg";

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-card">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2">
            <div className="flex items-center">
              <img src={logo} alt="FoodSafe Monitor" className="h-12 w-auto object-contain" />
            </div>
            <p className="mt-3 max-w-sm text-sm text-muted-foreground">
              Smart monitoring for safer food storage. Built for kitchens, warehouses and retailers.
            </p>
            <div className="mt-5 flex gap-2">
              {[Send, Mail, Globe].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  aria-label="social"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-surface text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <FooterCol
            title="Company"
            links={[
              { l: "About", h: "/about" },
              { l: "Contact", h: "/contact" },
              { l: "Dashboard", h: "/dashboard" },
            ]}
          />
          <FooterCol
            title="Legal"
            links={[
              { l: "Privacy Policy", h: "/about" },
              { l: "Terms", h: "/about" },
              { l: "Security", h: "/contact" },
            ]}
          />
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-2 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} FoodSafe Monitor. All rights reserved.</p>
          <p>Made for safer cold chains.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { l: string; h: string }[] }) {
  return (
    <div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.l}>
            <Link
              to={l.h}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.l}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
