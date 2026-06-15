import { ErrorPageShell } from "@/ui/primitives/error-page-shell"

interface RedisHotnessCacheErrorPageProps {
  onRetry?: () => void
  onBackHome?: () => void
}

function RedisHotnessCacheErrorPage({ onRetry, onBackHome }: RedisHotnessCacheErrorPageProps) {
  return (
    <ErrorPageShell
      statusCode={503}
      title="Cache service unavailable"
      message="The hotness cache service is temporarily unavailable due to Redis connection issues. Our cache wizards are working to restore the service. Please try again in a few moments."
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

export { RedisHotnessCacheErrorPage }
export type { RedisHotnessCacheErrorPageProps }
