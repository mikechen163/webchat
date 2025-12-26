import { json, error } from '@sveltejs/kit';
import { PrismaClient } from '@prisma/client';
import type { RequestHandler } from './$types';

const prisma = new PrismaClient();

// GET /api/mcp-servers/[id] - Get single MCP server details
export const GET: RequestHandler = async ({ params, locals }) => {
    try {
        const { user } = locals.auth || {};
        const isAdmin = user?.role === 'admin';

        const mcpServer = await prisma.mcpServer.findUnique({
            where: { id: params.id },
            select: {
                id: true,
                name: true,
                description: true,
                baseUrl: true,
                apiKey: isAdmin, // Only return apiKey for admin
                transport: true,
                enabled: true,
                isBuiltIn: true,
                tools: true,
                createdAt: true,
                updatedAt: true,
            }
        });

        if (!mcpServer) {
            throw error(404, 'MCP server not found');
        }

        // Non-admin users can only see enabled servers
        if (!isAdmin && !mcpServer.enabled) {
            throw error(404, 'MCP server not found');
        }

        return json({
            ...mcpServer,
            tools: mcpServer.tools ? JSON.parse(mcpServer.tools) : []
        });
    } catch (e: any) {
        if (e.status) throw e;
        console.error('Error fetching MCP server:', e);
        throw error(500, 'Failed to fetch MCP server');
    }
};

// PUT /api/mcp-servers/[id] - Update MCP server (admin only)
export const PUT: RequestHandler = async ({ params, request, locals }) => {
    try {
        const { user } = locals.auth || {};
        if (!user || user.role !== 'admin') {
            throw error(403, 'Admin access required');
        }

        const data = await request.json();

        const mcpServer = await prisma.mcpServer.update({
            where: { id: params.id },
            data: {
                name: data.name?.trim(),
                description: data.description?.trim() ?? undefined,
                baseUrl: data.baseUrl?.trim(),
                apiKey: data.apiKey !== undefined ? (data.apiKey?.trim() || null) : undefined,
                transport: data.transport,
                enabled: data.enabled,
                isBuiltIn: data.isBuiltIn,
                tools: data.tools !== undefined ? JSON.stringify(data.tools) : undefined,
            }
        });

        const { apiKey, ...serverWithoutKey } = mcpServer;
        return json({
            ...serverWithoutKey,
            tools: mcpServer.tools ? JSON.parse(mcpServer.tools) : []
        });
    } catch (e: any) {
        if (e.code === 'P2025') {
            throw error(404, 'MCP server not found');
        }
        if (e.code === 'P2002') {
            return json({ error: 'An MCP server with this name already exists' }, { status: 400 });
        }
        console.error('Error updating MCP server:', e);
        throw error(500, 'Failed to update MCP server');
    }
};

// DELETE /api/mcp-servers/[id] - Delete MCP server (admin only)
export const DELETE: RequestHandler = async ({ params, locals }) => {
    try {
        const { user } = locals.auth || {};
        if (!user || user.role !== 'admin') {
            throw error(403, 'Admin access required');
        }

        await prisma.mcpServer.delete({
            where: { id: params.id }
        });

        return new Response(null, { status: 204 });
    } catch (e: any) {
        if (e.code === 'P2025') {
            throw error(404, 'MCP server not found');
        }
        console.error('Error deleting MCP server:', e);
        throw error(500, 'Failed to delete MCP server');
    }
};
