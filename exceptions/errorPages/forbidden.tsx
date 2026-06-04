import { ErrorPageShell } from "@/ui/primitives/error-page-shell"

interface ForbiddenErrorPageProps {
  onBackHome?: () => void
}

function ForbiddenErrorPage({ onBackHome }: ForbiddenErrorPageProps) {
  return (
    <ErrorPageShell
      statusCode={403}
      title="Access forbidden"
      message="These ancient halls are sealed by powerful wards. You lack the required permissions to enter this realm."
      action={{
        label: "Return home",
        onClick: onBackHome ?? (() => window.location.href = "/"),
      }}
    />
  )
}

export { ForbiddenErrorPage }
export type { ForbiddenErrorPageProps }
