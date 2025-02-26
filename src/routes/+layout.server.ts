import type { LayoutServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";

export const load: LayoutServerLoad = async ({ locals, url }) => {
  const user = locals.auth?.user;

  // 公开路由列表
  const publicRoutes = ["/auth/login", "/auth/register"];
  
  if (!user && !publicRoutes.includes(url.pathname)) {
    throw redirect(302, "/auth/login");
  }

  return {
    user
  };
};
