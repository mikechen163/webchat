import { auth } from "$lib/server/auth";
import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { redirect } from '@sveltejs/kit';

const prisma = new PrismaClient();

// 如果用户已登录，重定向到聊天页面
export const load: PageServerLoad = async ({ locals }) => {
  if (locals.auth.session) {
    throw redirect(302, "/chat");
  }
  return {};
};

export const actions: Actions = {
  default: async ({ request, locals, cookies }) => {
    const form = await request.formData();
    const email = form.get("email");
    const password = form.get("password");

    if (
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return fail(400, {
        message: "Invalid input"
      });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { email }
      });

      if (!user) {
        return fail(400, {
          message: "Invalid email or password"
        });
      }

      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) {
        return fail(400, {
          message: "Invalid email or password"
        });
      }

      const session = await auth.createSession(
        user.id,
       
        {}
      );

      const sessionCookie = auth.createSessionCookie(session.id);
      cookies.set(sessionCookie.name, sessionCookie.value, { ...sessionCookie.attributes, path: '/' });
      return { success: true }; // Return success instead of redirect
    } catch (error) {
      console.error(error);
      return fail(500, {
        message: "An error occurred while logging in"
      });
    }
  }
};

function redirect(arg0: number, arg1: string) {
  throw new Error("Function not implemented.");
}
