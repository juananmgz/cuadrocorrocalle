interface Env {
  API_ORIGIN: string;
}

interface Context {
  request: Request;
  env: Env;
}

// Cloudflare Pages Function: forwards /api/* to the API so both share one origin.
export async function onRequest({ request, env }: Context): Promise<Response> {
  const { pathname, search } = new URL(request.url);
  const target = new URL(pathname + search, env.API_ORIGIN);
  const forwarded = new Request(target, request);

  // The API rate-limits sign-in attempts per visitor IP.
  forwarded.headers.set('x-client-ip', request.headers.get('cf-connecting-ip') ?? '');

  return fetch(forwarded);
}
