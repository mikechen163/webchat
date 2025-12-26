import { json, error } from '@sveltejs/kit';
import { PrismaClient } from '@prisma/client';
import type { RequestHandler } from './$types';

const prisma = new PrismaClient();

// GET /api/mcp-servers - List all MCP servers
// Admin sees all, regular users see only enabled ones
export const GET: RequestHandler = async ({ locals }) => {
    try {
        const { user } = locals.auth || {};
        const isAdmin = user?.role === 'admin';

        const mcpServers = await prisma.mcpServer.findMany({
            where: isAdmin ? {} : { enabled: true },
            select: {
                id: true,
                name: true,
                description: true,
                baseUrl: true,
                command: true,
                args: true,
                transport: true,
                enabled: true,
                isBuiltIn: true,
                tools: true,
                createdAt: true,
                updatedAt: true,
                // Don't return apiKey for security
            },
            orderBy: { name: 'asc' }
        });

        // Parse tools JSON string to array for each server
        const serversWithParsedTools = mcpServers.map(server => ({
            ...server,
            tools: server.tools ? JSON.parse(server.tools) : []
        }));

        return json(serversWithParsedTools);
    } catch (e) {
        console.error('Error fetching MCP servers:', e);
        throw error(500, 'Failed to fetch MCP servers');
    }
};

// POST /api/mcp-servers - Create a new MCP server (admin only)
export const POST: RequestHandler = async ({ request, locals }) => {
    try {
        const { user } = locals.auth || {};
        if (!user || user.role !== 'admin') {
            throw error(403, 'Admin access required');
        }

        const data = await request.json();

        // Validate required fields based on transport
        if (!data.name) {
            return json({ error: 'Name is required' }, { status: 400 });
        }
        if (data.transport === 'stdio') {
            if (!data.command) {
                return json({ error: 'Command is required for Stdio transport' }, { status: 400 });
            }
        } else {
            if (!data.baseUrl) {
                return json({ error: 'Base URL is required for HTTP/WS transport' }, { status: 400 });
            }
        }

        const mcpServer = await prisma.mcpServer.create({
            data: {
                name: data.name.trim(),
                description: data.description?.trim() || null,
                baseUrl: data.baseUrl?.trim() || '',
                command: data.command?.trim() || null,
                args: data.args?.trim() || null,
                apiKey: data.apiKey?.trim() || null,
                transport: data.transport || 'http',
                enabled: data.enabled ?? true,
                isBuiltIn: data.isBuiltIn ?? false,
                tools: data.tools ? JSON.stringify(data.tools) : null,
            }
        });

        // Don't return apiKey
        const { apiKey, ...serverWithoutKey } = mcpServer;
        return json({
            ...serverWithoutKey,
            tools: mcpServer.tools ? JSON.parse(mcpServer.tools) : []
        });
    } catch (e: any) {
        console.error('Error creating MCP server:', e);
        if (e.code === 'P2002') {
            return json({ error: 'An MCP server with this name already exists' }, { status: 400 });
        }
        throw error(500, 'Failed to create MCP server');
    }
};
