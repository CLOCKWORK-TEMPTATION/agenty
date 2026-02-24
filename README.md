# منصة فرق الوكلاء متعددة النماذج
# Multi-Model Agent Teams Platform

<div dir="rtl">

منصة احترافية جاهزة للإنتاج لتنظيم الوكلاء الذكية متعددة النماذج - مبنية بـ TypeScript + LangGraph + LiteLLM + MCP

</div>

---

**Production-ready multi-agent orchestration platform built with TypeScript, LangGraph, LiteLLM, and MCP**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 🌟 الميزات الرئيسية | Key Features

<div dir="rtl">

### الميزات الأساسية

- **🤖 تجميع تلقائي للفرق**: بناء فرق وكلاء ذكية تلقائياً حسب المهمة
- **🎯 اختيار النماذج بجودة أولاً**: اختيار النماذج الأفضل بدون النظر للتكلفة
- **🔧 أدوات ديناميكية**: دعم MCP للأدوات القابلة للتوصيل
- **📚 نظام مهارات متقدم**: مكتبة مهارات قابلة للتوسع
- **🔒 أمان متقدم**: RBAC، تشفير، DLP، حماية من الحقن
- **📊 مراقبة شاملة**: تكامل مع LangSmith و OpenTelemetry
- **⚡ أداء عالي**: Semantic caching، معالجة دفعية، توزيع
- **🌐 قابلية التوسع**: معمارية Microservices جاهزة للإنتاج

### المزايا التقنية

- تنفيذ LangGraph مع checkpoint persistence
- توجيه ذكي عبر LiteLLM لـ 100+ نموذج
- بروتوكول MCP للأدوات القابلة للتوصيل
- Redis للتخزين المؤقت والطوابير
- PostgreSQL + pgvector للبحث الدلالي
- BullMQ للمعالجة غير المتزامنة
- Next.js 14 مع App Router
- Fastify للأداء العالي

</div>

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ LTS
- Docker & Docker Compose
- pnpm 10.28.2+

### Installation

```bash
# 1. Clone the repository
git clone <repository-url>
cd multi-model-agent-teams-platform

# 2. Install dependencies
pnpm install

# 3. Setup environment
cp .env.example .env
# Edit .env with your API keys

# 4. Start infrastructure
docker compose up postgres redis litellm -d

# 5. Run database migrations
pnpm run db:migrate

# 6. Seed initial data (optional)
pnpm run db:seed

# 7. Start development servers
pnpm run dev
```

### Access Points

- **Web UI**: http://localhost:3000
- **API Server**: http://localhost:4000
- **LiteLLM Gateway**: http://localhost:4001
- **API Documentation**: http://localhost:4000/docs

---

## 📖 التوثيق الكامل | Full Documentation

<div dir="rtl">

### الوثائق العربية

- [نظرة عامة على المعمارية](docs/architecture/OVERVIEW.md)
- [دليل الاستخدام](docs/user-guide/GETTING_STARTED.md)
- [دليل التطوير](docs/development/SETUP.md)
- [دليل النشر](docs/deployment/DOCKER.md)
- [أمثلة عملية](docs/examples/RESEARCH_TEAM.md)

### English Documentation

- [Architecture Overview](docs/architecture/OVERVIEW.md)
- [User Guide](docs/user-guide/GETTING_STARTED.md)
- [Development Guide](docs/development/SETUP.md)
- [Deployment Guide](docs/deployment/DOCKER.md)
- [API Reference](docs/api/REST_API.md)

</div>

---

## 🏗️ معمارية النظام | System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Web UI (Next.js)                     │
│              React 18 + Tailwind + shadcn/ui                 │
└─────────────────────────┬───────────────────────────────────┘
                          │ REST / SSE / WebSocket
┌─────────────────────────┴───────────────────────────────────┐
│                    API Server (Fastify)                      │
│         Authentication • RBAC • Rate Limiting                │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                  Agent Core (LangGraph)                      │
│  Intake → Profile → Team Design → Model Route → Execute     │
└─────┬─────────┬──────────┬─────────┬──────────┬────────────┘
      │         │          │         │          │
   ┌──┴──┐  ┌──┴───┐  ┌───┴───┐ ┌──┴────┐  ┌─┴──────┐
   │Model│  │Tools │  │Skills │ │Memory │  │Observ- │
   │Router│  │Broker│  │Engine │ │Store  │  │ability │
   └──┬──┘  └──┬───┘  └───┬───┘ └──┬────┘  └─┬──────┘
      │        │          │        │         │
┌─────┴────────┴──────────┴────────┴─────────┴──────────────┐
│              Infrastructure Layer                           │
│  PostgreSQL + pgvector • Redis • LiteLLM • BullMQ          │
└─────────────────────────────────────────────────────────────┘
```

<div dir="rtl">

### المكونات الرئيسية

- **agent-core**: محرك تنفيذ LangGraph
- **model-router**: توجيه ذكي للنماذج
- **tool-broker**: إدارة أدوات MCP
- **skills-engine**: مكتبة المهارات
- **a2a-gateway**: بوابة Agent-to-Agent
- **observability**: مراقبة وتتبع
- **security**: RBAC وأمان
- **db**: طبقة قاعدة البيانات

</div>

---

## 🎯 LangGraph Execution Flow

```mermaid
graph LR
    START([START]) --> intake[Intake]
    intake --> profile[Profile]
    profile --> template[Template Select]
    template --> design[Team Design]
    design --> route[Model Route]
    route --> tools[Tools Allocate]
    tools --> skills[Skills Load]
    skills --> gate{Approval Gate}
    gate -->|Approved| planner[Planner]
    gate -->|Rejected| END([END])
    planner --> parallel[Specialists Parallel]
    parallel --> executor[Tool Executor]
    executor --> aggregate[Aggregate]
    aggregate --> verify[Verifier]
    verify -->|Pass| final[Finalizer]
    verify -->|Revise| planner
    final --> END
```

<div dir="rtl">

**ملاحظة هامة**: الرسم البياني ثابت ولا يمكن تخطي عقد. `verifier` يجب أن تعمل دائماً قبل `finalizer`.

</div>

---

## 📦 Monorepo Structure

```
root/
├── apps/
│   ├── web/              # Next.js frontend
│   └── api/              # Fastify backend
├── packages/
│   ├── agent-core/       # LangGraph orchestration
│   ├── model-router/     # Quality-first routing
│   ├── tool-broker/      # MCP tool management
│   ├── skills-engine/    # Skills system
│   ├── a2a-gateway/      # Agent federation
│   ├── observability/    # Monitoring & tracing
│   ├── security/         # RBAC & encryption
│   ├── types/            # Shared types
│   ├── db/               # Database layer
│   └── config/           # Shared configs
├── infra/                # Infrastructure configs
├── skills/               # Agent skills (SKILL.md)
├── templates/            # Team templates (YAML)
└── docs/                 # Documentation
```

---

## 🔧 Development Commands

```bash
# Development
pnpm run dev              # Start all services
pnpm run build            # Build all packages
pnpm run typecheck        # Type checking
pnpm run lint             # Lint code
pnpm run lint --fix       # Fix linting issues

# Testing
pnpm run test             # Run all tests
pnpm run test:integration # Integration tests
pnpm run test:e2e         # E2E tests
pnpm run test:security    # Security tests

# Database
pnpm run db:migrate       # Run migrations
pnpm run db:seed          # Seed data

# Package-specific
pnpm --filter <package> run dev
pnpm --filter <package> run test -- <file.test.ts>
```

---

## 🌍 Environment Variables

<div dir="rtl">

### المتطلبات الأساسية

</div>

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/agents
REDIS_URL=redis://localhost:6379

# LiteLLM Gateway
LITELLM_API_BASE=http://localhost:4001
LITELLM_MASTER_KEY=your-master-key

# LLM Providers (via LiteLLM)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...

# Observability
LANGSMITH_API_KEY=...

# Optional Services
TAVILY_API_KEY=...
E2B_API_KEY=...
SLACK_BOT_TOKEN=...
GITHUB_TOKEN=...
```

<div dir="rtl">

راجع `.env.example` للقائمة الكاملة مع الشروحات.

</div>

---

## 🎨 Code Style & Conventions

- **TypeScript Strict Mode**: No `any`, no `@ts-ignore`
- **ES Modules Only**: `import/export`, no CommonJS
- **Naming Conventions**:
  - Files: `kebab-case.ts`, Components: `PascalCase.tsx`
  - Variables/Functions: `camelCase`
  - Types/Interfaces: `PascalCase`
  - Constants: `SCREAMING_SNAKE_CASE`
- **Error Handling**: Custom `AppError` with `error_code`, `retryable`, `trace_id`
- **Type Imports**: Use `import type` for type-only imports
- **Exports**: Named exports preferred over default

---

## 🔐 Security Features

<div dir="rtl">

- **RBAC متعدد الأدوار** مع فصل المشاريع والفرق
- **تشفير البيانات الحساسة** عبر KMS/Vault
- **تحديد معدل الطلبات** على جميع نقاط النهاية
- **فلاتر DLP** قبل استدعاء النماذج والأدوات
- **حماية من الحقن** عبر Input/Output Guardrails
- **سجلات تدقيق شاملة** لجميع العمليات الحساسة
- **بوابة الموافقة** للأدوات الحساسة

</div>

---

## 📊 Monitoring & Observability

- **LangSmith**: Native integration for agent tracing
- **OpenTelemetry**: Distributed tracing across services
- **Audit Logging**: Complete audit trail for all operations
- **Metrics**: Prometheus-compatible metrics
- **Health Checks**: Readiness and liveness probes

---

## 🧪 Testing Strategy

```bash
# Unit Tests
pnpm --filter agent-core run test

# Integration Tests
pnpm run test:integration

# E2E Tests (API)
pnpm run test:e2e

# Security Tests
pnpm run test:security

# Watch Mode
pnpm --filter <package> run test -- --watch
```

---

## 🚢 Deployment

<div dir="rtl">

### Docker (التطوير)

</div>

```bash
docker compose up -d
```

<div dir="rtl">

### Kubernetes (الإنتاج)

</div>

```bash
helm install agents ./infra/deploy/helm/agents \
  --namespace agents \
  --create-namespace
```

<div dir="rtl">

راجع [دليل النشر](docs/deployment/DOCKER.md) للتفاصيل الكاملة.

</div>

---

## 🤝 Contributing

<div dir="rtl">

نرحب بالمساهمات! يرجى قراءة [دليل المساهمة](docs/development/CONTRIBUTING.md) قبل البدء.

### خطوات المساهمة

1. Fork المشروع
2. أنشئ فرع للميزة (`git checkout -b feat/amazing-feature`)
3. Commit التغييرات (`git commit -m 'feat: add amazing feature'`)
4. Push للفرع (`git push origin feat/amazing-feature`)
5. افتح Pull Request

### معايير PR

- [ ] عنوان بصيغة Conventional Commits
- [ ] Type checking يمر (`pnpm run typecheck`)
- [ ] Lint يمر (`pnpm run lint`)
- [ ] Tests مضافة/محدثة
- [ ] لا يوجد `console.log` في Production
- [ ] لا يوجد أسرار في الكود

</div>

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🔗 روابط مهمة | Important Links

<div dir="rtl">

- [التوثيق الكامل](docs/)
- [دليل المعمارية](docs/architecture/OVERVIEW.md)
- [API Reference](docs/api/REST_API.md)
- [أمثلة عملية](docs/examples/)
- [الأسئلة الشائعة](docs/FAQ.md)
- [خارطة الطريق](docs/ROADMAP.md)
- [سجل التغييرات](docs/CHANGELOG.md)

</div>

---

## 💬 Support & Community

<div dir="rtl">

- **الإبلاغ عن مشاكل**: [GitHub Issues](https://github.com/your-org/repo/issues)
- **الأسئلة**: [GitHub Discussions](https://github.com/your-org/repo/discussions)
- **التوثيق**: [docs/](docs/)

</div>

---

## 🙏 Acknowledgments

Built with:
- [LangGraph](https://github.com/langchain-ai/langgraph) - Agent orchestration framework
- [LiteLLM](https://github.com/BerriAI/litellm) - Universal LLM gateway
- [Model Context Protocol](https://modelcontextprotocol.io/) - Tool integration standard
- [Next.js](https://nextjs.org/) - React framework
- [Fastify](https://fastify.dev/) - Web framework
- [PostgreSQL](https://www.postgresql.org/) - Database
- [Redis](https://redis.io/) - Cache & queues

---

<div align="center" dir="rtl">

**صنع بـ ❤️ من أجل مجتمع الذكاء الاصطناعي**

Built with ❤️ for the AI Community

</div>
