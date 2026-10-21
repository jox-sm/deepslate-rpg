import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="container-page py-8">
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-text-muted">Manage your account and preferences.</p>
      </div>
      <div className="dungeon-card mt-6 max-w-2xl divide-y divide-border p-2">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-medium text-text-primary">Profile</p>
            <p className="text-xs text-text-muted">Name, avatar, and sign-in details.</p>
          </div>
          <Link href="/profile" className="rounded-[10px] border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary">
            Open
          </Link>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-medium text-text-primary">Adventures</p>
            <p className="text-xs text-text-muted">Forge worlds and manage your codex.</p>
          </div>
          <Link href="/inventory" className="rounded-[10px] border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary">
            Open
          </Link>
        </div>
      </div>
    </div>
  );
}
