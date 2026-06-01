import Bottleneck from 'bottleneck';

const limiterGroup = new Bottleneck.Group({
  reservoir: 10,
  reservoirRefreshAmount: 10,
  reservoirRefreshInterval: 1000,
  maxConcurrent: 1,
  minTime: 100
});

export async function rateLimitMiddleware(request: Request): Promise<void> {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
  const limiter = limiterGroup.key(ip);

  if (limiter.queued() > 100) {
    throw new Error('Rate limit exceeded');
  }

  await limiter.schedule(() => Promise.resolve());
}
