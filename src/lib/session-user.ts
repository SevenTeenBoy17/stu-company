import { readSession } from "@/lib/auth";
import { findUserById } from "@/lib/store";

export async function getCurrentUser() {
  const session = await readSession();
  if (!session) return null;
  return findUserById(session.userId);
}
