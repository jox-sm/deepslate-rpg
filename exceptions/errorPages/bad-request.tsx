import { ErrorPageShell } from "@/ui/primitives/error-page-shell"

interface BadRequestErrorPageProps {
  onBackHome?: () => void
}

function BadRequestErrorPage({ onBackHome }: BadRequestErrorPageProps) {
  return (
    <ErrorPageShell
      statusCode={400}
      title="Bad request"
      message="The incantation you spoke was garbled. Please check your input and try again."
      action={{
        label: "Go back",
        onClick: () => window.history.back(),
      }}
      secondaryAction={{
        label: "Return home",
        variant: "outline",
        onClick: onBackHome ?? (() => window.location.href = "/"),
      }}
    />
  )
}

export { BadRequestErrorPage }
export type { BadRequestErrorPageProps }
