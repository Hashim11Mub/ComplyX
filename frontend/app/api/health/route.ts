const BACKEND_URL = process.env.BACKEND_URL;

export async function GET() {
  if (!BACKEND_URL) {
    return Response.json({ status: "offline", indexed_articles: 0, ready: false }, { status: 200 });
  }
  try {
    const res = await fetch(`${BACKEND_URL}/health`, {
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(String(res.status));
    return Response.json(await res.json());
  } catch {
    return Response.json({ status: "offline", indexed_articles: 0, ready: false }, { status: 200 });
  }
}
