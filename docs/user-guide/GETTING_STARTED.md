# دليل البدء السريع | Getting Started Guide

<div dir="rtl">

## مرحباً بك في منصة فرق الوكلاء!

هذا الدليل سيساعدك على البدء من الصفر حتى تشغيل أول فريق وكلاء في دقائق.

</div>

---

## Prerequisites | المتطلبات

<div dir="rtl">

### 1. البرامج المطلوبة

</div>

- **Node.js 20+** LTS ([تحميل](https://nodejs.org/))
- **pnpm** 10.28.2+ (سيتم تثبيته تلقائياً)
- **Docker Desktop** ([تحميل](https://www.docker.com/products/docker-desktop))
- **Git** ([تحميل](https://git-scm.com/))

<div dir="rtl">

### 2. مفاتيح API (اختياري للبداية)

للاستخدام الكامل، ستحتاج على الأقل واحد من:

</div>

- **OpenAI API Key** ([احصل عليه](https://platform.openai.com/api-keys))
- **Anthropic API Key** ([احصل عليه](https://console.anthropic.com/))
- **Google AI API Key** ([احصل عليه](https://ai.google.dev/))

<div dir="rtl">

**ملاحظة**: يمكنك البدء بدون مفاتيح API باستخدام نماذج محلية، لكن التجربة ستكون محدودة.

</div>

---

## Installation | التثبيت

### Step 1: Clone Repository

```bash
# Clone the repository
git clone https://github.com/your-org/multi-model-agent-teams-platform.git
cd multi-model-agent-teams-platform
```

### Step 2: Install Dependencies

```bash
# pnpm will be installed automatically via packageManager field
pnpm install
```

<div dir="rtl">

**الوقت المتوقع**: 2-5 دقائق حسب سرعة الإنترنت

</div>

### Step 3: Environment Setup

```bash
# Copy environment template
cp .env.example .env
```

<div dir="rtl">

افتح `.env` وأضف مفاتيح API:

</div>

```env
# Required: Database & Cache
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/agents
REDIS_URL=redis://localhost:6379

# Required: LiteLLM Gateway
LITELLM_API_BASE=http://localhost:4001
LITELLM_MASTER_KEY=sk-1234  # Any random string for dev

# Optional but recommended: LLM Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...

# Optional: Observability
LANGSMITH_API_KEY=...  # Get from https://smith.langchain.com

# Optional: Tools
TAVILY_API_KEY=...  # For web search
E2B_API_KEY=...  # For code execution
GITHUB_TOKEN=...  # For GitHub integration
```

### Step 4: Start Infrastructure

```bash
# Start PostgreSQL, Redis, and LiteLLM
docker compose up postgres redis litellm -d
```

<div dir="rtl">

تحقق من عمل الخدمات:

</div>

```bash
docker ps
# Should show 3 running containers
```

### Step 5: Database Setup

```bash
# Run migrations
pnpm run db:migrate

# Seed initial data (templates, skills)
pnpm run db:seed
```

### Step 6: Start Applications

<div dir="rtl">

**خيار 1: تشغيل كل شيء مرة واحدة**

</div>

```bash
pnpm run dev
```

<div dir="rtl">

**خيار 2: تشغيل منفصل (مفيد للتطوير)**

</div>

```bash
# Terminal 1: API Server
pnpm --filter @repo/api run dev

# Terminal 2: Web UI
pnpm --filter @repo/web run dev
```

---

## Verify Installation | التحقق من التثبيت

<div dir="rtl">

### 1. تحقق من API

</div>

```bash
curl http://localhost:4000/health/ready
```

<div dir="rtl">

**النتيجة المتوقعة**:

</div>

```json
{
  "status": "ready",
  "timestamp": "2024-02-24T12:00:00Z",
  "services": {
    "database": "connected",
    "redis": "connected",
    "litellm": "available"
  }
}
```

<div dir="rtl">

### 2. تحقق من Web UI

</div>

افتح المتصفح: http://localhost:3000

<div dir="rtl">

يجب أن ترى واجهة تسجيل الدخول.

### 3. تحقق من LiteLLM

</div>

افتح: http://localhost:4001

<div dir="rtl">

يجب أن ترى LiteLLM dashboard.

</div>

---

## Your First Team | أول فريق لك

<div dir="rtl">

### الطريقة 1: عبر Web UI (الأسهل)

#### 1. سجل الدخول

</div>

```
Email: demo@example.com
Password: demo123
```

<div dir="rtl">

(مستخدم تجريبي من seed data)

#### 2. اذهب إلى Team Builder

</div>

Dashboard → Create New Team

<div dir="rtl">

#### 3. صف مهمتك

</div>

```
Task: Research the latest developments in LangGraph and write a 1000-word summary

Requirements:
- Include code examples
- Cite sources
- Explain key concepts clearly

Deadline: Tomorrow
```

<div dir="rtl">

#### 4. اختر قالب

</div>

اختر: **Research & Analysis Team**

<div dir="rtl">

#### 5. راجع الفريق

</div>

سترى:
- 4 أدوار (Lead Researcher, Fact Checker, Writer, Reviewer)
- النماذج المخصصة (GPT-4o, Claude Opus 4, etc.)
- الأدوات المخصصة (Tavily Search, Web Scraper, etc.)
- المهارات المفعلة (Research Methodology, Writing, etc.)

<div dir="rtl">

#### 6. وافق وشغّل

</div>

- انقر **Approve Draft**
- انقر **Run Team**
- شاهد التنفيذ في الوقت الفعلي!

---

<div dir="rtl">

### الطريقة 2: عبر API (للمطورين)

</div>

```bash
# 1. Login
TOKEN=$(curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"demo123"}' \
  | jq -r '.token')

# 2. Create draft
DRAFT=$(curl -X POST http://localhost:4000/api/v1/team/draft \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Research LangGraph and write a summary",
    "requirements": {
      "length": "1000 words",
      "include_code_examples": true
    },
    "preferences": {
      "template_category": "research"
    }
  }' | jq -r '.draft_id')

echo "Draft ID: $DRAFT"

# 3. Approve
curl -X POST http://localhost:4000/api/v1/team/approve \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"draft_id\":\"$DRAFT\",\"approved\":true}"

# 4. Run
RUN=$(curl -X POST http://localhost:4000/api/v1/team/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"draft_id\":\"$DRAFT\"}" \
  | jq -r '.run_id')

echo "Run ID: $RUN"

# 5. Stream events (real-time updates)
curl -N http://localhost:4000/api/v1/runs/$RUN/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: text/event-stream"

# 6. Get final result (after completion)
curl http://localhost:4000/api/v1/runs/$RUN \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.final_output'
```

---

## Understanding the Execution | فهم التنفيذ

<div dir="rtl">

### مراحل التنفيذ

عند تشغيل فريق، يمر بـ **13 مرحلة** (nodes):

</div>

```
1. Intake         → استقبال المهمة
2. Profile        → تحليل المتطلبات
3. Template Select → اختيار القالب
4. Team Design    → تصميم الفريق
5. Model Route    → اختيار النماذج
6. Tools Allocate → تخصيص الأدوات
7. Skills Load    → تحميل المهارات
8. Approval Gate  → بوابة الموافقة ⏸️
9. Planner        → إنشاء خطة التنفيذ
10. Specialists   → تنفيذ المتخصصين (parallel)
11. Tool Executor → تنفيذ الأدوات
12. Aggregate     → دمج النتائج
13. Verifier      → التحقق من الجودة
14. Finalizer     → إنهاء وإرجاع النتيجة
```

<div dir="rtl">

### مراقبة التقدم

#### عبر Web UI

</div>

Dashboard → Runs → [Your Run]

<div dir="rtl">

سترى:
- **Progress Bar**: النسبة المئوية للإنجاز
- **Current Node**: المرحلة الحالية
- **Live Logs**: سجلات حية
- **Workflow Visualization**: رسم بياني للتنفيذ

#### عبر SSE Stream

</div>

```bash
curl -N http://localhost:4000/api/v1/runs/$RUN_ID/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: text/event-stream"
```

<div dir="rtl">

**الأحداث التي ستراها**:

</div>

```
event: node_started
data: {"node":"intake","timestamp":"..."}

event: node_completed
data: {"node":"intake","duration_ms":1200}

event: node_started
data: {"node":"profile"}

...

event: specialist_started
data: {"role":"lead_researcher","model":"gpt-4o"}

event: tool_call
data: {"tool":"tavily_search","args":{"query":"LangGraph"}}

event: tool_result
data: {"tool":"tavily_search","result_summary":"Found 15 results"}

...

event: run_completed
data: {"run_id":"...","status":"completed"}
```

---

## Exploring Features | استكشاف الميزات

<div dir="rtl">

### 1. قوالب الفرق

</div>

```bash
# List available templates
curl http://localhost:4000/api/v1/templates \
  -H "Authorization: Bearer $TOKEN"
```

<div dir="rtl">

**القوالب المتاحة**:
- **Research Team**: للبحث والتحليل
- **Coding Team**: للبرمجة والمراجعة
- **Content Team**: لإنشاء المحتوى
- **Data Team**: لتحليل البيانات
- **Mixed Team**: للمهام المختلطة

### 2. المهارات

</div>

```bash
# List skills
curl http://localhost:4000/api/v1/skills \
  -H "Authorization: Bearer $TOKEN"
```

<div dir="rtl">

**فئات المهارات**:
- **Core** (3 مهارات): problem-analysis, planning, verification
- **Shared** (4): communication, error-handling, documentation
- **Coding** (5): code-review, debugging, testing, optimization
- **Research** (3): web-research, data-extraction, synthesis
- **Content** (3): writing, editing, formatting
- **Data** (3): transformation, visualization, analysis

### 3. النماذج المتاحة

</div>

```bash
# List models
curl http://localhost:4000/api/v1/models/catalog \
  -H "Authorization: Bearer $TOKEN"
```

<div dir="rtl">

**النماذج المدعومة** (عبر LiteLLM):
- OpenAI: GPT-4o, GPT-4-Turbo, GPT-3.5-Turbo
- Anthropic: Claude Opus 4, Sonnet 4.5, Haiku 4
- Google: Gemini 2.0 Flash, Gemini 1.5 Pro
- Cohere, Mistral, وأكثر...

### 4. أدوات MCP

</div>

```bash
# List MCP tools
curl http://localhost:4000/api/v1/mcp/catalog \
  -H "Authorization: Bearer $TOKEN"
```

<div dir="rtl">

**الأدوات المدمجة**:
- **GitHub**: البحث، PRs، Issues
- **PostgreSQL**: استعلامات قاعدة البيانات
- **Filesystem**: قراءة/كتابة الملفات
- **Playwright**: تشغيل آلي للمتصفح
- **Tavily**: بحث ويب

</div>

---

## Common Use Cases | حالات استخدام شائعة

<div dir="rtl">

### 1. البحث والتلخيص

</div>

```json
{
  "task": "Research the topic of quantum computing and create a comprehensive summary",
  "requirements": {
    "depth": "comprehensive",
    "sources": 10,
    "length": "2000 words"
  },
  "preferences": {
    "template_category": "research"
  }
}
```

<div dir="rtl">

**النتيجة**: ملخص مفصل مع مصادر، أمثلة، وتوضيحات

### 2. مراجعة كود

</div>

```json
{
  "task": "Review this pull request and provide detailed feedback",
  "requirements": {
    "repository": "https://github.com/user/repo",
    "pr_number": 123,
    "focus_areas": ["security", "performance", "best_practices"]
  },
  "preferences": {
    "template_category": "coding"
  }
}
```

<div dir="rtl">

**النتيجة**: مراجعة شاملة مع اقتراحات تحسين

### 3. إنشاء محتوى

</div>

```json
{
  "task": "Write a technical blog post about microservices architecture",
  "requirements": {
    "length": "1500 words",
    "tone": "professional but accessible",
    "include_diagrams": true,
    "seo_optimized": true
  },
  "preferences": {
    "template_category": "content"
  }
}
```

<div dir="rtl">

**النتيجة**: مقال كامل مع صور، SEO، وتنسيق

### 4. تحليل بيانات

</div>

```json
{
  "task": "Analyze this dataset and provide insights",
  "requirements": {
    "dataset_url": "https://example.com/data.csv",
    "analysis_type": "exploratory",
    "create_visualizations": true
  },
  "preferences": {
    "template_category": "data"
  }
}
```

<div dir="rtl">

**النتيجة**: تحليل مع رسوم بيانية وتوصيات

</div>

---

## Tips & Best Practices | نصائح وأفضل الممارسات

<div dir="rtl">

### 1. كتابة مهمة واضحة

</div>

**❌ سيء**:
```
"Write something about AI"
```

**✅ جيد**:
```
"Research the latest developments in AI model architectures (2024) and write a 1500-word technical article explaining transformer models, with code examples and diagrams."
```

<div dir="rtl">

### 2. تحديد المتطلبات

كن محدداً في:
- **Length**: الطول المطلوب
- **Tone**: الأسلوب (رسمي، تقني، بسيط)
- **Format**: التنسيق (Markdown, HTML, PDF)
- **Depth**: العمق (سطحي، متوسط، شامل)
- **Deadline**: الموعد النهائي

### 3. اختيار القالب الصحيح

| نوع المهمة | القالب المناسب |
|------------|----------------|
| بحث وتحليل | Research Team |
| برمجة ومراجعة | Coding Team |
| كتابة محتوى | Content Team |
| تحليل بيانات | Data Team |
| مهمة متعددة الجوانب | Mixed Team |

### 4. استخدام Approval Mode

تفعيل **Approval Mode** عندما:
- المهمة حساسة
- تريد مراجعة الفريق قبل التنفيذ
- تستخدم أدوات خطرة (حذف، تعديل قواعد بيانات)

### 5. مراقبة التكاليف (اختياري)

على الرغم من أن المنصة لا تتبع التكاليف، يمكنك مراقبتها عبر:
- LiteLLM dashboard: http://localhost:4001
- مزودي النماذج (OpenAI, Anthropic dashboards)

</div>

---

## Troubleshooting | حل المشاكل

<div dir="rtl">

### مشكلة: "Cannot connect to database"

</div>

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# If not, start it
docker compose up postgres -d

# Test connection
docker exec -it postgres psql -U postgres -d agents -c "SELECT 1"
```

<div dir="rtl">

### مشكلة: "LiteLLM not available"

</div>

```bash
# Check container
docker ps | grep litellm

# View logs
docker logs litellm

# Restart
docker compose restart litellm
```

<div dir="rtl">

### مشكلة: "Model not found"

تأكد من:
1. API key صحيح في `.env`
2. النموذج موجود في `infra/litellm/config.yaml`
3. LiteLLM تم إعادة تشغيله بعد تعديل config

### مشكلة: "Run stuck at approval_gate"

هذا طبيعي إذا كان **Approval Mode** مفعل.

حلول:
1. افتح Web UI وافق على الفريق
2. أو استخدم API:

</div>

```bash
curl -X POST http://localhost:4000/api/v1/runs/$RUN_ID/resume \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"approval_status":"approved"}'
```

<div dir="rtl">

### مشكلة: "Slow execution"

تحسينات:
1. تفعيل **Semantic Cache** (راجع [CACHING.md](../architecture/CACHING.md))
2. استخدام نماذج أسرع (Gemini Flash بدل GPT-4)
3. تقليل عدد الأدوار في القالب
4. زيادة موارد Docker

</div>

---

## Next Steps | الخطوات التالية

<div dir="rtl">

### تعلم أكثر

</div>

- [Team Builder Guide](TEAM_BUILDER.md) - بناء فرق مخصصة
- [Templates Guide](TEMPLATES.md) - إنشاء قوالب خاصة
- [Skills Guide](SKILLS.md) - إضافة مهارات مخصصة
- [MCP Servers](MCP_SERVERS.md) - تكامل أدوات جديدة
- [API Reference](../api/REST_API.md) - تطوير تطبيقات

<div dir="rtl">

### أمثلة عملية

</div>

- [Research Team Example](../examples/RESEARCH_TEAM.md)
- [Coding Team Example](../examples/CODING_TEAM.md)
- [Content Team Example](../examples/CONTENT_TEAM.md)
- [Custom Template Example](../examples/CUSTOM_TEMPLATE.md)

<div dir="rtl">

### للمطورين

</div>

- [Development Setup](../development/SETUP.md)
- [Contributing Guide](../development/CONTRIBUTING.md)
- [Code Style](../development/CODE_STYLE.md)
- [Testing Guide](../development/TESTING.md)

---

## Getting Help | الحصول على مساعدة

<div dir="rtl">

### الموارد

</div>

- **Documentation**: [docs/](../)
- **FAQ**: [FAQ.md](../FAQ.md)
- **GitHub Issues**: [Report a bug](https://github.com/your-org/repo/issues)
- **Discussions**: [Ask a question](https://github.com/your-org/repo/discussions)

<div dir="rtl">

### المجتمع

- Discord (قريباً)
- Twitter: @AgentTeamsPlatform (قريباً)

</div>

---

<div align="center" dir="rtl">

**مبروك! أنت الآن جاهز لبناء فرق وكلاء قوية**

**Congratulations! You're ready to build powerful agent teams**

🚀 Happy Building!

</div>
