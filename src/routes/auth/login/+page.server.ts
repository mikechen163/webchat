import { auth } from "$lib/server/auth";
import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

// 如果用户已登录，重定向到聊天页面
export const load: PageServerLoad = async ({ locals }) => {
  if (locals.auth.session) {
    throw redirect(302, "/chat");
  }
  return {};
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
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

      // Get current timestamp in milliseconds
      const now = Date.now();
      // Set expiry times - 24 hours for active, 7 days for idle
      const active_expires = BigInt(now + 24 * 60 * 60 * 1000);
      const idle_expires = BigInt(now + 7 * 24 * 60 * 60 * 1000);

      const session = await auth.createSession({
        userId: user.id,
        attributes: {},
        active_expires,
        idle_expires
      });

      locals.auth.setSession(session);
      
      const sessionCookie = auth.createSessionCookie(session);
      throw redirect(302, "/chat", {
        headers: {
          "Set-Cookie": sessionCookie.serialize()
        }
      });
    } catch (error) {
      console.error(error);
      return fail(500, {
        message: "An error occurred while logging in"
      });
    }
  }
};
