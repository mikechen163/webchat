import { json, error } from '@sveltejs/kit';
import { PrismaClient } from '@prisma/client';
import { discoverMcpTools } from '$lib/mcp/adapter';
import type { RequestHandler } from './$types';

const prisma = new PrismaClient();

// GET /api/mcp-servers/[id]/tools - Discover/refresh tools from MCP server
export const GET: RequestHandler = async ({ params, locals }) => {
    try {
        const { user } = locals.auth || {};
        if (!user || user.role !== 'admin') {
            throw error(403, 'Admin access required');
        }

        // Get the MCP server with apiKey
        const mcpServer = await prisma.mcpServer.findUnique({
            where: { id: params.id }
        });

        if (!mcpServer) {
            throw error(404, 'MCP server not found');
        }

        // Discover tools from the MCP server
        const tools = await discoverMcpTools({
            id: mcpServer.id,
            name: mcpServer.name,
            baseUrl: mcpServer.baseUrl,
            apiKey: mcpServer.apiKey,
        });

        // Update the cached tools in database
        await prisma.mcpServer.update({
            where: { id: params.id },
            data: {
                tools: JSON.stringify(tools)
            }
        });

        return json({
            success: true,
            tools,
            message: `Discovered ${tools.length} tools`
        });
    } catch (e: any) {
        if (e.status) throw e;
        console.error('Error discovering MCP tools:', e);
        return json({
            success: false,
            error: e.message || 'Failed to discover tools',
            tools: []
        }, { status: 500 });
    }
};
