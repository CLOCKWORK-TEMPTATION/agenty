# معجم المصطلحات | Glossary

<div dir="rtl">

دليل شامل لجميع المصطلحات التقنية المستخدمة في المنصة.

</div>

---

## A

### A2A (Agent-to-Agent)
<div dir="rtl">

**بروتوكول التواصل بين الوكلاء** - معيار من Google لتمكين الوكلاء من التواصل والتعاون عبر منصات مختلفة.

</div>

**Example**: An external research agent can delegate subtasks to our platform via A2A protocol.

---

### Agent
<div dir="rtl">

**وكيل** - كيان ذكي يمكنه تنفيذ مهام باستخدام نموذج لغوي وأدوات. في منصتنا، كل دور في الفريق هو وكيل.

</div>

**Example**: A "Lead Researcher" agent uses GPT-4o to conduct research using Tavily search tool.

---

### Agent Card
<div dir="rtl">

**بطاقة الوكيل** - وصف موحد للوكيل يتضمن قدراته، أدواته، ونقاط النهاية الخاصة به. جزء من بروتوكول A2A.

</div>

**Format**:
```json
{
  "id": "agent_123",
  "name": "Research Agent",
  "capabilities": ["research", "analysis"],
  "tools": ["tavily_search", "web_scraper"]
}
```

---

### Aggregate Node
<div dir="rtl">

**عقدة التجميع** - المرحلة 11 في LangGraph. تدمج نتائج المتخصصين المنفذين بشكل متوازي.

</div>

**Purpose**: Combine outputs from parallel specialists into a coherent result.

---

### Anthropic
<div dir="rtl">

**أنثروبيك** - شركة تطوير ذكاء اصطناعي، صاحبة نماذج Claude (Opus, Sonnet, Haiku).

</div>

**Models**: Claude Opus 4.6, Claude Sonnet 4.5, Claude Haiku 4

---

### API Key
<div dir="rtl">

**مفتاح API** - مفتاح سري للمصادقة مع خدمة خارجية (مثل OpenAI، Anthropic).

</div>

**Example**: `OPENAI_API_KEY=sk-proj-...`

**⚠️ Security**: Never commit API keys to version control.

---

### Approval Gate
<div dir="rtl">

**بوابة الموافقة** - المرحلة 8 في LangGraph. تتطلب موافقة بشرية قبل التنفيذ (اختياري).

</div>

**Modes**:
- **Approval**: Requires human approval
- **Auto**: Automatic approval (no wait)

---

### Approval Mode
<div dir="rtl">

**وضع الموافقة** - إعداد يحدد ما إذا كان التنفيذ يتطلب موافقة بشرية عند بوابة الموافقة.

</div>

**Use Cases**: Sensitive tasks, production runs, expensive operations

---

### Artifact
<div dir="rtl">

**مُخرَج** - ملف أو بيانات ناتجة عن تنفيذ فريق (مثل: مستند، كود، صورة).

</div>

**Types**: Text files, code files, images, PDFs, JSON data

**Storage**: PostgreSQL (metadata) + Filesystem/S3 (content)

---

### Audit Log
<div dir="rtl">

**سجل التدقيق** - سجل غير قابل للتعديل لجميع العمليات الحساسة في المنصة.

</div>

**Logged Events**: User actions, run lifecycle, tool executions, approval decisions

**Purpose**: Security, compliance, troubleshooting

---

## B

### Bigtool
<div dir="rtl">

**Bigtool** - تقنية لاختيار الأدوات ذات الصلة دلالياً عندما يكون عدد الأدوات كبير جداً لتمريرها كلها للنموذج.

</div>

**How it works**: Uses embedding similarity to select most relevant tools.

---

### BullMQ
<div dir="rtl">

**BullMQ** - مكتبة طوابير وظائف (job queues) مبنية على Redis، تستخدم للمعالجة غير المتزامنة.

</div>

**Use Cases**: Batch processing, skill reloading, cleanup jobs, notifications

**Queues**: `batch-execution`, `skill-reload`, `cleanup`, `notifications`

---

## C

### Cache Hit Rate
<div dir="rtl">

**معدل إصابة الذاكرة المؤقتة** - نسبة الطلبات التي تم تقديمها من الذاكرة المؤقتة بدلاً من تنفيذ جديد.

</div>

**Formula**: `(cache_hits / total_requests) * 100`

**Good Rate**: 40%+ for semantic cache, 60%+ for prompt cache

---

### Capability
<div dir="rtl">

**قدرة** - مجال خبرة أو مهارة (مثل: research, coding, writing).

</div>

**Categories**: Reasoning, coding, creative, knowledge, multimodal

**Scoring**: Models are scored 0-100 per capability.

---

### Checkpoint
<div dir="rtl">

**نقطة حفظ** - لقطة من حالة التنفيذ محفوظة في قاعدة البيانات، تمكن الاستئناف بعد فشل أو إيقاف.

</div>

**Frequency**: After every node execution

**Storage**: PostgreSQL (`run_checkpoints` table)

**Retention**: 7 days for completed runs, indefinite for active

---

### Circuit Breaker
<div dir="rtl">

**قاطع الدائرة** - نمط تصميم لمنع استدعاءات متكررة لخدمة فاشلة.

</div>

**States**: Closed (normal), Open (failing), Half-Open (testing)

**Config**: `failureThreshold: 5, resetTimeout: 60s`

---

### Claude
<div dir="rtl">

**كلود** - عائلة نماذج لغوية من Anthropic (Opus, Sonnet, Haiku).

</div>

**Latest**: Claude Opus 4.6 (highest quality), Claude Sonnet 4.5 (balanced)

---

### Cohere
<div dir="rtl">

**كوهير** - شركة تطوير نماذج لغوية، صاحبة نماذج Command.

</div>

**Models**: Command R+, Command R

---

### Context Window
<div dir="rtl">

**نافذة السياق** - الحد الأقصى لعدد الرموز (tokens) التي يمكن للنموذج قراءتها في مرة واحدة.

</div>

**Examples**:
- GPT-4o: 128,000 tokens
- Claude Opus 4: 200,000 tokens
- Gemini 2.0 Flash: 1,048,576 tokens

---

## D

### DLP (Data Loss Prevention)
<div dir="rtl">

**منع فقدان البيانات** - فلاتر تكشف وتمنع تسريب بيانات حساسة (PII، مفاتيح API، أسرار).

</div>

**Filters**: PII detection, API key detection, keyword scanning

**Action**: Masking, blocking, alerting

---

### Docker Compose
<div dir="rtl">

**Docker Compose** - أداة لتعريف وتشغيل تطبيقات Docker متعددة الحاويات.

</div>

**Usage**: Development environment (PostgreSQL, Redis, LiteLLM)

**Command**: `docker compose up -d`

---

### Draft
<div dir="rtl">

**مسودة** - تصميم فريق مقترح يحتاج موافقة قبل التنفيذ.

</div>

**Created By**: `POST /api/v1/team/draft`

**Contains**: Team composition, model assignments, tool allocations, skills

**Status**: `draft` → `approved` → `running`

---

## E

### E2B
<div dir="rtl">

**E2B** - منصة تنفيذ كود معزول (sandboxed) آمنة.

</div>

**Use Case**: Execute untrusted code safely

**Alternative**: Local sandboxed runners

---

### Embedding
<div dir="rtl">

**تمثيل شعاعي** - تحويل نص إلى متجه أرقام يمثل معناه الدلالي.

</div>

**Model**: OpenAI `text-embedding-ada-002`, Google `textembedding-gecko`

**Dimensions**: 1536 (OpenAI), 768 (Google)

**Use Cases**: Semantic search, similarity detection, caching

---

### Exponential Backoff
<div dir="rtl">

**التراجع الأسي** - استراتيجية إعادة المحاولة مع زيادة تدريجية في وقت الانتظار.

</div>

**Pattern**: Wait 1s, then 2s, then 4s, then 8s...

**Formula**: `delay = base_delay * (2 ^ attempt)`

---

## F

### Fallback Chain
<div dir="rtl">

**سلسلة احتياطية** - قائمة نماذج بديلة تُستخدم إذا فشل النموذج الأساسي.

</div>

**Example**: Primary: GPT-4o → Fallback 1: Claude Opus 4 → Fallback 2: Gemini 1.5 Pro

---

### Fastify
<div dir="rtl">

**Fastify** - إطار عمل ويب عالي الأداء لـ Node.js، يستخدم في API Server.

</div>

**Features**: Fast routing, schema validation, plugin system

**Performance**: ~30,000 req/sec (vs Express ~15,000)

---

### Finalizer Node
<div dir="rtl">

**عقدة الإنهاء** - المرحلة 13 (الأخيرة) في LangGraph. تنسق وترجع النتيجة النهائية.

</div>

**Tasks**: Format output, save artifacts, mark run complete

---

## G

### Gemini
<div dir="rtl">

**جيميناي** - عائلة نماذج لغوية من Google (Flash, Pro).

</div>

**Models**: Gemini 2.0 Flash (fast), Gemini 1.5 Pro (quality)

**Specialty**: Long context windows (1M+ tokens)

---

### GPT (Generative Pre-trained Transformer)
<div dir="rtl">

**GPT** - معمارية نموذج لغوي من OpenAI.

</div>

**Models**: GPT-4o (latest), GPT-4-Turbo, GPT-3.5-Turbo

---

## H

### Health Check
<div dir="rtl">

**فحص الصحة** - نقطة نهاية للتحقق من حالة الخدمة.

</div>

**Types**:
- **Readiness**: `/health/ready` (can accept traffic?)
- **Liveness**: `/health/alive` (is process running?)

---

### Helm
<div dir="rtl">

**Helm** - مدير حزم لـ Kubernetes.

</div>

**Usage**: Deploy platform to Kubernetes cluster

**Chart**: `infra/deploy/helm/agents/`

---

### HITL (Human-in-the-Loop)
<div dir="rtl">

**الإنسان في الحلقة** - تدخل بشري في التنفيذ الآلي.

</div>

**Points**: Approval gate, tool approval, human feedback

---

## I

### Intake Node
<div dir="rtl">

**عقدة الاستقبال** - المرحلة 1 في LangGraph. تستقبل وتحلل طلب المهمة.

</div>

**Tasks**: Validate request, extract intent, classify complexity

---

## J

### JWT (JSON Web Token)
<div dir="rtl">

**رمز ويب JSON** - معيار للمصادقة عبر رموز موقعة.

</div>

**Usage**: API authentication

**Header**: `Authorization: Bearer <jwt_token>`

**Expiry**: 24 hours (default)

---

## K

### KMS (Key Management Service)
<div dir="rtl">

**خدمة إدارة المفاتيح** - خدمة سحابية لإدارة مفاتيح التشفير بشكل آمن.

</div>

**Providers**: AWS KMS, GCP KMS, Azure Key Vault, HashiCorp Vault

**Usage**: Encrypt sensitive data, store API keys

---

### Kubernetes (K8s)
<div dir="rtl">

**Kubernetes** - منصة تنسيق الحاويات (containers) للإنتاج.

</div>

**Usage**: Production deployment, auto-scaling, load balancing

**Resources**: Deployments, StatefulSets, Services, Ingress

---

## L

### LangGraph
<div dir="rtl">

**LangGraph** - إطار عمل لبناء وتنفيذ رسوم بيانية للوكلاء (agent graphs).

</div>

**Features**: State machines, checkpointing, parallel execution, interrupts

**Provider**: LangChain

---

### LangSmith
<div dir="rtl">

**LangSmith** - منصة مراقبة وتتبع لتطبيقات LangChain/LangGraph.

</div>

**Features**: Tracing, debugging, analytics, dataset management

**Integration**: Native in platform

---

### Latency
<div dir="rtl">

**زمن الاستجابة** - الوقت بين إرسال طلب واستقبال رد.

</div>

**Measurement**: Milliseconds (ms)

**Typical**:
- GPT-4o: 2000-3000ms
- Claude Opus 4: 3000-4000ms
- Gemini Flash: 1000-1500ms

---

### LiteLLM
<div dir="rtl">

**LiteLLM** - بوابة موحدة ل 100+ نموذج لغوي.

</div>

**Features**: Routing, load balancing, retries, prompt caching, fallbacks

**Providers**: OpenAI, Anthropic, Google, Cohere, Mistral, and more

**Dashboard**: http://localhost:4001

---

### LLM (Large Language Model)
<div dir="rtl">

**نموذج لغوي كبير** - نموذج ذكاء اصطناعي مدرب على كميات ضخمة من النصوص.

</div>

**Examples**: GPT-4o, Claude Opus 4, Gemini 2.0 Flash

---

## M

### MCP (Model Context Protocol)
<div dir="rtl">

**بروتوكول سياق النموذج** - معيار مفتوح من Anthropic لتوصيل الأدوات بالنماذج اللغوية.

</div>

**Transport**: stdio (standard input/output)

**Servers**: GitHub, PostgreSQL, Filesystem, Playwright, Slack, Notion

**Priority**: MCP tools prioritized over provider-native tools

---

### Metadata
<div dir="rtl">

**بيانات وصفية** - بيانات عن البيانات (مثل: تاريخ الإنشاء، المؤلف، الحجم).

</div>

**Usage**: Skill metadata (loaded always), full content (loaded on activation)

---

### Mistral
<div dir="rtl">

**ميسترال** - شركة فرنسية تطوير نماذج لغوية مفتوحة المصدر.

</div>

**Models**: Mistral Large, Mistral Medium, Mixtral 8x7B

---

### Model
<div dir="rtl">

**نموذج** - نموذج لغوي (LLM) يستخدم لتنفيذ دور في الفريق.

</div>

**Selection**: Based on quality-first algorithm

**Diversity**: Minimum 2 different models per team

---

### Model Router
<div dir="rtl">

**موجّه النماذج** - مكون يختار أفضل نموذج لكل دور.

</div>

**Algorithm**: `score = quality(0.65) + tool_reliability(0.20) + capability_fit(0.10) + latency_reliability(0.05)`

**Note**: Cost is NEVER a factor

---

### Monorepo
<div dir="rtl">

**مستودع واحد** - مشروع واحد يحتوي على عدة حزم/تطبيقات.

</div>

**Structure**: `apps/` (web, api) + `packages/` (agent-core, model-router, etc.)

**Tools**: pnpm workspaces + Turborepo

---

## N

### Next.js
<div dir="rtl">

**Next.js** - إطار عمل React لبناء تطبيقات ويب.

</div>

**Version**: 14 (App Router)

**Features**: Server Components, Streaming, API Routes

**Usage**: Web UI

---

### Node
<div dir="rtl">

**عقدة** - مرحلة في رسم LangGraph التنفيذي.

</div>

**Total Nodes**: 13 (intake → finalizer)

**Execution**: Sequential with checkpoints after each node

---

## O

### Observability
<div dir="rtl">

**القابلية للمراقبة** - القدرة على فهم حالة النظام من خلال مخرجاته.

</div>

**Pillars**: Logs, metrics, traces

**Tools**: LangSmith, OpenTelemetry, Prometheus

---

### OpenAI
<div dir="rtl">

**OpenAI** - شركة تطوير ذكاء اصطناعي، صاحبة نماذج GPT.

</div>

**Models**: GPT-4o, GPT-4-Turbo, GPT-3.5-Turbo, DALL-E, Whisper

---

### OpenTelemetry
<div dir="rtl">

**OpenTelemetry** - إطار عمل مفتوح المصدر للمراقبة الموزعة.

</div>

**Features**: Distributed tracing, metrics, logs

**Export**: Prometheus, Jaeger, Zipkin

---

## P

### pgvector
<div dir="rtl">

**pgvector** - امتداد PostgreSQL لتخزين ومعالجة المتجهات (vectors).

</div>

**Usage**: Semantic search, similarity detection, embedding storage

**Operators**: `<->` (L2 distance), `<#>` (inner product), `<=>` (cosine distance)

---

### Planner Node
<div dir="rtl">

**عقدة المخطط** - المرحلة 9 في LangGraph. تنشئ خطة تنفيذ مفصلة.

</div>

**Output**: Step-by-step plan with dependencies

**Model**: Uses highest-quality model for planning

---

### pnpm
<div dir="rtl">

**pnpm** - مدير حزم Node.js سريع وكفؤ.

</div>

**Advantages**: Faster than npm/yarn, saves disk space, better security

**Usage**: `pnpm install`, `pnpm run dev`, `pnpm --filter <package> run test`

---

### PostgreSQL
<div dir="rtl">

**PostgreSQL** - قاعدة بيانات علائقية مفتوحة المصدر.

</div>

**Version**: 16

**Extensions**: pgvector (for embeddings)

**Usage**: Main database for all persistent data

---

### Profile Node
<div dir="rtl">

**عقدة التصنيف** - المرحلة 2 في LangGraph. تحلل متطلبات المهمة بعمق.

</div>

**Output**: TaskProfile (complexity, capabilities, risks, tools, skills)

---

### Progressive Disclosure
<div dir="rtl">

**الكشف التدريجي** - نمط تصميم يُحمّل البيانات على مراحل حسب الحاجة.

</div>

**Usage**: Skill system (metadata always loaded, full content on activation)

**Benefit**: Reduces memory usage and startup time

---

### Prompt Caching
<div dir="rtl">

**تخزين المطالبات** - حفظ استجابات المطالبات المتطابقة لإعادة استخدامها.

</div>

**Levels**:
- **Exact Match**: Prompt must be identical
- **Semantic**: Similar prompts (embedding-based)

**TTL**: 1 hour (exact), 24 hours (semantic)

---

## Q

### Quality-First
<div dir="rtl">

**الجودة أولاً** - مبدأ اختيار النماذج بناءً على الجودة فقط، ليس التكلفة.

</div>

**Formula**: `score = quality(0.65) + tool_reliability(0.20) + capability_fit(0.10) + latency_reliability(0.05)`

**Cost Weight**: 0% (cost is NEVER a factor)

---

## R

### Rate Limiting
<div dir="rtl">

**تحديد المعدل** - تقييد عدد الطلبات المسموحة في فترة زمنية.

</div>

**Limits**:
- Authenticated: 1000 req/hour
- Unauthenticated: 100 req/hour

**Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

---

### RBAC (Role-Based Access Control)
<div dir="rtl">

**التحكم في الوصول المبني على الأدوار** - نظام صلاحيات يعتمد على دور المستخدم.

</div>

**Roles**: admin, developer, operator, viewer

**Permissions**: Per-resource (teams, runs, templates, skills, mcp)

---

### Redis
<div dir="rtl">

**Redis** - قاعدة بيانات في الذاكرة (in-memory) عالية الأداء.

</div>

**Version**: 7

**Use Cases**: Caching, queues (BullMQ), pub/sub, distributed locks

---

### Retry
<div dir="rtl">

**إعادة المحاولة** - محاولة عملية فاشلة مرة أخرى.

</div>

**Strategy**: Exponential backoff with jitter

**Max Attempts**: 3 (configurable)

**Retryable Errors**: Rate limit, timeout, network, model overloaded

---

### Revision Loop
<div dir="rtl">

**حلقة المراجعة** - إعادة التنفيذ بعد فشل التحقق (verifier).

</div>

**Max Loops**: 2 (hard limit)

**Flow**: verifier → fail → planner → execute → verifier

**Protection**: Forced termination after 2 loops

---

### Role
<div dir="rtl">

**دور** - متخصص في الفريق له مسؤوليات محددة (مثل: researcher, writer, reviewer).

</div>

**Assignment**: Each role assigned to a specific model

**Example Roles**: Lead Researcher, Technical Writer, Code Reviewer

---

### Run
<div dir="rtl">

**تشغيل** - تنفيذ فعلي لفريق على مهمة محددة.

</div>

**Lifecycle**: `pending` → `running` → `completed` / `failed` / `cancelled`

**Tracking**: `GET /api/v1/runs/:run_id`

**Streaming**: `GET /api/v1/runs/:run_id/events` (SSE)

---

## S

### Semantic Cache
<div dir="rtl">

**ذاكرة دلالية مؤقتة** - تخزين مؤقت يستخدم التشابه الدلالي بدل التطابق الحرفي.

</div>

**How**: Uses embedding similarity (cosine distance)

**Threshold**: 0.95 for exact, 0.85 for similar

**Storage**: Redis + pgvector

---

### Sensitive Tool
<div dir="rtl">

**أداة حساسة** - أداة تتطلب موافقة قبل التنفيذ.

</div>

**Examples**: File deletion, destructive DB ops, git push, external API calls

**Workflow**: Tool call → approval request → user approval → execute

---

### Server-Sent Events (SSE)
<div dir="rtl">

**أحداث من الخادم** - بروتوكول stream أحادي الاتجاه من الخادم للعميل.

</div>

**Usage**: Real-time run updates, progress streaming

**Endpoint**: `GET /api/v1/runs/:run_id/events`

**Content-Type**: `text/event-stream`

---

### Skill
<div dir="rtl">

**مهارة** - تعليمات متخصصة للوكيل (مثل: كيفية كتابة كود نظيف).

</div>

**Categories**: Core, Shared, Coding, Research, Content, Data

**Total**: 21 built-in skills

**Format**: SKILL.md (Markdown file)

---

### Specialist
<div dir="rtl">

**متخصص** - وكيل ينفذ دور محدد في الفريق.

</div>

**Execution**: Parallel (when no dependencies)

**Output**: SpecialistResult (content, tool calls, tokens, duration)

---

### SSE
See **Server-Sent Events**

---

## T

### Tavily
<div dir="rtl">

**Tavily** - API بحث ويب مصمم للوكلاء الذكية.

</div>

**Features**: Real-time search, source extraction, citation generation

**Alternative**: Exa, Firecrawl

---

### Template
<div dir="rtl">

**قالب** - تصميم فريق محدد مسبقاً لحالة استخدام شائعة.

</div>

**Built-in**: Research, Coding, Content, Data, Mixed

**Format**: YAML file

**Customization**: Can be forked and modified

---

### Token
<div dir="rtl">

**رمز** - وحدة نص أساسية (كلمة جزئية أو كاملة) يعالجها النموذج.

</div>

**Typical**: 1 token ≈ 0.75 words (English)

**Usage**: Model input + output tokens

**Cost**: Charged per 1M tokens (varies by model)

---

### Tool
<div dir="rtl">

**أداة** - وظيفة خارجية يمكن للوكيل استدعاؤها (مثل: بحث ويب، قراءة ملف).

</div>

**Types**: MCP tools, provider-native tools, local sandbox tools

**Execution**: Always through `tool_executor` node

---

### Tool Broker
<div dir="rtl">

**وسيط الأدوات** - مكون يدير تنفيذ الأدوات بشكل موحد.

</div>

**Priority**: MCP → Provider-Native → Local Sandbox

**Features**: Approval workflow, execution tracing, timeout handling

---

### Tracing
<div dir="rtl">

**التتبع** - تسجيل تفصيلي لتدفق التنفيذ عبر الخدمات.

</div>

**Tools**: LangSmith (native), OpenTelemetry (distributed)

**Benefits**: Debugging, performance analysis, error tracking

---

### Turborepo
<div dir="rtl">

**Turborepo** - أداة بناء عالية الأداء للـ monorepos.

</div>

**Features**: Parallel builds, caching, remote caching

**Usage**: `pnpm run build`, `pnpm run dev`, `pnpm run test`

---

### TypeScript
<div dir="rtl">

**TypeScript** - لغة برمجة مبنية على JavaScript مع نظام أنواع ثابت.

</div>

**Version**: 5.7+

**Mode**: Strict

**Features**: Type safety, interfaces, generics

---

## V

### Vault
<div dir="rtl">

**Vault** - أداة من HashiCorp لإدارة الأسرار والتشفير.

</div>

**Usage**: Store API keys, encrypt sensitive data

**Alternative**: AWS KMS, GCP KMS, Azure Key Vault

---

### Verifier Node
<div dir="rtl">

**عقدة التحقق** - المرحلة 12 في LangGraph. تتحقق من جودة النتيجة.

</div>

**Decision**: Pass → finalizer | Fail → planner (max 2 loops)

**Model**: Uses high-quality model for verification

**Criteria**: Completeness, accuracy, quality, constraints

---

### Vitest
<div dir="rtl">

**Vitest** - إطار اختبار وحدات (unit testing) سريع لـ JavaScript/TypeScript.

</div>

**Features**: Fast, ESM-first, compatible with Jest API

**Usage**: `pnpm run test`, `pnpm --filter <package> run test -- --watch`

---

## W

### WebSocket
<div dir="rtl">

**WebSocket** - بروتوكول تواصل ثنائي الاتجاه عبر TCP.

</div>

**Usage**: Real-time bidirectional communication (run updates, tool feedback)

**Advantages**: Lower latency than SSE, bidirectional

---

## Z

### Zod
<div dir="rtl">

**Zod** - مكتبة TypeScript للتحقق من البيانات والـ schemas.

</div>

**Usage**: API request validation, environment variable parsing

**Example**:
```typescript
const schema = z.object({
  task: z.string().min(10),
  requirements: z.object({
    length: z.string().optional()
  })
});
```

---

## Common Acronyms

| Acronym | Full Form | Arabic |
|---------|-----------|--------|
| **A2A** | Agent-to-Agent | وكيل-إلى-وكيل |
| **API** | Application Programming Interface | واجهة برمجة التطبيقات |
| **DLP** | Data Loss Prevention | منع فقدان البيانات |
| **E2E** | End-to-End | من البداية للنهاية |
| **HITL** | Human-in-the-Loop | الإنسان في الحلقة |
| **JWT** | JSON Web Token | رمز ويب JSON |
| **KMS** | Key Management Service | خدمة إدارة المفاتيح |
| **LLM** | Large Language Model | نموذج لغوي كبير |
| **MCP** | Model Context Protocol | بروتوكول سياق النموذج |
| **PII** | Personally Identifiable Information | معلومات شخصية محددة |
| **RBAC** | Role-Based Access Control | التحكم المبني على الأدوار |
| **SSE** | Server-Sent Events | أحداث من الخادم |
| **TLS** | Transport Layer Security | أمان طبقة النقل |
| **TTL** | Time To Live | مدة الحياة |

---

## See Also

- [FAQ](FAQ.md) - Frequently Asked Questions
- [Architecture Overview](architecture/OVERVIEW.md) - System architecture
- [User Guide](user-guide/GETTING_STARTED.md) - Getting started

---

<div align="center" dir="rtl">

**Glossary - v1.0.0**

آخر تحديث: 2024-02-24

</div>
