# MCP Tool Execution Integration

تكامل كامل لتنفيذ الأدوات مع بروتوكول MCP (Model Context Protocol).

## البنية

```
packages/tool-broker/
├── src/
│   ├── executor.ts           # ToolExecutor - المنفذ الرئيسي للأدوات
│   ├── mcp/
│   │   ├── server-manager.ts # إدارة دورة حياة MCP servers
│   │   ├── tool-adapter.ts   # تحويل MCP tools لتنسيق موحد
│   │   ├── stdio-client.ts   # عميل stdio للتواصل مع MCP servers
│   │   └── index.ts          # Re-exports
│   ├── mcp-client.ts         # MCP clients (stdio/HTTP)
│   └── index.ts              # النقطة الرئيسية للحزمة
└── test/
    ├── executor.test.ts      # اختبارات ToolExecutor
    └── mcp-integration.test.ts # اختبارات تكامل MCP
```

## الميزات الأساسية

### 1. ToolExecutor

المنفذ الرئيسي للأدوات مع الميزات التالية:

- **أولوية MCP tools**: أدوات MCP لها الأولوية على provider-native tools
- **Sensitive tools approval**: الأدوات الحساسة تتطلب موافقة
- **Full execution tracing**: تتبع كامل لجميع عمليات التنفيذ
- **RBAC enforcement**: تطبيق صارم لصلاحيات RBAC
- **Retry logic**: إعادة محاولة تلقائية مع exponential backoff

```typescript
import { createToolExecutor } from "@repo/tool-broker";

const executor = createToolExecutor();

// تسجيل أداة
executor.registerTool({
  descriptor: {
    id: "mcp:filesystem:read",
    serverId: "filesystem",
    name: "filesystem.read",
    description: "Read file content",
    inputSchema: { type: "object", properties: { path: { type: "string" } } },
    sensitive: false
  },
  source: "mcp",
  execute: async (input) => {
    // منطق التنفيذ
    return { content: "..." };
  }
});

// تسجيل سياسة
executor.registerPolicy({
  toolName: "filesystem.read",
  sensitive: false,
  requiresApproval: false,
  allowedRoles: ["owner", "admin", "operator", "viewer"]
});

// تنفيذ الأداة
const result = await executor.execute({
  runId: "run-123",
  roleId: "role-456",
  toolName: "filesystem.read",
  input: { path: "/path/to/file" },
  role: "operator",
  approvalMode: "auto",
  approved: false
});
```

### 2. McpServerManager

إدارة دورة حياة MCP servers:

- **Connection management**: الاتصال والفصل التلقائي
- **Health monitoring**: مراقبة صحة الخوادم
- **Auto-reconnection**: إعادة الاتصال التلقائية مع exponential backoff
- **Resource cleanup**: تنظيف الموارد عند الإغلاق

```typescript
import { createServerManager } from "@repo/tool-broker";

const manager = createServerManager();

// الاتصال بـ MCP server
const descriptors = await manager.connect({
  id: "filesystem",
  name: "Filesystem Server",
  transport: "stdio",
  endpoint: "npx @modelcontextprotocol/server-filesystem",
  authType: "none",
  enabled: true
});

// فحص صحة الخادم
const health = await manager.checkHealth("filesystem");
console.log(`Healthy: ${health.healthy}, Latency: ${health.latencyMs}ms`);

// قائمة الخوادم المتصلة
const servers = manager.listConnectedServers();

// الفصل من خادم
await manager.disconnect("filesystem");

// إيقاف المدير (تنظيف جميع الموارد)
await manager.stop();
```

### 3. McpToolAdapter

تحويل MCP tools إلى تنسيق موحد:

- **Tool descriptor building**: بناء descriptors من MCP tool definitions
- **Policy generation**: إنشاء سياسات تلقائية بناءً على sensitivity
- **Input validation**: التحقق من صحة المدخلات
- **Error normalization**: توحيد رسائل الأخطاء

```typescript
import { createToolAdapter } from "@repo/tool-broker";

const adapter = createToolAdapter({
  defaultSource: "mcp",
  defaultSensitiveRoles: ["owner", "admin"],
  defaultNonSensitiveRoles: ["owner", "admin", "operator", "viewer"]
});

// تحويل MCP tool
const brokerTool = adapter.adaptTool(
  "filesystem",
  {
    name: "read",
    description: "Read file",
    inputSchema: { type: "object" }
  },
  mcpClient
);

// إنشاء سياسة
const policy = adapter.generatePolicy(brokerTool.descriptor);

// استخراج معلومات من identifiers
const toolName = McpToolAdapter.extractToolName("server:tool.name");
const serverId = McpToolAdapter.extractServerId("server:tool.name");
```

### 4. StdioClient

عميل للتواصل مع MCP servers عبر stdio:

- **Child process management**: إدارة عمليات الأطفال
- **JSON-RPC messaging**: معالجة رسائل JSON-RPC
- **Graceful shutdown**: إيقاف آمن للعمليات
- **Error recovery**: استرداد من الأخطاء

```typescript
import { createStdioClient } from "@repo/tool-broker";

const client = createStdioClient({
  command: "npx",
  args: ["@modelcontextprotocol/server-filesystem"],
  env: { CUSTOM_ENV: "value" },
  timeoutMs: 30000
});

// بدء العميل
await client.start();

// إرسال طلب
const result = await client.sendRequest("tools/list");

// إرسال إشعار
client.sendNotification("ping");

// تسجيل معالجات
client.onMessage((msg) => console.log("Message:", msg));
client.onError((err) => console.error("Error:", err));
client.onExit((code, signal) => console.log("Exit:", code, signal));

// إيقاف العميل
await client.stop();
```

## أنماط الاستخدام

### Pattern 1: تكامل كامل مع MCP Server

```typescript
import {
  createServerManager,
  createToolAdapter,
  createToolExecutor
} from "@repo/tool-broker";

// إنشاء المكونات
const serverManager = createServerManager();
const toolAdapter = createToolAdapter();
const executor = createToolExecutor();

// الاتصال بخادم MCP
const descriptors = await serverManager.connect({
  id: "filesystem",
  name: "Filesystem",
  transport: "stdio",
  endpoint: "npx @modelcontextprotocol/server-filesystem",
  authType: "none",
  enabled: true
});

// الحصول على العميل
const client = serverManager.getClient("filesystem");
if (!client) throw new Error("Failed to get client");

// تكييف وتسجيل الأدوات
const toolDefs = await client.listTools();
const brokerTools = toolAdapter.adaptTools("filesystem", toolDefs, client);
const policies = toolAdapter.generatePolicies(
  brokerTools.map((t) => t.descriptor)
);

for (const tool of brokerTools) {
  executor.registerTool(tool);
}

for (const policy of policies) {
  executor.registerPolicy(policy);
}

// تنفيذ الأدوات
const result = await executor.execute({
  runId: "run-1",
  roleId: "role-1",
  toolName: "filesystem.read",
  input: { path: "/etc/hosts" },
  role: "operator",
  approvalMode: "auto",
  approved: false
});
```

### Pattern 2: Sensitive Tool Approval Flow

```typescript
// محاولة تنفيذ أداة حساسة بدون موافقة
try {
  await executor.execute({
    runId: "run-1",
    roleId: "role-1",
    toolName: "filesystem.write",
    input: { path: "/etc/hosts", content: "new content" },
    role: "admin",
    approvalMode: "approval",
    approved: false
  });
} catch (error) {
  // سيفشل: يتطلب موافقة
  console.error(error.message); // "Tool filesystem.write requires approval"
}

// التنفيذ مع الموافقة
const result = await executor.execute({
  runId: "run-1",
  roleId: "role-1",
  toolName: "filesystem.write",
  input: { path: "/tmp/test", content: "new content" },
  role: "admin",
  approvalMode: "approval",
  approved: true // الموافقة مطلوبة
});
```

### Pattern 3: Execution History Tracking

```typescript
// تنفيذ عدة أدوات
await executor.execute({
  runId: "run-1",
  roleId: "role-1",
  toolName: "tool.a",
  input: {},
  role: "operator",
  approvalMode: "auto",
  approved: false
});

await executor.execute({
  runId: "run-1",
  roleId: "role-2",
  toolName: "tool.b",
  input: {},
  role: "operator",
  approvalMode: "auto",
  approved: false
});

// الحصول على السجل
const history = executor.getExecutionHistory("run-1");
for (const trace of history) {
  console.log({
    tool: trace.toolName,
    role: trace.roleId,
    status: trace.status,
    duration: trace.metadata?.durationMs
  });
}

// تنظيف السجل
executor.clearExecutionHistory("run-1");
```

## الأدوات الحساسة

يتم اكتشاف الأدوات الحساسة تلقائياً بناءً على الأنماط:

- `.write` - الكتابة
- `.delete` - الحذف
- `.push` - الدفع
- `.remove` - الإزالة
- `.drop` - الإسقاط
- `.truncate` - القطع
- `.overwrite` - الكتابة فوق
- `.destroy` - التدمير
- `.execute` - التنفيذ
- `.run` - التشغيل
- `db.*_destructive` - عمليات DB المدمرة

الأدوات الحساسة:
- تتطلب موافقة في وضع `approval`
- محدودة للأدوار: `owner`, `admin` فقط
- يتم تسجيلها في traces مع `sensitive: true`

## Error Handling

جميع الأخطاء تستخدم `AppError` مع:

```typescript
{
  message: string;
  errorCode: string;
  retryable: boolean;
  traceId: string;
  statusCode: number;
  details?: Record<string, unknown>;
}
```

أكواد الأخطاء الشائعة:
- `TOOL_NOT_FOUND` - الأداة غير موجودة
- `TOOL_PERMISSION_DENIED` - لا يوجد صلاحية
- `TOOL_APPROVAL_REQUIRED` - يتطلب موافقة
- `TOOL_EXECUTION_FAILED` - فشل التنفيذ
- `MCP_CONNECTION_FAILED` - فشل الاتصال بـ MCP

## Retry Logic

يستخدم Executor retry logic تلقائياً مع:
- **Max retries**: 3 محاولات
- **Base delay**: 1000ms
- **Max delay**: 10000ms
- **Strategy**: Exponential backoff مع 30% jitter

## Testing

```bash
# جميع الاختبارات
pnpm --filter @repo/tool-broker run test

# اختبارات محددة
pnpm --filter @repo/tool-broker run test -- executor.test.ts
pnpm --filter @repo/tool-broker run test -- mcp-integration.test.ts

# Type check
pnpm --filter @repo/tool-broker run typecheck

# Lint
pnpm --filter @repo/tool-broker run lint
```

## Best Practices

1. **دائماً استخدم `createToolExecutor()`** بدلاً من `new ToolExecutor()`
2. **أوقف `McpServerManager`** عند الإغلاق لتنظيف الموارد
3. **سجل policies** لجميع الأدوات لضمان RBAC
4. **تتبع execution history** للتدقيق والتصحيح
5. **استخدم `approved: true`** فقط للأدوات الحساسة بعد موافقة المستخدم
6. **تحقق من health** بشكل دوري للخوادم المهمة
7. **استخدم traceId** من الأخطاء للتتبع عبر النظام

## Architecture Notes

- **MCP tools تأخذ الأولوية**: إذا كانت الأداة موجودة في MCP وكـ provider-native، يتم استخدام MCP
- **Child process lifecycle**: يتم إدارة عمليات stdio بشكل آمن مع graceful shutdown
- **Resource cleanup**: جميع الموارد يتم تنظيفها عند الإيقاف
- **Thread-safe**: جميع العمليات async-safe ويمكن استخدامها بشكل متزامن
- **Type-safe**: TypeScript strict mode مع full type coverage

## Future Enhancements

- WebSocket transport للـ MCP servers
- Tool caching للأداء الأفضل
- Metrics collection للمراقبة
- Rate limiting للـ tool execution
- Tool versioning support
- Batch tool execution
