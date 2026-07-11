"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, CalendarDays, Clock, PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react";
import { ChatWidget } from "@/components/chat/ChatWidget";

const NAV_ITEMS = [
  { href: "/", label: "Planner", Icon: CalendarDays },
  { href: "/wpis-czasu", label: "Wpis czasu", Icon: Clock },
  { href: "/dostepnosc", label: "Dostępność", Icon: CalendarClock },
];

// ponytail: "Ustawienia" nie ma jeszcze strony (Faza 2) — statyczna,
// wyłączona pozycja nawigacji zamiast martwego linku. Renderowana osobno,
// przypięta do dołu szyny (patrz mt-auto niżej), nie w głównej liście.
const SETTINGS_ITEM = { label: "Ustawienia", Icon: Settings };

// Chrome aplikacji w stylu Cal.com: stała, ciemna szyna nawigacji po lewej +
// obszar treści po prawej. Zastępuje dawny Topbar — nagłówki stron (tytuł,
// opis, akcje) żyją teraz w komponentach poszczególnych stron.
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-full gap-2 p-2">
      <nav className={`flex shrink-0 flex-col transition-[width] duration-200 ${collapsed ? "w-14" : "w-56"}`}>
        <div className={`flex items-center gap-2 px-4 py-5 ${collapsed ? "justify-center px-2" : "justify-between"}`}>
          {!collapsed && (
            <span className="truncate text-h3 font-h3 font-semibold text-text-primary">Kalendarz</span>
          )}
          {/* Ten sam styl przycisku co przełącznik sidebaru
              (components/sidebar/PlannerSidebar.tsx) — teraz z ikoną lucide-react
              zamiast znaków "«"/"»". */}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Rozwiń nawigację" : "Zwiń nawigację"}
            aria-expanded={!collapsed}
            className="rounded-sm border border-border p-1 text-text-secondary hover:text-text-primary"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" aria-hidden /> : <PanelLeftClose className="h-4 w-4" aria-hidden />}
          </button>
        </div>

        <ul className="flex flex-col gap-0.5 px-2">
          {NAV_ITEMS.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? label : undefined}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-body transition-colors ${
                    collapsed ? "justify-center px-0" : ""
                  } ${
                    active
                      ? "bg-border text-text-primary"
                      : "text-text-secondary hover:bg-border/50 hover:text-text-primary"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {!collapsed && label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Ustawienia na dole szyny: mt-auto pcha tę jedną pozycję do
            spodu, nad stopką, zamiast siedzieć zaraz pod resztą linków. */}
        <ul className="mt-auto flex flex-col gap-0.5 px-2 pb-2">
          <li>
            <span
              aria-disabled="true"
              title={collapsed ? SETTINGS_ITEM.label : undefined}
              className={`flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-body text-text-secondary opacity-50 ${
                collapsed ? "justify-center px-0" : ""
              }`}
            >
              <SETTINGS_ITEM.Icon className="h-4 w-4 shrink-0" aria-hidden />
              {!collapsed && SETTINGS_ITEM.label}
            </span>
          </li>
        </ul>

        {!collapsed && (
          <div className="border-t border-border px-4 py-3 text-caption font-caption text-text-secondary">
            Kalendarz — MVP
          </div>
        )}
      </nav>

      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border bg-bg-secondary">
        {children}
      </div>

      {/* Pływający dymek czatu AI — globalny, widoczny na każdej stronie
          (patrz components/chat/ChatWidget.tsx). */}
      <ChatWidget />
    </div>
  );
}
