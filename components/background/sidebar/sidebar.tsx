'use client';
import Sidebar from "@/components/background/slidebar"

import {
  Home,
  Package,
  Settings,
  User,
} from "lucide-react"

export default function Sbar() {

  return (
    <div className="flex">

      <Sidebar
        logo="Hollow Depths"
        items={[
          { icon: Home, label: "Home" },
          { icon: Package, label: "Inventory" },
          { icon: Settings, label: "Settings" },
          { icon: User, label: "Profile" },
        ]}
      />

    </div>
  )
}