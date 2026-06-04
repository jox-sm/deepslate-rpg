import { ErrorPageShell } from "@/ui/primitives/error-page-shell"

interface GeneralErrorPageProps {
  statusCode?: number
  title?: string
  message?: string
  onRetry?: () => void
  onBackHome?: () => void
}

function GeneralErrorPage({
  statusCode = 0,
  title = "Something went wrong",
  message = "An unexpected disturbance in the weave of reality has occurred. Our mages are investigating.",
  onRetry,
  onBackHome,
}: GeneralErrorPageProps) {
  return (
    <ErrorPageShell
      statusCode={statusCode}
      title={title}
      message={message}
      action={
        onRetry
          ? { label: "Try again", onClick: onRetry }
          : undefined
      }
      secondaryAction={{
        label: "Return home",
        variant: "outline",
        onClick: onBackHome ?? (() => window.location.href = "/"),
      }}
    />
  )
}

export { GeneralErrorPage }
export type { GeneralErrorPageProps }
