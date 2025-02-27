import { auth } from "$lib/server/auth";
import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ locals, cookies }) => {
  const session = locals.auth.session;
  if (!session) {
    throw redirect(302, "/auth/login");
  }

  await auth.invalidateSession(session.id);
  const sessionCookie = auth.createBlankSessionCookie();
  cookies.set(sessionCookie.name, sessionCookie.value, {
    ...sessionCookie.attributes,
    path: "/"
  });

  throw redirect(302, "/auth/login");
};
