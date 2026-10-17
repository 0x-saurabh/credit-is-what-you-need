import { getSession } from "@/lib/session";
import { getUser } from "@/lib/users";

// Who is signed in, or nulls. The shape the browser's session hook keeps.
export async function GET() {
  const session = await getSession();
  const user = session ? await getUser(session.userId) : null;
  return Response.json({ userId: session?.userId ?? null, email: user?.email ?? null, name: user?.name ?? null });
}
