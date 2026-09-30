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

  return fetch(new Request(target, request));
}
