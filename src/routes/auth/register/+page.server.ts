import { auth } from "$lib/server/auth";
import { fail, redirect } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

export const actions: Actions = {
  default: async ({ request }) => {
    const formData = await request.formData();
    const email = formData.get("email");
    const password = formData.get("password");

    if (
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return fail(400, {
        message: "Invalid input"
      });
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash: hashedPassword,
          role: "user"
        }
      });

      const session = await auth.createSession({
        userId: user.id,
        attributes: {}
      });
      
      const sessionCookie = auth.createSessionCookie(session);
      throw redirect(302, "/chat", {
        headers: {
          "Set-Cookie": sessionCookie.serialize()
        }
      });
    } catch (error) {
      return fail(500, {
        message: "An error occurred while creating your account"
      });
    }
  }
};
