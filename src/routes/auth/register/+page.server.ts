import { auth } from "$lib/server/auth";
import { fail, redirect } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();
const VALID_REGISTRATION_CODE = 'sn123456Qwertyzxc';

export const actions: Actions = {
  default: async ({ cookies, request }) => {
    const formData = await request.formData();
    const email = formData.get("email");
    const password = formData.get("password");
    const registrationCode = formData.get('registrationCode');

    if (
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return fail(400, {
        message: "Invalid input"
      });
    }

    if (registrationCode !== VALID_REGISTRATION_CODE) {
      return fail(400, {
        message: "Invalid registration code"
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

      const session = await auth.createSession(user.id, {});
      const sessionCookie = auth.createSessionCookie(session);
      cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

      throw redirect(303, "/auth/login");
    } catch (error) {
      if (error instanceof Response) {
        throw error; // Rethrow redirect
      }
      console.error('Registration error:', error);
      return fail(500, {
        message: "An error occurred while creating your account"
      });
    }
  }
};
