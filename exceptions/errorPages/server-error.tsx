import { ErrorPageShell } from "@/ui/primitives/error-page-shell"

interface ServerErrorPageProps {
  onRetry?: () => void
  onBackHome?: () => void
}

function ServerErrorPage({ onRetry, onBackHome }: ServerErrorPageProps) {
  return (
    <ErrorPageShell
      statusCode={500}
      title="Internal server error"
      message="A dark magic has disturbed the server's balance. Our archmages have been alerted and are working to restore order."
      action={{
        label: "Try again",
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

export { ServerErrorPage }
export type { ServerErrorPageProps }
