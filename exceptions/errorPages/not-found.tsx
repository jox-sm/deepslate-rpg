import { ErrorPageShell } from "@/ui/primitives/error-page-shell"

interface NotFoundErrorPageProps {
  onBackHome?: () => void
}

function NotFoundErrorPage({ onBackHome }: NotFoundErrorPageProps) {
  return (
    <ErrorPageShell
      statusCode={404}
      title="Page not found"
      message="The dungeon you seek has crumbled into darkness. This passage no longer exists or has been relocated."
      action={{
        label: "Return to safety",
        onClick: onBackHome ?? (() => window.location.href = "/"),
      }}
    />
  )
}

export { NotFoundErrorPage }
export type { NotFoundErrorPageProps }
