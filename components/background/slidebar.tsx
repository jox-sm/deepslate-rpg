'use client';

import { useState } from "react"
import {
  Menu,
  ChevronLeft,
} from "lucide-react"
import { UserButton } from "@clerk/nextjs"
import Link from "next/link";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";
import { cn } from "@/lib/utils";
import styles from "@/styles/sidebar/sidebar.module.css";

function toHref(label: string): string {
  const slug = label.toLowerCase().replace(/\s+/g, "-")
  return slug === "home" ? "/" : `/${slug}`
}

type SidebarItem = {
  icon: any
  label: string
}

type SidebarProps = {
  logo?: string
  items: SidebarItem[]
}

export default function Sidebar({
  logo = "App",
  items,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(true)
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        styles.sidebar,
        "flex h-screen flex-col",
        collapsed ? styles.collapsed : ""
      )}
    >
      <div className={styles.header}>
        {!collapsed && (
          <h1 className={styles.logo}>{logo}</h1>
        )}
        <button
          onClick={() => {
            const next = !collapsed;
            setCollapsed(next);
            posthog.capture('sidebar_toggled', { collapsed: next });
          }}
          className={styles.toggleButton}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <Menu size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className={cn(styles.menu, "flex-1")}>
        {items.map((item) => {
          const Icon = item.icon
          const href = toHref(item.label)
          const isActive = pathname === href

          return (
            <Link
              key={item.label}
              href={href}
              onClick={() => posthog.capture('navigation_item_clicked', { label: item.label })}
              className={cn(
                styles.menuItem,
                collapsed ? "" : "",
                isActive ? styles.active : ""
              )}
              title={collapsed ? item.label : undefined}
            >
              <div className={styles.icon}>
                <Icon size={20} />
              </div>
              {!collapsed && (
                <span className={styles.label}>{item.label}</span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className={styles.footer}>
        <div className="flex items-center justify-center">
          <UserButton />
        </div>
      </div>
    </aside>
  )
}
