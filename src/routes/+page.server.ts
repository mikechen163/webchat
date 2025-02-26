import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load = (async ({ locals }) => {
  if (!locals.auth) {
    throw redirect(302, "/auth/login");
  }
  
  try {
    // 确保使用 validate() 而不是 validateUser()
    const session = await locals.auth.validate();
    if (session) {
      throw redirect(302, "/chat");
    }
  } catch (error) {
    console.error("Auth validation error:", error);
    // 重定向到登录页面
  }
  
  throw redirect(302, "/auth/login");
}) satisfies PageServerLoad;