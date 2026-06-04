import Sidebar from "@/components/background/slidebar"
import {
  Home,
  Package,
  Settings,
  User,
} from "lucide-react"

export default function ProfileMenu() {
  return (
    <Sidebar
      logo="Hollow Depths"
      items={[
        { icon: Home, label: "Home" },
        { icon: Package, label: "Inventory" },
        { icon: Settings, label: "Settings" },
        { icon: User, label: "Profile" },
      ]}
    />
  )
}
