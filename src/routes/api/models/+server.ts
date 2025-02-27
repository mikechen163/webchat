import { error, json } from "@sveltejs/kit";
import { PrismaClient } from "@prisma/client";
import type { RequestHandler } from "./$types";

const prisma = new PrismaClient();

export const POST: RequestHandler = async ({ request, locals }) => {
  const { user } =  locals.auth;
  if (!user || user.role !== "admin") {
    throw error(403, "Unauthorized");
  }

  const data = await request.json();
  const { name, baseUrl, apiKey, model, enabled } = data;

  if (!name || !baseUrl || !apiKey || !model) {
    throw error(400, "Missing required fields");
  }

  const newModel = await prisma.modelConfig.create({
    data: { name, baseUrl, apiKey, model, enabled }
  });

  // Hide API key in response
  return json({ ...newModel, apiKey: "••••••••" });
};

export const GET: RequestHandler = async () => {
  const models = await prisma.modelConfig.findMany({
    select: {
      id: true,
      name: true,
      model: true,
      enabled: true,
      baseUrl: true
    }
  });

  // Don't expose API keys in response
  return json(models);
};
