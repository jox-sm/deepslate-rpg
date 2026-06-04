import { ErrorPageShell } from "@/ui/primitives/error-page-shell"

interface ServiceUnavailableErrorPageProps {
  onRetry?: () => void
  onBackHome?: () => void
}

function ServiceUnavailableErrorPage({ onRetry, onBackHome }: ServiceUnavailableErrorPageProps) {
  return (
    <ErrorPageShell
      statusCode={503}
      title="Service unavailable"
      message="The realm is temporarily unreachable. The gates will reopen shortly — our sentinels are working on it."
      action={{
        label: "Retry",
        onClick: onRetry ?? (() => window.location.reload()),
      }}
      secondaryAction={{
        label: "Return home",
        variant: "outline",
        onClick: onBackHome ?? (() => window.location.href = "/"),
      }}
    />
  )
}

export { ServiceUnavailableErrorPage }
export type { ServiceUnavailableErrorPageProps }
