import type { LayoutServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";

export const load: LayoutServerLoad = async ({ locals, url }) => {
  const user = locals.auth?.user;
  
  // 调试信息
  // console.log('Layout load, auth state:', {
  //   hasUser: !!user, 
  //   hasSession: !!locals.auth?.session,
  //   path: url.pathname,
  //   host: url.host
  // });

  // 公开路由列表
  const publicRoutes = ["/auth/login", "/auth/register"];
  
  if (!user && !publicRoutes.includes(url.pathname)) {
    console.log('Redirecting to login: No authenticated user');
    throw redirect(302, "/auth/login");
  }

  return {
    user
  };
};
