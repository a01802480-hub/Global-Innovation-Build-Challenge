"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/workspace", label: "Overview" },
  { href: "/workspace/structure", label: "Structure" },
  { href: "/workspace/comparative", label: "Comparative" },
  { href: "/workspace/variants", label: "Variants" },
];

/** Floating glass workspace bar — sticky, blurred, always 0.3s+ transitions. */
export function WorkspaceNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-4 z-40 mx-auto w-full max-w-6xl px-4">
      <nav className="glass-card flex items-center gap-1 px-3 py-2" aria-label="Workspace navigation">
        <Link href="/" className="mr-3 flex items-baseline gap-2 px-2 py-1.5">
          <span className="text-base font-semibold tracking-tight text-frost">BioStream</span>
          <span className="hidden text-[10px] tracking-[0.2em] text-mist/60 uppercase sm:inline">
            workspace
          </span>
        </Link>
        <div className="flex flex-1 items-center gap-1 overflow-x-auto">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap transition-colors duration-300 ease-out ${
                  active
                    ? "bg-white/10 font-medium text-frost"
                    : "text-mist hover:bg-white/5 hover:text-frost"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
        <Link href="/" className="px-3 py-1.5 text-sm text-mist transition-colors duration-300 ease-out hover:text-frost">
          ← Landing
        </Link>
      </nav>
    </header>
  );
}
