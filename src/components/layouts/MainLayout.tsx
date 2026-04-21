import { type ReactNode, useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import logo from "@/assets/logo.svg";

type MainLayoutProps = {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  sidebarContent?: ReactNode;
  children: ReactNode;
};

export function MainLayout({ title, subtitle, actions, sidebarContent, children }: MainLayoutProps) {
  const navigate = useNavigate();
  const [userLabel, setUserLabel] = useState("User");

  useEffect(() => {
    let active = true;

    async function loadUser() {
      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!active) return;

        const user = session?.user;
        if (!user) {
          setUserLabel("User");
          return;
        }

        const fullNameFromMeta =
          typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "";
        setUserLabel(fullNameFromMeta || user.email || "User");
      } catch {
        if (!active) return;
        setUserLabel("User");
      }
    }

    loadUser();
    return () => {
      active = false;
    };
  }, []);

  async function signOut() {
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
    } catch {
      // no-op
    }
    await navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside className="border-b border-border/60 bg-card p-4 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r lg:p-6">
          <Link to="/" className="mb-6 inline-flex items-center">
            <img src={logo} alt="FoodSafe Monitor" className="h-14 w-auto object-contain" />
          </Link>
          {sidebarContent ? <div className="mt-6 space-y-3">{sidebarContent}</div> : null}
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {actions}
                <div className="rounded-xl border border-border/60 bg-card px-3 py-2 text-sm text-foreground">
                  {userLabel}
                </div>
                <Button type="button" variant="outline" className="rounded-xl" onClick={signOut}>
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </div>
            </div>
          </header>

          <div className="flex-1 p-4 sm:p-6 lg:p-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
