import { Link } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useIsAdmin, useSession } from "@/hooks/use-admin";
import { supabase } from "@/integrations/supabase/client";

const links = [
  { to: "/", label: "Home" },
  { to: "/characters", label: "Characters" },
  { to: "/orgs", label: "Orgs & Bloodlines" },
  { to: "/timeline", label: "Timeline" },
] as const;

export function SiteNav() {
  const isAdmin = useIsAdmin();
  const { data: user } = useSession();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("scu-theme") === "dark";
    setDark(saved);
    document.documentElement.classList.toggle("dark", saved);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("scu-theme", next ? "dark" : "light");
  };

  return (
    <nav className="fixed inset-x-0 top-4 z-40 flex justify-center px-3">
      <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full border bg-card/85 px-2 py-1.5 backdrop-blur-md">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            activeProps={{ className: "bg-secondary text-foreground" }}
            activeOptions={{ exact: l.to === "/" }}
          >
            {l.label}
          </Link>
        ))}
        {isAdmin && (
          <Link
            to="/ingest"
            className="whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium text-accent hover:text-foreground"
            activeProps={{ className: "bg-secondary" }}
          >
            Ingest
          </Link>
        )}
        {user ? (
          <button
            onClick={() => supabase.auth.signOut()}
            className="whitespace-nowrap rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Sign out
          </button>
        ) : (
          <Link to="/auth" className="whitespace-nowrap rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
            Admin
          </Link>
        )}
        <button
          onClick={toggle}
          aria-label="Toggle day and night"
          className="ml-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-foreground transition-transform hover:rotate-12"
        >
          {dark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
        </button>
      </div>
    </nav>
  );
}
