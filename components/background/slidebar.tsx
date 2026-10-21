'use client';

import { useState, type ComponentType } from "react"
import {
  Menu,
  ChevronLeft,
} from "lucide-react"
import { UserButton } from "@clerk/nextjs"
import Link from "next/link";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";
import { cn } from "@/lib/utils";

function toHref(label: string): string {
  const slug = label.toLowerCase().replace(/\s+/g, "-")
  return slug === "home" ? "/" : `/${slug}`
}

type SidebarItem = {
  icon: ComponentType<{ size?: number | string; className?: string }>
  label: string
}

type SidebarProps = {
  logo?: string
  items: SidebarItem[]
}

export default function Sidebar({
  logo = "Deepslate",
  items,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col border-r border-border bg-bg-surface",
        collapsed ? "w-[72px]" : "w-60"
      )}
    >
      <div className={cn(
        "flex h-16 items-center border-b border-border",
        collapsed ? "justify-center px-2" : "justify-between px-4"
      )}>
        {!collapsed && (
          <span className="font-display text-lg font-semibold tracking-tight text-text-primary">
            {logo}
          </span>
        )}
        <button
          onClick={() => {
            const next = !collapsed;
            setCollapsed(next);
            posthog.capture('sidebar_toggled', { collapsed: next });
          }}
          className="flex h-8 w-8 items-center justify-center rounded-[10px] text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <Menu size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {items.map((item) => {
          const Icon = item.icon
          const href = toHref(item.label)
          const isActive = pathname === href

          return (
            <Link
              key={item.label}
              href={href}
              onClick={() => posthog.capture('navigation_item_clicked', { label: item.label })}
              title={collapsed ? item.label : undefined}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm transition-colors",
                collapsed && "justify-center px-0",
                isActive
                  ? "bg-bg-elevated font-medium text-text-primary"
                  : "text-text-muted hover:bg-bg-hover hover:text-text-primary"
              )}
            >
              {isActive && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-accent"
                />
              )}
              <Icon size={18} className={cn("shrink-0", isActive ? "text-accent" : undefined)} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center justify-center">
          <UserButton />
        </div>
      </div>
    </aside>
  )
}
