import { readSession } from "@/lib/auth";
import { findUserById } from "@/lib/db/repo";

export async function getCurrentUser() {
  const session = await readSession();
  if (!session) return null;
  return await findUserById(session.userId);
}
