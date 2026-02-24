## خطة مدمجة نهائية لبناء تطبيق فرق وكلاء متعددة النماذج جاهز للإنتاج

`TypeScript + LangGraph + LiteLLM + MCP + Agent Skills`

### 1) ملخص

هذه الخطة تدمج بالكامل كل المزايا الواردة في الملفات السبعة ضمن تصميم إنتاجي واحد.  
الناتج المستهدف: منصة `Web + API` تبني فريق وكلاء تلقائيًا لكل مهمة، تختار أفضل نموذج لكل دور، تفعّل الأدوات والمهارات المناسبة ديناميكيًا، وتدعم الحوكمة، الأمان، الاسترجاع، والتكاملات المؤسسية.

### 2) حسم التعارضات (كما طلبت)

| التعارض                                                 | مصدره                                      | القرار النهائي                                                              |
| ------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------- |
| `SQLite` مقابل `PostgreSQL + pgvector`                  | الخطة الأصلية مقابل تقارير التحسين         | اعتماد `PostgreSQL + pgvector` كأساس إنتاجي، مع `SQLite` للتطوير المحلي فقط |
| سياسة `Quality-first` مقابل التوجيه المعتمد على التكلفة | خطتك السابقة مقابل تقارير التوفير          | اعتماد `Quality-first` بالكامل، والكلفة لا تؤثر على اختيار النموذج          |
| طلبك `بدون تتبع تكلفة` مقابل توصيات `Cost Tracking`     | طلبك الأخير مقابل تقارير التحسين           | تعطيل تتبع التكلفة تمامًا في المنتج (لا UI ولا تقارير تكلفة)                |
| أدوات Claude الأصلية مقابل التعدد المزودي               | تقرير الأدوات مقابل معمارية متعددة النماذج | طبقة `Tool Broker` موحدة: أدوات MCP أولًا + أدوات مزود أصلية عند الحاجة فقط |
| قوالب ثابتة مقابل Template Marketplace                  | PLAN مقابل PLAN2/Enhancement               | دعم القوالب الثابتة + Marketplace YAML من الإصدار الإنتاجي الكامل           |

### 3) المعمارية النهائية (Production-Complete)

1. `apps/web`: Next.js UI (لوحة بناء الفريق، الموافقات، المراقبة، المحادثات متعددة الجولات).
2. `apps/api`: Fastify BFF + REST/SSE + WebSocket.
3. `packages/agent-core`: LangGraph graphs, orchestrators, nodes, revisions, HITL.
4. `packages/model-router`: Quality-first routing + diversity policy + fallback policy.
5. `packages/tool-broker`: MCP clients + provider-native tools adapters.
6. `packages/skills-engine`: SkillRegistry + SkillActivator + SkillWatcher + SkillInstaller.
7. `packages/a2a-gateway`: A2A endpoints + Agent Card + federation.
8. `packages/observability`: LangSmith + OpenTelemetry + audit events.
9. `packages/security`: RBAC, policy engine, encryption, DLP, rate limiting, secrets.
10. `infra/litellm`: Gateway config, routing pools, retries, guardrails.
11. `infra/postgres`: main DB + pgvector + graph checkpoints.
12. `infra/redis`: prompt/semantic cache + queues + coordination.
13. `infra/workers`: BullMQ pools + async batch execution.
14. `infra/deploy`: Docker + K8s manifests + Helm + multi-cloud profiles.

### 4) مواصفات التشغيل (LangGraph Decision-Complete)

الرسم التنفيذي الثابت:
`START -> intake -> profile -> template_select -> team_design -> model_route -> tools_allocate -> skills_load -> approval_gate -> planner -> specialists_parallel -> tool_executor -> aggregate -> verifier -> human_feedback(optional) -> finalizer -> END`

قواعد إلزامية:

1. `Verifier` دائمًا قبل `Finalizer`.
2. `revision loop` حتى حد أقصى `2`، ثم إنهاء إجباري موثّق.
3. `approval_gate` يعمل في نمط `Approval` و`Auto` مع `interrupt` للأدوات الحساسة.
4. جميع استدعاءات الأدوات تمر عبر `tool_executor` فقط.
5. جميع العقد تكتب مفاتيح `State` المصرح بها فقط.

### 5) سياسة اختيار النموذج والأدوات والمهارات

#### اختيار النموذج (Quality-first)

- `hard filters`: tool-calling, context size, structured output, reliability, language fit.
- `score = quality(0.65) + tool_reliability(0.20) + capability_fit(0.10) + latency_reliability(0.05)`.
- الكلفة ليست جزءًا من `score`.
- تنويع إجباري: حد أدنى نموذجين مختلفين في الفريق.
- Fallback chain على مستوى كل دور.

#### اختيار الأدوات

- أولوية التنفيذ: MCP tools ثم provider-native ثم local sandbox tools.
- `Bigtool semantic selection` لاختيار subset الأدوات تلقائيًا عند كثرة الأدوات.
- `sensitive tools` تتطلب موافقة بشرية: الكتابة الحرجة، DB destructive ops، git push، external side effects.

#### اختيار المهارات

- محرك مهارات ديناميكي Progressive Disclosure.
- تحميل metadata خفيف دائمًا، وتحميل تفاصيل `SKILL.md` عند التفعيل فقط.
- فئات المهارات المفعّلة:
  - Core: orchestrator-core, planner-core, verifier-core, finalizer-core.
  - Shared: inter-agent-communication, context-management, error-handling.
  - Coding: code-generation, code-review, test-generation, debugging.
  - Research: advanced-research, source-analysis, content-summarization, citation-management.
  - Content: content-writing, content-optimization, proofreading.
  - Data: data-analysis, data-visualization, insight-extraction.
  - Prebuilt: pptx/docx/xlsx/pdf.

### 6) واجهات API العامة (Public API Additions)

1. `POST /api/v1/team/draft`
2. `POST /api/v1/team/approve`
3. `POST /api/v1/team/run`
4. `POST /api/v1/team/runs/:runId/resume`
5. `GET /api/v1/runs/:runId`
6. `GET /api/v1/runs/:runId/events` (SSE)
7. `POST /api/v1/runs/:runId/tool-approve`
8. `GET /api/v1/models/catalog`
9. `GET /api/v1/templates`
10. `POST /api/v1/templates`
11. `PUT /api/v1/templates/:id`
12. `GET /api/v1/skills`
13. `POST /api/v1/skills/install`
14. `POST /api/v1/skills/reload`
15. `GET /api/v1/mcp/catalog`
16. `POST /api/v1/mcp/servers`
17. `PUT /api/v1/mcp/servers/:id`
18. `POST /api/v1/mcp/servers/:id/test`
19. `POST /api/v1/a2a/tasks`
20. `GET /api/v1/a2a/agents`
21. `POST /api/v1/integrations/slack/events`
22. `POST /api/v1/integrations/github/webhook`

### 7) تغييرات الواجهات/الأنواع (Public Interfaces/Types)

1. `TaskRequest`, `TaskProfile`, `TeamTemplate`, `RoleBlueprint`.
2. `RoleAssignment`, `ModelProfile`, `ModelDecision`, `ToolPolicy`, `SkillActivation`.
3. `RunState`, `VerificationResult`, `RevisionDecision`, `ArtifactMeta`.
4. `McpServerConfig`, `McpToolDescriptor`, `ToolExecutionTrace`.
5. `A2ATaskRequest`, `A2ATaskResult`, `AgentCard`.
6. `SecurityContext`, `RbacRole`, `PermissionMatrix`, `AuditEvent`.
7. `ConversationThread`, `MessageEnvelope`, `ContextSnapshot`.
8. `ApiError` موحد مع `error_code`, `retryable`, `trace_id`.

### 8) نموذج البيانات النهائي

#### PostgreSQL

- `users`, `teams`, `projects`, `sessions`
- `runs`, `run_steps`, `run_events`, `run_checkpoints`
- `team_drafts`, `role_assignments`, `model_decisions`
- `templates`, `template_versions`, `template_marketplace`
- `skills_registry`, `skill_versions`, `skill_activations`
- `mcp_servers_registry`, `mcp_tools_registry`, `tool_calls_trace`
- `artifacts`, `thread_messages`, `audit_logs`
- `memory_episodic`, `memory_semantic` (pgvector), `memory_governance`

#### Redis

- prompt cache keys
- semantic cache index metadata
- BullMQ queues
- distributed locks
- pub/sub coordination

### 9) الأمان والموثوقية (مفعل إنتاجيًا)

1. RBAC متعدد الأدوار مع فصل projects/teams.
2. تشفير الأسرار والبيانات الحساسة (KMS/Vault).
3. Rate limiting + throttling + abuse controls.
4. DLP filters قبل استدعاءات النماذج والأدوات.
5. Circuit breaker + retry exponential backoff + fallback plans.
6. Checkpoint persistence + resume + backup + DR runbooks.
7. Audit logging غير قابل للتلاعب.
8. Guardrails للإدخال/الإخراج ومنع prompt injection.

### 10) تجربة المستخدم (Production UX)

1. Team Draft Preview قبل التنفيذ.
2. Task Dashboard شامل للحالات والـ retries والإلغاء.
3. Multi-turn conversations.
4. Workflow visualization.
5. Artifact manager مع تنزيلات وتقارير.
6. Responsive كامل + Dark mode + Keyboard shortcuts + Autocomplete + Drag/Drop.
7. Live tool timeline (أحداث الأدوات لحظيًا).
8. مقارنة جانبية لنتائج تشغيلات متعددة.
9. BYO MCP server onboarding UI.
10. Template Marketplace UI.

### 11) التكاملات الخارجية

1. MCP: GitHub, PostgreSQL/SQLite, Filesystem, Playwright, Slack, Notion, Supabase.
2. Search stack: Tavily أساسي + Exa/Firecrawl احتياطي.
3. Dev Observability: LangSmith + OpenTelemetry.
4. Collaboration: Slack/Teams.
5. Dev workflow: GitHub/GitLab.
6. Knowledge: Notion/Confluence.
7. PM: Jira/Trello.
8. Automation: Zapier/Make.
9. Cloud: AWS/GCP/Azure deployment profiles.
10. Sandbox execution: E2B + local isolated runners.

### 12) خطة التنفيذ الشاملة حسب حزم العمل (تضم كل الميزات)

#### الحزمة الأساسية — Production Core

- PostgreSQL+pgvector, Redis, LiteLLM, LangGraph parallel orchestration, checkpoints, MCP core, 21 skills الأساسية, RBAC, encryption, rate limiting, retries/circuit breaker, LangSmith, API core, Team Draft/Approval/Run.

#### حزمة التوسّع — Scale & Productization

- semantic caching, worker pools, batch processing, dashboard, multi-turn, template customization, full docs API, audit logging, DLP, Slack/GitHub integrations, workflow visualization, artifact manager.

#### حزمة اكتمال المنظومة — Ecosystem Complete

- A2A gateway, template marketplace, BYO MCP, hierarchical orchestration, Notion/Jira/Zapier integrations, Kubernetes/Helm, multi-cloud profiles, advanced UX (comparison, drag/drop, animations).

الناتج النهائي بعد اكتمال جميع حزم العمل: المنتج “مكتمل الميزات” وفق كل ملفاتك.

### 13) الاختبارات المطلوبة (Decision-Complete)

1. Unit: routing, skill activation, tool policy, state reducers, RBAC permissions.
2. Integration: MCP handshake, tool approval interrupts, fallback chains, checkpoint resume, template marketplace import/export.
3. E2E: Research/Coding/Content/Data لكلٍ من Auto وApproval مع multi-turn.
4. Security tests: prompt injection, PII leaks, authz bypass, rate abuse, secret exposure.
5. Reliability tests: provider outage, MCP timeout, queue backlog, retry storms, circuit breaker recovery.
6. Performance tests: p95 latency, parallel throughput, cache hit rates, 1k concurrent runs.
7. DR tests: backup restore, checkpoint replay, region failover simulation.
8. UAT: preview accuracy, workflow transparency, artifact correctness, integrations usability.

### 14) معايير القبول النهائية

1. بناء فريق تلقائي صحيح لكل قالب مع اختيار نماذج متنوع إجباريًا.
2. كل دور يتلقى `Model + Tools + Skills` متوافقين مع المهمة.
3. استئناف التشغيل بعد الانقطاع من آخر checkpoint بدون فقدان.
4. نجاح أنماط Auto وApproval وinterrupt للأدوات الحساسة.
5. جاهزية أمان إنتاجي: RBAC + encryption + guardrails + audit.
6. نجاح التكاملات الأساسية MCP + LangSmith + Redis + Postgres.
7. نجاح اختبارات الموثوقية والأداء ضمن SLOs.
8. اكتمال جميع الميزات المذكورة في ملفات المصدر عند اكتمال جميع حزم العمل.

### 15) الافتراضات والافتراضات الافتراضية

1. لغة الواجهة العربية مع دعم الإنجليزية.
2. لا يوجد تتبع تكلفة في المنتج بناءً على طلبك.
3. السياسة التشغيلية: جودة أولًا دون قيود ميزانية.
4. PostgreSQL هو قاعدة الإنتاج الرسمية.
5. كل تكامل خارجي يعمل عبر feature flags قابلة للتعطيل.
6. يتم اعتماد Docker/K8s كمسار النشر القياسي للإنتاج.
