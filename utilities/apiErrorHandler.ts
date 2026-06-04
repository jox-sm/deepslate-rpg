import { NextResponse } from "next/server"
import { classifyError } from "@/utilities/errorHandler"

export function handleApiRouteError(err: unknown, context?: string) {
  const classified = classifyError(err, context)
  console.error(`[API ${context}]`, err)

  const status = classified.statusCode || 500

  return NextResponse.json(
    { success: false, error: classified.message },
    { status: status >= 400 && status < 600 ? status : 500 },
  )
}

export async function tryApiRoute<T>(
  fn: () => Promise<T>,
  context: string,
): Promise<Response> {
  try {
    const data = await fn()
    if (data instanceof Response) return data
    if (data !== undefined && data !== null) {
      return NextResponse.json({ success: true, data })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    return handleApiRouteError(err, context)
  }
}
