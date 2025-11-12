我们先制定一个详细的修改方案来支持用户自定义的 MCP 服务器管理。目标:1. 允许管理员在系统管理界面通过 JSON 配置和管理 MCP
  服务器（增、删、改、查、激活）。
   2. 在聊天时，如果用户配置了 MCP 服务器，将其信息上报给 LLM。
   3. 移除或绕过当前硬编码的 server/mcp_server.py，支持用户自定义插件。

  修改方案:

  1. 数据库模型变更 (Prisma Schema):
   * 新增 MCP Server 模型: *   在 prisma/schema.prisma 中添加一个新的模型 McpServerConfig。
       * 字段建议:  `id`: `String @id @default(cuid())`    name: String - 服务器名称。           `transport`: `String` - 传输方式，如
         "stdio", "http", "websocket"。           command: String? - 如果是 stdio，指定启动命令（如 python /path/to/mcp_server.py）。
           * baseUrl: String? - 如果是 http 或 websocket，指定基础 URL。
           * apiKey: String? - 可选的 API 密钥。    `config`: `Json?` - 用于存储其他特定配置的 JSON 对象。    isActive: Boolean
             @default(false) - 是否为当前激活的 MCP服务器。 *   createdAt: DateTime @default(now())
           * updatedAt: DateTime @updatedAt   关联到用户偏好:       可以考虑在 UserPreference 模型中添加一个 mcpServerId 字段，关联到
             McpServerConfig，以允许用户选择默认的 MCP 服务器。2. 后端 API 路由 (`src/routes/api/mcp-server`):
   * 创建新目录: src/routes/api/mcp-server。
   * 实现 CRUD API:    * GET /api/mcp-server: 获取所有 MCP服务器配置列表。
       * POST /api/mcp-server: 创建新的 MCP 服务器配置。        * 验证管理员权限。
           * 接收 JSON 请求体，包含上述所有字段。 *   创建配置并保存到数据库。
       * GET /api/mcp-server/[id]: 获取单个 MCP服务器配置详情。  `PATCH /api/mcp-server/[id]`: 更新 MCP服务器配置。
         验证管理员权限。        *   更新指定字段。
       * DELETE /api/mcp-server/[id]: 删除 MCP 服务器配置。         验证管理员权限。
         检查是否为激活状态，如果是则不允许删除或需要先停用。
       * POST /api/mcp-server/[id]/activate: 激活指定的 MCP服务器。
           * 验证管理员权限。    将其他所有 MCP 服务器的 `isActive` 设置为 `false`。    将指定服务器的 isActive 设置为 true。

  3. 修改聊天逻辑 (`src/routes/api/chat/[id]/+server.ts`):
   * 获取激活的 MCP 配置:    * 在调用 callMcpProvider之前，查询数据库获取 isActive: true 的 McpServerConfig。
   * 修改 `callMcpProvider` 调用:
       * 当前代码中的 callMcpProvider(modelConfig.provider, mcpMessages) 需要调整。
       * 传入的 modelConfig.provider 需要能区分是调用内置的硬编码 MCP 服务器，还是用户自定义的 MCP 服务器。       可以添加一个新的
         `provider.type` 值，例如 `'custom-mcp'`。       如果是 'custom-mcp'，则 callMcpProvider
         需要被修改或替换为一个新的函数，该函数能够根据 McpServerConfig 中的 transport 字段来决定如何调用。        *   对于 stdio:
         使用 child_process.spawn 启动 command，并通过 stdin/stdout 与之通信。
           * 对于 http/websocket: 复用或调整现有 callHttpMcp/callWsMcp 逻辑。   上报 MCP 信息给 LLM*:
       * 在构建发送给 LLM 的 messages 列表时，如果存在激活的用户 MCP 配置，可以在系统提示（system role message）中添加关于该 MCP
         服务器的信息和可用工具的描述。
       * 这个描述可以基于 McpServerConfig.config 中存储的工具信息，或者在激活时动态获取（如果 MCP 服务器支持 introspection）。

  4. 前端管理界面 (`src/routes/admin/settings`):
   * 扩展管理界面:    在 `src/routes/admin/settings/+page.svelte` 中添加一个新的选项卡或部分，专门用于管理 MCP 服务器。   UI 组件:
      创建表单用于添加/编辑 MCP服务器配置，包含 `name`, `transport` (下拉选择), `command` (当 transport 为 stdio 时显示), `baseUrl`
     (当 transport 为 http/ws 时显示), `apiKey`, `config` (可能是一个文本域输入 JSON)。       创建列表展示所有 MCP 服务器配置。
     *为每个条目添加编辑、删除、激活按钮。
       * 激活按钮应确保同一时间只有一个 MCP 服务器处于激活状态。

  5. MCP适配器增强 (`src/lib/mcp/adapter.ts`):
   * 支持自定义 MCP:    * 修改 callMcpProvider 或创建一个新的函数来处理 custom-mcp 类型。
       * 根据 McpServerConfig 的配置，选择合适的通信方式（stdio, http, ws）并执行调用。
       * 对于 stdio，实现一个新的 callStdioMcp(command: string, payload: any) 函数，它会启动子进程并管理 stdin/stdout 流。

  6. 移除硬编码 MCP (可选):
   * 当前的 server/mcp_server.py 可以保留作为示例或本地开发测试用，但不再由主应用逻辑直接调用。
   * 通过上述步骤，用户可以配置自己的 MCP 服务器（包括运行这个脚本的命令），从而实现自定义插件。这个方案提供了一个清晰的路径来实现
     MCP 服务器的用户自定义管理。下一步可以开始实施数据库模型变更。


     根据上述修改方案，我们将任务分解为具体、可执行的步骤：

  阶段一：数据模型与 API

  任务 1: 扩展 Prisma 数据模型
   * 描述: 修改 prisma/schema.prisma 文件，添加 McpServerConfig 模型和更新 UserPreference 模型。   子任务:1.  在 `schema.prisma`
     中定义 `model McpServerConfig`，包含 `id`, `name`, `transport`, `command`, `baseUrl`, `apiKey`, `config`, `isActive`,
     `createdAt`, `updatedAt` 字段。2. 在 `model UserPreference` 中添加可选字段 `mcpServerId String?`。3.  在 `UserPreference`
     模型中添加关系 `mcpServer McpServerConfig? @relation(fields: [mcpServerId], references: [id])`。   输出: 更新后的
     prisma/schema.prisma 文件。

  任务 2:生成数据库迁移   描述*: 使用 Prisma CLI为新增的模型和字段生成并应用数据库迁移。
   * 子任务:
       1. 运行 npx prisma migrate dev --name add_mcp_server_config 来创建和应用迁移。 2. （可选）运行 npx prisma generate以更新 Prisma
          Client 类型定义。
   * 输出: 新的数据库表 McpServerConfig 和更新后的 UserPreference 表结构。任务 3: 创建 MCP服务器管理 API 路由
   * 描述: 实现用于管理 McpServerConfig 的后端 API 端点。   子任务*:
       1. 创建目录 src/routes/api/mcp-server。    2.  实现 +server.ts 文件，包含以下端点的逻辑：    `GET /api/mcp-server` (获取列表)
           POST /api/mcp-server (创建)
           * GET /api/mcp-server/[id] (获取详情)
           * PATCH /api/mcp-server/[id] (更新)
           * DELETE /api/mcp-server/[id] (删除) *   POST /api/mcp-server/[id]/activate (激活)
       3. 在所有端点中实现管理员权限验证 (locals.auth.user?.role === 'admin')。
       4. 实现激活逻辑：确保同一时间只有一个 McpServerConfig 的 isActive 为 true。
   * 输出: src/routes/api/mcp-server 目录及其下的 API 路由文件。

  阶段二：核心逻辑集成

  任务 4: 修改聊天 API 以支持用户自定义 MCP   描述*: 更新聊天处理逻辑，使其能够调用用户配置的 MCP服务器。
   * 子任务: 1. 修改 src/routes/api/chat/[id]/+server.ts。
       2. 在调用 LLM之前，查询数据库获取 isActive: true 的 McpServerConfig 记录。 3. 修改模型类型判断逻辑：识别
          modelConfig.provider.type === 'custom-mcp'。
       4. 当检测到 custom-mcp 类型时，调用为用户自定义 MCP 设计的新适配器函数（将在任务 6 中实现），传入从数据库获取的 McpServerConfig
          对象和聊天消息。   输出*: 更新后的 src/routes/api/chat/[id]/+server.ts 文件。

  任务5: 在聊天上下文中上报 MCP信息   描述*: 将激活的 MCP 服务器信息传递给 LLM，以便它知道可以调用哪些工具。
   * 子任务:
       1. 修改 src/routes/api/chat/[id]/+server.ts 中构建 messages 数组的逻辑。2.  如果存在激活的 McpServerConfig，则在发送给 LLM
          的消息列表开头或系统提示中添加一个描述该 MCP 服务器可用工具的 system 消息。3.  （可选）工具描述可以从 McpServerConfig.config
          字段中读取，或者设计一个机制在激活时动态获取。   输出*: 更新后的 src/routes/api/chat/[id]/+server.ts 文件。

  阶段三：前端管理界面任务 6: 在管理员设置页面添加 MCP服务器管理 UI
   * 描述: 为管理员提供一个界面来配置 MCP 服务器。
   * 子任务:1.  修改 src/routes/admin/settings/+page.svelte。    2.  添加一个新的 UI 部分或选项卡，用于管理 MCP 服务器。3.
     实现一个表单，用于创建和编辑 McpServerConfig，包含所有相关字段（name, transport, command, baseUrl, apiKey, config (JSON)）。4.
     实现一个列表，显示所有现有的 MCP服务器配置。5.为列表中的每个条目添加“编辑”、“删除”和“激活”按钮，并实现相应的前端逻辑（调用任务3
     中创建的 API）。    6. 确保 UI 逻辑能正确处理 transport 字段的变化（例如，选择 stdio时显示 command 输入框，选择 http 时显示
     baseUrl）。
   * 输出: 更新后的 src/routes/admin/settings/+page.svelte 文件。

  阶段四：增强 MCP适配器任务 7: 增强 MCP 适配器以支持用户自定义 MCP
   * 描述: 扩展 MCP 适配器 (src/lib/mcp/adapter.ts)以支持通过不同方式（stdio, http, ws）与用户自定义的 MCP 服务器通信。
   * 子任务:1.  修改 src/lib/mcp/adapter.ts。    2. 定义一个新的类型 CustomMcpServerConfig，对应数据库中的 McpServerConfig 结构。3.
     创建或修改 callMcpProvider 函数，或创建一个新的函数（例如 callCustomMcpProvider），使其能够接受 CustomMcpServerConfig
     对象作为参数。4.  实现根据 transport 字段选择通信方式的逻辑：    如果 `transport === 'stdio'`，实现 `callStdioMcp(config:
     CustomMcpServerConfig, messages: ...)`: 使用 `child_process.spawn` 启动 `config.command`，并通过 stdin 发送请求，从
     stdout读取响应。           如果 transport === 'http'，复用或调整现有的 callHttpMcp逻辑。
           * 如果 transport === 'websocket'，复用或调整现有的 callWsMcp 逻辑。5.
             确保所有新实现的通信方式都能正确处理流式响应（SSE-like chunks）。
   * 输出: 更新后的 src/lib/mcp/adapter.ts 文件。

  阶段五：清理与测试

  任务 8: 清理与文档
   * 描述: 移除对硬编码 MCP 的直接依赖（可选），并更新相关文档。
   * 子任务:    1.  （可选）审查代码库，移除或注释掉直接调用 server/mcp_server.py 的旧逻辑（如果有的话）。 2.  更新项目文档（如
     README.md 或 project_design.md），说明如何配置和使用用户自定义的 MCP 服务器。   输出*: 更新后的代码和文档。

  任务 9: 测试
   * 描述: 对新功能进行全面测试。   子任务*:    1. 编写针对新 API 端点的单元测试或集成测试。2. 手动测试管理员界面的
     MCP服务器管理功能（增删改查、激活）。 3. 配置一个用户自定义的 MCP 服务器（例如，运行 server/mcp_server.py 作为一个独立进程并通过
     stdio 或 http 暴露），然后在聊天中测试其功能。
       4. 验证 LLM 是否能正确接收到 MCP 服务器信息。
   * 输出: 测试通过，功能稳定。这个任务列表提供了一个清晰的路线图，可以按顺序或并行执行（注意依赖关系，如任务 2 依赖任务 1，任务 4 和6
     依赖任务3 的 API 可用性）。


     原方案和任务列表已经相当完善，核心思路正确。但为了提高实现质量、代码健壮性和安全性，我们可以对方案和任务列表进
  行一些细化和补充。修改后的方案:

  目标:
   1. 允许管理员在系统管理界面通过 JSON 配置和管理 MCP 服务器（增、删、改、查、激活）。
   2. 在聊天时，如果用户配置了 MCP 服务器，将其信息上报给 LLM。3. 支持用户自定义插件，移除对硬编码 server/mcp_server.py 的直接依赖。

  修改/细化点:1.  数据模型 (Prisma Schema):       Transport 类型: 使用 Prisma Enum 来定义 `McpTransport`，增强类型安全性。
  字段验证/注释:为字段添加注释说明用途和约束。  安全字段: 明确 `apiKey` 的存储（明文，但API不返回）和处理方式。  用户偏好: 细化
  mcpServerId 的回退逻辑描述。2.  后端 API 路由:    统一权限检查: 引入或明确使用一个中间件/辅助函数进行管理员权限验证。
  输入验证: 强调对所有输入数据（特别是 command, baseUrl, apiKey）进行严格验证和清理。   安全处理 `command`*: 对 stdio 类型的
  command 字段进行安全检查，防止命令注入（例如，限制命令只能是特定路径下的脚本，或对参数进行白名单校验）。
   3. 核心逻辑 (Chat API):    逻辑解耦: 将 MCP 服务器查找、类型判断、调用准备等逻辑封装成独立的辅助函数。    错误处理:
      明确定义调用自定义 MCP 失败时的处理策略（日志、用户提示、聊天流继续但禁用工具）。
       * 上报信息: 明确上报给 LLM 的信息格式和来源（例如，从 McpServerConfig.config 中提取结构化工具列表）。
   4. 前端管理界面:    动态表单: 确认实现 `transport` 字段变化时，UI 动态显示/隐藏 `command`/`baseUrl` 字段。   UX 改进:
      添加激活操作的确认对话框。明确显示当前激活的服务器。
   5. MCP适配器增强:    Stdio 实现:详细规划 `callStdioMcp` 的实现，包括进程管理、流处理、超时、错误处理。    健壮性:
      强调对所有传输方式的异常处理。6.  清理与文档:    文档更新*: 明确需要更新哪些文档部分。

  修改后的任务列表:阶段一：数据模型与 API

  任务 1: 扩展 Prisma 数据模型 描述: 修改 `prisma/schema.prisma` 文件，添加 `McpServerConfig` 模型和更新 `UserPreference` 模型。
  子任务:1. 定义 enum McpTransport { stdio, http, websocket }。 2. 在 schema.prisma 中定义 model McpServerConfig，包含字段：    `id`:
  `String @id @default(cuid())`    name: String - 服务器名称。    `transport`: `McpTransport` - 传输方式。         command: String? -
  stdio 启动命令 (需安全校验)。    `baseUrl`: `String?` - `http`/`ws` 基础 URL。    apiKey: String? - 可选 API 密钥 (API 不返回)。
         `config`: `Json?` - 结构化工具配置或其他设置。    isActive: Boolean @default(false) - 是否激活。    `createdAt`: `DateTime
  @default(now())`    updatedAt: DateTime @updatedAt 3. 在 model UserPreference 中添加可选字段 mcpServerId String?
  及其关系。4.为模型和字段添加注释说明。   输出: 更新后的 `prisma/schema.prisma` 文件。任务 2: 生成数据库迁移*
   * 描述: 使用 Prisma CLI为新增的模型和字段生成并应用数据库迁移。
   * 子任务:
       1. 运行 npx prisma migrate dev --name add_mcp_server_config 来创建和应用迁移。2. 运行 npx prisma generate 以更新 Prisma Client
          类型定义。
   * 输出: 新的数据库表结构和更新的 Prisma Client。

  任务 3: 创建 MCP服务器管理 API 路由
   * 描述: 实现用于管理 McpServerConfig 的后端 API 端点。
   * 子任务: 1.  创建目录 src/routes/api/mcp-server。2.  (可选) 创建 src/lib/server/adminAuth.ts
     辅助函数，用于统一的管理员权限检查。3. 实现 +server.ts 文件，包含 CRUD 和激活端点。4.  在所有端点中调用管理员权限检查。5.
     实现严格的请求体验证逻辑（使用 Zod 或类似库）。6.  对 stdio 的 command
     字段进行安全校验（例如，确保命令是绝对路径，参数白名单）。7. 实现激活逻辑：确保唯一性。8. 确保 GET /api/mcp-server 和 GET
     /api/mcp-server/[id] 返回的响应体中 apiKey 字段被过滤或替换为 null/"***"。   输出: `src/routes/api/mcp-server` 目录及其下的 API
     路由文件。阶段二：核心逻辑集成*任务 4: 修改聊天 API 以支持用户自定义 MCP   描述*: 更新聊天处理逻辑，使其能够调用用户配置的
     MCP服务器。
   * 子任务:    1.  修改 src/routes/api/chat/[id]/+server.ts。2.  创建 src/lib/server/mcpHelper.ts (或类似名称) 文件，封装以下逻辑：
       `getActiveMcpConfig()`: 查询数据库获取激活的 `McpServerConfig`。         prepareMcpCall(modelConfig, mcpServerConfig,
     messages): 根据 modelConfig.provider.type 和 mcpServerConfig 准备调用参数。    `callMcpForChat(mcpServerConfig,
     preparedPayload)`: 调用适配器（任务 7）。3.  在聊天主逻辑中调用 `mcpHelper.ts` 中的函数来处理 MCP 相关流程。   输出: 更新后的
     src/routes/api/chat/[id]/+server.ts 和新的 src/lib/server/mcpHelper.ts 文件。任务 5: 在聊天上下文中上报 MCP信息
   * 描述: 将激活的 MCP 服务器信息传递给 LLM。   子任务*: 1.  修改 src/lib/server/mcpHelper.ts 或
     src/routes/api/chat/[id]/+server.ts。2. 在 getActiveMcpConfig() 或相关函数中，处理 MCP 服务器的工具信息。3.
     设计一个机制，将结构化的工具描述（可能来自 mcpServerConfig.config）格式化成 LLM 可理解的 system 消息内容。4. 在构建 messages
     数组时，插入此 system 消息。
   * 输出: 更新后的相关文件。

  阶段三：前端管理界面

  任务 6: 在管理员设置页面添加 MCP服务器管理 UI 描述:为管理员提供一个界面来配置 MCP 服务器。 子任务:1.  修改
  src/routes/admin/settings/+page.svelte。2.  添加 MCP 服务器管理的 UI 部分/选项卡。3.  实现包含所有字段的表单，特别注意：
   使用下拉菜单选择 `transport` 类型。         根据 transport 动态显示/隐藏 command 或 baseUrl 输入框。 4. 实现
  MCP服务器配置列表展示。5.  为列表项实现“编辑”、“删除”、“激活”按钮。           “激活”按钮点击后弹出确认对话框。    在 UI
  上清晰标识当前激活的服务器。
   * 输出: 更新后的 src/routes/admin/settings/+page.svelte 文件。阶段四：增强 MCP适配器

  任务 7: 增强 MCP 适配器以支持用户自定义 MCP
   * 描述: 扩展 MCP 适配器以支持通过不同方式与用户自定义的 MCP 服务器通信。
   * 子任务:1.  修改 src/lib/mcp/adapter.ts。2. 定义 CustomMcpServerConfig 类型（或使用 Prisma生成的类型）。3.  创建
     callCustomMcpProvider(config: CustomMcpServerConfig, messages: ...).4.  实现 callStdioMcp:           使用
     `child_process.spawn`。         管理 stdin (发送请求 JSON)。  管理 stdout (读取 SSE-like chunks)。         管理 stderr
     (记录错误)。         实现超时控制。         处理子进程异常退出。5. 调整或复用 callHttpMcp 和 callWsMcp以适配
     CustomMcpServerConfig。6. 确保所有方式都能正确处理流式响应。
   * 输出: 更新后的 src/lib/mcp/adapter.ts 文件。

  阶段五：清理与测试

  任务 8: 清理与文档
   * 描述: 更新文档和进行代码清理。
   * 子任务: 1.  更新 README.md 或 project_design.md，添加关于如何配置和使用自定义 MCP服务器的说明。2.  (可选)
     审查并注释掉或重构直接调用旧硬编码 MCP逻辑的代码（如果存在且不再需要）。
   * 输出: 更新后的文档。

  任务 9: 测试   描述*: 对新功能进行全面测试。
   * 子任务: 1. 为 src/routes/api/mcp-server 编写 API 测试用例（单元/集成）。2. 手动测试管理员 UI 的所有功能。3.  配置一个自定义
     MCP服务器（如运行 server/mcp_server.py作为独立 HTTP服务）进行端到端测试。4. 配置一个 stdio 类型的 MCP 服务器（需要实现
     callStdioMcp 后）进行测试。5.  验证 LLM 接收 MCP 信息的正确性。6. 测试错误处理和边界情况（如无效配置、服务器无响应）。
   * 输出: 测试通过，功能稳定。通过这些细化和补充，方案和任务列表更加严谨和专业，有助于指导后续的高质量实现。


