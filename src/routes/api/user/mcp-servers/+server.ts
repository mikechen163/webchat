import { json, error } from '@sveltejs/kit';
import { PrismaClient } from '@prisma/client';
import type { RequestHandler } from './$types';

const prisma = new PrismaClient();

// GET /api/user/mcp-servers - Get current user's MCP server selections
export const GET: RequestHandler = async ({ locals }) => {
    try {
        const { user } = locals.auth || {};
        if (!user) {
            throw error(401, 'Authentication required');
        }

        // Get user's MCP server selections with server details
        const userMcpServers = await prisma.userMcpServer.findMany({
            where: { userId: user.id },
            include: {
                mcpServer: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        baseUrl: true,
                        transport: true,
                        enabled: true,
                        tools: true,
                    }
                }
            }
        });

        // Also get all enabled MCP servers that user hasn't selected yet
        const allEnabledServers = await prisma.mcpServer.findMany({
            where: { enabled: true },
            select: {
                id: true,
                name: true,
                description: true,
                baseUrl: true,
                transport: true,
                enabled: true,
                tools: true,
            }
        });

        const selectedIds = new Set(userMcpServers.map(u => u.mcpServerId));

        const result = allEnabledServers.map(server => {
            const userSelection = userMcpServers.find(u => u.mcpServerId === server.id);
            return {
                ...server,
                tools: server.tools ? JSON.parse(server.tools) : [],
                userEnabled: userSelection?.enabled ?? false,
                userMcpServerId: userSelection?.id ?? null,
            };
        });

        return json(result);
    } catch (e: any) {
        if (e.status) throw e;
        console.error('Error fetching user MCP servers:', e);
        throw error(500, 'Failed to fetch MCP servers');
    }
};

// POST /api/user/mcp-servers - Toggle user's MCP server selection
export const POST: RequestHandler = async ({ request, locals }) => {
    try {
        const { user } = locals.auth || {};
        if (!user) {
            throw error(401, 'Authentication required');
        }

        const { mcpServerId, enabled } = await request.json();

        if (!mcpServerId) {
            return json({ error: 'mcpServerId is required' }, { status: 400 });
        }

        // Verify the MCP server exists and is enabled
        const mcpServer = await prisma.mcpServer.findUnique({
            where: { id: mcpServerId }
        });

        if (!mcpServer || !mcpServer.enabled) {
            throw error(404, 'MCP server not found or not enabled');
        }

        // Upsert the user's selection
        const userMcpServer = await prisma.userMcpServer.upsert({
            where: {
                userId_mcpServerId: {
                    userId: user.id,
                    mcpServerId: mcpServerId
                }
            },
            create: {
                userId: user.id,
                mcpServerId: mcpServerId,
                enabled: enabled ?? true
            },
            update: {
                enabled: enabled ?? true
            }
        });

        return json({
            success: true,
            userMcpServer
        });
    } catch (e: any) {
        if (e.status) throw e;
        console.error('Error updating user MCP server selection:', e);
        throw error(500, 'Failed to update MCP server selection');
    }
};
