import { NavLink, Outlet } from "react-router-dom"
import { cn } from "@/lib/utils"

export default function Layout() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "px-3 py-1.5 rounded text-sm font-medium",
      isActive ? "bg-zinc-900 text-white" : "hover:bg-zinc-200",
    )

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="border-b bg-zinc-50 px-6 py-3 flex gap-4 items-center">
        <h1 className="font-semibold mr-6">ImmoCRM</h1>
        <NavLink to="/leads" className={linkClass}>
          Leads
        </NavLink>
        <NavLink to="/contacts" className={linkClass}>
          Kontakte
        </NavLink>
      </nav>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  )
}
