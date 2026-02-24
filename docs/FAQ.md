# الأسئلة الشائعة | Frequently Asked Questions (FAQ)

<div dir="rtl">

## الأسئلة العامة

### ما هي منصة فرق الوكلاء متعددة النماذج؟

منصة احترافية مفتوحة المصدر لتنظيم الوكلاء الذكية. تقوم تلقائياً ببناء فرق من الوكلاء، واختيار أفضل النماذج لكل دور، وتنفيذ المهام المعقدة باستخدام LangGraph + LiteLLM + MCP.

### هل المنصة مجانية؟

المنصة مفتوحة المصدر (MIT License). ولكن ستحتاج إلى:
- مفاتيح API للنماذج (OpenAI, Anthropic, إلخ) - لها تكاليف
- خدمات البنية التحتية (PostgreSQL, Redis) - مجانية للتطوير
- خدمات اختيارية (Tavily للبحث) - لها تكاليف

### ما الفرق بينها وبين ChatGPT/Claude؟

| الميزة | ChatGPT/Claude | منصتنا |
|--------|---------------|---------|
| **الوكلاء** | وكيل واحد | فريق من الوكلاء المتخصصين |
| **النماذج** | نموذج واحد | تنويع ذكي بين عدة نماذج |
| **الأدوات** | محدودة | MCP - أدوات قابلة للتوصيل |
| **التحكم** | محدود | تحكم كامل في التنفيذ |
| **البيانات** | سحابية | يمكن تشغيلها محلياً |
| **التخصيص** | محدود | قوالب ومهارات مخصصة |

### لماذا "الجودة أولاً" بدلاً من "التكلفة أولاً"؟

نؤمن بأن النتائج عالية الجودة أهم من توفير التكاليف. لذلك:
- اختيار النموذج يعتمد 100% على الجودة والقدرات
- لا يوجد تتبع للتكاليف في المنتج
- يمكنك التحكم في التكاليف عبر LiteLLM مباشرة

---

## التثبيت والإعداد

### ما هي متطلبات النظام؟

**الحد الأدنى (للتطوير)**:
- Node.js 20+ LTS
- 4 GB RAM
- Docker Desktop
- 10 GB مساحة تخزين

**الإنتاج (موصى به)**:
- Node.js 20+ LTS
- 16 GB RAM
- PostgreSQL 16 + Redis 7 (مستقلة أو في Docker)
- 50 GB SSD
- Kubernetes cluster (للتوسع)

### كيف أبدأ بسرعة؟

</div>

```bash
# 1. Clone
git clone <repository-url>
cd multi-model-agent-teams-platform

# 2. Install
pnpm install

# 3. Environment
cp .env.example .env
# أضف مفاتيح API في .env

# 4. Infrastructure
docker compose up postgres redis litellm -d

# 5. Database
pnpm run db:migrate
pnpm run db:seed

# 6. Run
pnpm run dev
```

<div dir="rtl">

افتح http://localhost:3000

### لماذا pnpm وليس npm أو yarn؟

- **أسرع**: تثبيت أسرع بـ 2x-3x
- **أقل استهلاك**: يوفر مساحة القرص
- **أكثر أماناً**: dependency isolation
- **Monorepo-friendly**: مصمم للـ monorepos

يمكنك استخدام npm/yarn ولكن قد تواجه مشاكل في dependency resolution.

### خطأ: "pgvector extension does not exist"

</div>

```sql
-- قم بتشغيل هذا في PostgreSQL قبل المي

:
CREATE EXTENSION IF NOT EXISTS vector;
```

<div dir="rtl">

أو استخدم Docker Compose المرفق - يحتوي على pgvector.

### خطأ: "Cannot connect to LiteLLM"

تأكد من:
1. Docker container يعمل: `docker ps | grep litellm`
2. Port 4001 غير مستخدم
3. `.env` يحتوي على: `LITELLM_API_BASE=http://localhost:4001`

---

## النماذج والتوجيه

### ما النماذج المدعومة؟

عبر LiteLLM، ندعم 100+ نموذج من:
- **OpenAI**: GPT-4o, GPT-4-Turbo, GPT-3.5-Turbo
- **Anthropic**: Claude Opus 4.6, Sonnet 4.5, Haiku 4
- **Google**: Gemini 2.0 Flash, Gemini 1.5 Pro
- **Cohere**: Command R+
- **Mistral**: Large, Medium
- **Open Source**: Llama 3, Mixtral, Qwen, وغيرها

راجع [دليل النماذج](docs/user-guide/MODELS.md) للقائمة الكاملة.

### كيف يتم اختيار النموذج لكل دور؟

معادلة التسجيل (Quality-First):

</div>

```typescript
score = quality(0.65) + tool_reliability(0.20) + capability_fit(0.10) + latency_reliability(0.05)
```

<div dir="rtl">

- **quality**: جودة النموذج في المهمة المحددة
- **tool_reliability**: نجاح استدعاء الأدوات
- **capability_fit**: مدى ملاءمة قدرات النموذج
- **latency_reliability**: اتساق وقت الاستجابة

**التكلفة ليست عاملاً أبداً.**

### لماذا إجبار استخدام 2 نماذج مختلفة على الأقل؟

**التنويع يحسن الجودة**:
- نماذج مختلفة لها نقاط قوة مختلفة
- تقليل التحيز (bias)
- زيادة الإبداع والشمولية
- حماية من أخطاء نموذج واحد

### كيف أضيف نموذجاً جديداً؟

أضف في `infra/litellm/config.yaml`:

</div>

```yaml
model_list:
  - model_name: my-custom-model
    litellm_params:
      model: provider/model-name
      api_key: env::MY_API_KEY
      api_base: https://api.example.com
    router_config:
      priority: 1
```

<div dir="rtl">

ثم أعد تشغيل LiteLLM.

---

## الأدوات و MCP

### ما هو MCP؟

**Model Context Protocol** - معيار مفتوح من Anthropic لتوصيل الأدوات بالنماذج.

**المزايا**:
- معيار موحد
- أدوات قابلة لإعادة الاستخدام
- مجتمع متنامي
- أمان أفضل

### ما الأدوات المدعومة افتراضياً؟

**MCP Servers المدمجة**:
- `@modelcontextprotocol/server-github` - GitHub API
- `@modelcontextprotocol/server-postgres` - PostgreSQL
- `@modelcontextprotocol/server-filesystem` - File operations
- `@modelcontextprotocol/server-playwright` - Browser automation

**يمكنك إضافة أي MCP server**.

### كيف أضيف MCP server جديد؟

</div>

```typescript
// Via API
POST /api/v1/mcp/servers
{
  "name": "my-server",
  "command": "node",
  "args": ["path/to/server.js"],
  "env": {
    "API_KEY": "xxx"
  }
}
```

<div dir="rtl">

أو عبر Web UI: Settings → MCP Servers → Add Server

### ما الفرق بين MCP Tools و Provider-Native Tools؟

| MCP Tools | Provider-Native Tools |
|-----------|----------------------|
| معيار موحد | خاص بكل مزود |
| أي نموذج يدعم function calling | فقط نماذج المزود |
| إدارة مركزية | موزعة |
| **أولوية عالية** في المنصة | ثانوية |

المنصة تفضل MCP دائماً عند التوفر.

---

## المهارات (Skills)

### ما هي المهارات؟

**مهارات** هي تعليمات متخصصة للوكلاء. مثل:
- كيفية كتابة كود نظيف
- منهجية البحث
- استراتيجيات التصحيح
- معايير الكتابة

### كم عدد المهارات المتاحة؟

حالياً **21 مهارة أساسية** في فئات:
- Core (3): problem-analysis, planning, verification
- Shared (4): communication, error-handling, documentation, time-management
- Coding (5): code-review, debugging, testing, optimization, architecture
- Research (3): web-research, data-extraction, synthesis
- Content (3): writing, editing, formatting
- Data (3): transformation, visualization, analysis

### كيف أضيف مهارة مخصصة؟

</div>

```markdown
<!-- skills/my-custom-skill/SKILL.md -->
---
id: my-custom-skill
name: My Custom Skill
category: shared
tags: [custom, example]
version: 1.0.0
---

# My Custom Skill

## Purpose
Describe what this skill does...

## Instructions
Step-by-step instructions...

## Examples
```examples here```

## Tools Required
- tool-1
- tool-2
```

<div dir="rtl">

ثم أعد التحميل: `POST /api/v1/skills/reload`

### لماذا "Progressive Disclosure"؟

**الأداء والذاكرة**:
- 21 مهارة × 2 KB metadata = 42 KB (دائماً محمّل)
- Full SKILL.md (متوسط 10 KB) يُحمّل فقط عند التفعيل
- توفير الذاكرة خاصة مع مئات المهارات

---

## التنفيذ والأداء

### كم يستغرق تنفيذ مهمة؟

يعتمد على:
- تعقيد المهمة
- عدد الأدوار في الفريق
- استدعاءات الأدوات
- سرعة النماذج

**تقديرات**:
- بسيطة: 30-60 ثانية
- متوسطة: 2-5 دقائق
- معقدة: 5-15 دقيقة

### هل يمكن تسريع التنفيذ؟

**نعم**:
1. **Semantic Caching**: تفعيل التخزين المؤقت
2. **Parallel Execution**: تلقائي للمتخصصين
3. **Faster Models**: استخدام نماذج أسرع (Gemini Flash)
4. **Simpler Templates**: تقليل عدد الأدوار

### ماذا يحدث إذا فشل التنفيذ؟

**Retry Strategy**:
1. إعادة محاولة تلقائية (3 مرات مع exponential backoff)
2. Fallback لنماذج بديلة
3. حفظ Checkpoint - يمكن الاستئناف
4. إشعار المستخدم

### كيف أستأنف تنفيذاً متوقفاً؟

</div>

```bash
POST /api/v1/runs/:run_id/resume
{
  "approval_status": "approved"
}
```

<div dir="rtl">

أو عبر UI: Dashboard → Runs → Resume

---

## الأمان والخصوصية

### هل البيانات آمنة؟

**نعم - طبقات أمان متعددة**:
- ✅ تشفير البيانات at-rest و in-transit (TLS 1.3)
- ✅ RBAC لجميع الموارد
- ✅ DLP filters لمنع تسريب بيانات حساسة
- ✅ Audit logging كامل
- ✅ Secrets في KMS/Vault، ليس في database

### من يمكنه الوصول للبيانات؟

**RBAC Roles**:
- **Admin**: كامل الصلاحيات
- **Developer**: إنشاء وتشغيل الفرق
- **Operator**: مراقبة وإدارة
- **Viewer**: قراءة فقط

كل دور له permissions matrix محددة.

### هل النماذج ترى بياناتي الحساسة؟

**DLP Filters** تعمل قبل إرسال أي بيانات للنماذج:
- كشف PII (أسماء، عناوين، أرقام هواتف)
- كشف مفاتيح API
- كلمات مفتاحية حساسة
- Masking تلقائي

### كيف أمنع أدوات خطرة؟

**Sensitive Tools** تتطلب موافقة:
- حذف ملفات
- عمليات قاعدة بيانات مدمّرة
- Git push
- استدعاءات API خارجية

يمكنك تفعيل Approval Mode في الإعدادات.

---

## التوسع والإنتاج

### كم عدد الطلبات المتزامنة المدعومة؟

**يعتمد على البنية التحتية**:

**Development (Docker Compose)**:
- ~10 طلبات متزامنة

**Production (Kubernetes)**:
- مئات إلى آلاف
- Auto-scaling حسب الحمل
- BullMQ queues للمعالجة غير المتزامنة

### كيف أقيس الأداء؟

**Metrics متاحة عبر**:
- LangSmith dashboard
- OpenTelemetry metrics (Prometheus format)
- API: `GET /api/v1/metrics`

**KPIs**:
- Requests/second
- Average latency per node
- Token usage per model
- Cache hit rate
- Error rate

### كيف أنشر على Production؟

راجع [دليل النشر](docs/deployment/KUBERNETES.md):
- Docker للبيئات الصغيرة
- Kubernetes + Helm للإنتاج
- AWS/GCP/Azure configurations جاهزة

---

## الدعم والمجتمع

### كيف أحصل على مساعدة؟

1. **التوثيق**: ابدأ من [docs/](docs/)
2. **GitHub Issues**: [Report a bug](https://github.com/your-org/repo/issues)
3. **Discussions**: [Ask a question](https://github.com/your-org/repo/discussions)
4. **Discord**: قريباً

### كيف أساهم؟

راجع [CONTRIBUTING.md](docs/development/CONTRIBUTING.md):
1. Fork المشروع
2. أنشئ feature branch
3. اكتب tests
4. افتح Pull Request

نرحب بالمساهمات!

### أين أجد أمثلة عملية؟

- [Research Team](docs/examples/RESEARCH_TEAM.md)
- [Coding Team](docs/examples/CODING_TEAM.md)
- [Content Team](docs/examples/CONTENT_TEAM.md)
- [Data Analysis](docs/examples/DATA_TEAM.md)

---

## استكشاف الأخطاء

### خطأ: "Minimum diversity violation"

</div>

```
Error: Team must use at least 2 different models
```

<div dir="rtl">

**الحل**: تأكد من توفر نماذج متعددة في LiteLLM config.

### خطأ: "Checkpoint not found"

النقطة المحفوظة انتهت صلاحيتها (7 أيام). ابدأ run جديد.

### خطأ: "Tool execution failed"

تحقق من:
1. MCP server يعمل: `GET /api/v1/mcp/servers`
2. الأداة متاحة: `GET /api/v1/mcp/catalog`
3. Permissions صحيحة

### تشغيل بطيء

1. تفعيل semantic cache
2. استخدام نماذج أسرع للأدوار غير الحرجة
3. تقليل عدد الأدوار
4. زيادة موارد PostgreSQL/Redis

### استهلاك ذاكرة عالي

1. تقليل BullMQ workers
2. تفعيل connection pooling (PgBouncer)
3. تقليل checkpoint retention
4. زيادة RAM للـ containers

---

## الترخيص والقانون

### ما نوع الترخيص؟

**MIT License** - حرية كاملة:
- ✅ استخدام تجاري
- ✅ تعديل
- ✅ توزيع
- ✅ استخدام خاص

**شرط واحد**: حفظ إشعار حقوق النشر.

### هل يمكنني استخدامها تجارياً؟

**نعم** - بدون قيود. يمكنك:
- بناء منتج تجاري
- تقديم خدمة مدفوعة
- تخصيصها للعملاء

### ماذا عن تراخيص التبعيات؟

جميع التبعيات الأساسية مرخصة بـ MIT/Apache-2.0:
- LangGraph: MIT
- LiteLLM: MIT
- Next.js: MIT
- Fastify: MIT
- PostgreSQL: PostgreSQL License (permissive)
- Redis: BSD-3-Clause

---

## الخارطة المستقبلية

### ما المخطط قريباً؟

**Q2 2024**:
- Visual workflow builder (drag-and-drop)
- Template marketplace
- Mobile app (React Native)
- More MCP servers

**Q3 2024**:
- Multi-language UI (العربية كاملة)
- Advanced analytics dashboard
- Team collaboration features
- Enterprise SSO

راجع [ROADMAP.md](docs/ROADMAP.md) للتفاصيل.

### كيف أطلب ميزة جديدة؟

افتح [Feature Request](https://github.com/your-org/repo/issues/new?template=feature_request.md)

---

## مصادر إضافية

### وثائق مفيدة

- [Architecture Overview](docs/architecture/OVERVIEW.md)
- [API Reference](docs/api/REST_API.md)
- [User Guide](docs/user-guide/GETTING_STARTED.md)
- [Development Guide](docs/development/SETUP.md)

### روابط خارجية

- [LangGraph Docs](https://langchain-ai.github.io/langgraph/)
- [LiteLLM Docs](https://docs.litellm.ai/)
- [MCP Specification](https://modelcontextprotocol.io/)
- [Next.js Docs](https://nextjs.org/docs)

---

</div>

**لم تجد إجابة؟** [اسأل في Discussions](https://github.com/your-org/repo/discussions) أو [افتح Issue](https://github.com/your-org/repo/issues)

---

<div align="center" dir="rtl">

**آخر تحديث**: 2024-02-24

</div>
