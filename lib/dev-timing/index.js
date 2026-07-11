export async function withDevTiming(request, handler) {
  const startedAt = Date.now();
  try {
    return await handler();
  } finally {
    if (process.env.NODE_ENV === 'development') {
      const pathname = new URL(request.url).pathname;
      console.info(`${request.method} ${pathname} Response Time: ${Date.now() - startedAt} ms`);
    }
  }
}
