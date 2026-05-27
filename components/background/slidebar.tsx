'use client';

import { useState } from "react"
import {
  Menu,
  ChevronLeft,
} from "lucide-react"

import style from '@/styles/sidebar/sidebar.module.css'
import Link from "next/link";
import posthog from "posthog-js";


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

  return (
    <aside
      className={`
        ${style.sidebar}
        ${collapsed ? style.collapsed : ""}
      `}
    >

      {/* HEADER */}
      <div className={style.header}>

        <div className={style.headerContent}>

          {!collapsed && (
            <h1 className={style.logo}>
              {logo}
            </h1>
          )}

          <button
            onClick={() => {
              const next = !collapsed;
              setCollapsed(next);
              posthog.capture('sidebar_toggled', { collapsed: next });
            }}
            className={style.toggleButton}
          >
            {collapsed
              ? <Menu size={18} />
              : <ChevronLeft size={18} />
            }
          </button>

        </div>

      </div>

      {/* MENU */}
      <nav className={style.menu}>

        {items.map((item, index) => {

          const Icon = item.icon

          return (
            <Link
              key={index}
              href={item.label.toLowerCase() === "home" ? "/" : `${item.label.toLowerCase()}`}
              className={style.menuItem}
              onClick={() => posthog.capture('navigation_item_clicked', { label: item.label })}
            >

              <div className={style.icon}>
                <Icon size={24} />
              </div>

              <span className={style.label}>
                {item.label}
              </span>

            </Link>
          )
        })}

      </nav>



    </aside>
  )
}