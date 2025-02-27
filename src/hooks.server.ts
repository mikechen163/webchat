import { auth } from "$lib/server/auth";
import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.auth = auth.handleRequest(event);
  const session = await event.locals.auth.validate();
  
  event.locals.session = session;
  event.locals.user = session?.user ?? null;

  return await resolve(event);
};