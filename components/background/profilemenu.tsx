import Sidebar from "@/components/background/slidebar"
import style from "@/styles/sidebar/sidebar.module.css";

import {
  Home,
  Package,
  Settings,
  User,
} from "lucide-react"

export default function profilemenu() {

  return (
    <div className={style.sidebarWrapper}>

      <Sidebar
        logo="Hollow Depths"
        items={[
          { icon: Home, label: "Home" },
          { icon: Package, label: "Inventory" },
          { icon: Settings, label: "Settings" },
          { icon: User, label: "Profile" },
        ]}
      />

      <main className={style.sidebarWrapper}>
        Main Content
      </main>

    </div>
  )
}