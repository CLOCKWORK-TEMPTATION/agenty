# REST API Reference | مرجع REST API

<div dir="rtl">

## نظرة عامة

API Server يوفر 22+ نقطة نهاية RESTful لإدارة دورة حياة الفرق والتشغيل الكاملة.

**Base URL**: `http://localhost:4000/api/v1`

**Authentication**: Bearer token في header

</div>

```http
Authorization: Bearer <your_jwt_token>
```

---

## Table of Contents

1. [Authentication](#authentication)
2. [Teams](#teams)
3. [Runs](#runs)
4. [Models](#models)
5. [Templates](#templates)
6. [Skills](#skills)
7. [MCP Servers](#mcp-servers)
8. [Tools](#tools)
9. [A2A (Agent-to-Agent)](#a2a-agent-to-agent)
10. [Metrics](#metrics)
11. [Error Handling](#error-handling)

---

## Authentication

### POST /auth/login

<div dir="rtl">تسجيل الدخول والحصول على JWT token</div>

**Request**:
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your_password"
}
```

**Response** (200 OK):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "developer"
  },
  "expires_at": "2024-03-01T12:00:00Z"
}
```

---

### POST /auth/register

<div dir="rtl">تسجيل مستخدم جديد</div>

**Request**:
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "secure_password",
  "name": "Jane Doe"
}
```

**Response** (201 Created):
```json
{
  "user_id": "user_456",
  "message": "User created successfully"
}
```

---

## Teams

### POST /team/draft

<div dir="rtl">إنشاء مسودة فريق جديد</div>

**Request**:
```http
POST /api/v1/team/draft
Authorization: Bearer <token>
Content-Type: application/json

{
  "task": "Research and write a comprehensive blog post about LangGraph architecture",
  "requirements": {
    "length": "2000-3000 words",
    "tone": "technical but accessible",
    "include_code_examples": true,
    "include_diagrams": true
  },
  "constraints": {
    "deadline": "2024-03-01T23:59:59Z"
  },
  "preferences": {
    "template_category": "research",
    "require_approval": true
  }
}
```

**Response** (200 OK):
```json
{
  "draft_id": "draft_789",
  "status": "draft",
  "task_profile": {
    "task_type": "research",
    "complexity_score": 65,
    "estimated_duration": 300,
    "required_capabilities": [
      "research",
      "writing",
      "technical_explanation",
      "diagram_creation"
    ]
  },
  "team_composition": [
    {
      "role_id": "lead_researcher",
      "role_name": "Lead Researcher",
      "assigned_model": {
        "model_id": "gpt-4o",
        "provider": "openai",
        "version": "2024-05-13"
      },
      "responsibilities": [
        "Research LangGraph architecture",
        "Identify key concepts",
        "Gather code examples"
      ]
    },
    {
      "role_id": "technical_writer",
      "role_name": "Technical Writer",
      "assigned_model": {
        "model_id": "claude-opus-4",
        "provider": "anthropic",
        "version": "4-6-20240229"
      },
      "responsibilities": [
        "Write comprehensive content",
        "Explain technical concepts clearly",
        "Structure the blog post"
      ]
    },
    {
      "role_id": "code_reviewer",
      "role_name": "Code Reviewer",
      "assigned_model": {
        "model_id": "gpt-4o",
        "provider": "openai",
        "version": "2024-05-13"
      },
      "responsibilities": [
        "Review code examples",
        "Ensure best practices",
        "Add comments"
      ]
    }
  ],
  "tools_allocated": [
    "tavily_search",
    "web_scraper",
    "github_search",
    "mermaid_diagram"
  ],
  "skills_activated": [
    "research_methodology",
    "technical_writing",
    "code_review"
  ],
  "created_at": "2024-02-24T10:30:00Z"
}
```

---

### POST /team/approve

<div dir="rtl">الموافقة على مسودة فريق</div>

**Request**:
```http
POST /api/v1/team/approve
Authorization: Bearer <token>
Content-Type: application/json

{
  "draft_id": "draft_789",
  "approved": true,
  "notes": "Looks good, proceed with execution"
}
```

**Response** (200 OK):
```json
{
  "draft_id": "draft_789",
  "status": "approved",
  "approved_at": "2024-02-24T10:35:00Z",
  "approved_by": "user_123"
}
```

---

### POST /team/run

<div dir="rtl">تشغيل فريق (تنفيذ المهمة)</div>

**Request**:
```http
POST /api/v1/team/run
Authorization: Bearer <token>
Content-Type: application/json

{
  "draft_id": "draft_789"
}
```

**Response** (202 Accepted):
```json
{
  "run_id": "run_abc123",
  "status": "running",
  "started_at": "2024-02-24T10:40:00Z",
  "estimated_completion": "2024-02-24T10:45:00Z",
  "stream_url": "http://localhost:4000/api/v1/runs/run_abc123/events"
}
```

---

## Runs

### GET /runs/:run_id

<div dir="rtl">الحصول على تفاصيل تشغيل</div>

**Request**:
```http
GET /api/v1/runs/run_abc123
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "run_id": "run_abc123",
  "draft_id": "draft_789",
  "status": "running",
  "current_node": "specialists_parallel",
  "progress": {
    "completed_nodes": 9,
    "total_nodes": 13,
    "percentage": 69
  },
  "started_at": "2024-02-24T10:40:00Z",
  "updated_at": "2024-02-24T10:42:30Z",
  "team_composition": [ /* ... */ ],
  "execution_trace": [
    {
      "node": "intake",
      "status": "completed",
      "duration_ms": 1200,
      "timestamp": "2024-02-24T10:40:01Z"
    },
    {
      "node": "profile",
      "status": "completed",
      "duration_ms": 2500,
      "timestamp": "2024-02-24T10:40:04Z"
    }
    // ...
  ],
  "current_step": {
    "node": "specialists_parallel",
    "specialists_active": 3,
    "specialists_completed": 1
  }
}
```

---

### GET /runs/:run_id/events

<div dir="rtl">Stream أحداث التشغيل (Server-Sent Events)</div>

**Request**:
```http
GET /api/v1/runs/run_abc123/events
Authorization: Bearer <token>
Accept: text/event-stream
```

**Response** (SSE Stream):
```
event: node_started
data: {"node":"planner","timestamp":"2024-02-24T10:40:05Z"}

event: node_completed
data: {"node":"planner","duration_ms":3200,"timestamp":"2024-02-24T10:40:08Z"}

event: specialist_started
data: {"role":"lead_researcher","model":"gpt-4o","timestamp":"2024-02-24T10:40:09Z"}

event: tool_call
data: {"tool":"tavily_search","args":{"query":"LangGraph architecture"},"timestamp":"2024-02-24T10:40:10Z"}

event: tool_result
data: {"tool":"tavily_search","result_summary":"Found 15 results","timestamp":"2024-02-24T10:40:12Z"}

event: specialist_completed
data: {"role":"lead_researcher","output_length":1500,"tokens":450,"timestamp":"2024-02-24T10:40:25Z"}

event: run_completed
data: {"run_id":"run_abc123","status":"completed","timestamp":"2024-02-24T10:45:00Z"}
```

---

### POST /runs/:run_id/resume

<div dir="rtl">استئناف تشغيل متوقف</div>

**Request**:
```http
POST /api/v1/runs/run_abc123/resume
Authorization: Bearer <token>
Content-Type: application/json

{
  "approval_status": "approved",
  "human_feedback": "Looks good so far, continue"
}
```

**Response** (200 OK):
```json
{
  "run_id": "run_abc123",
  "status": "running",
  "resumed_at": "2024-02-24T10:50:00Z",
  "resumed_from_node": "planner"
}
```

---

### POST /runs/:run_id/cancel

<div dir="rtl">إلغاء تشغيل</div>

**Request**:
```http
POST /api/v1/runs/run_abc123/cancel
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "User requested cancellation"
}
```

**Response** (200 OK):
```json
{
  "run_id": "run_abc123",
  "status": "cancelled",
  "cancelled_at": "2024-02-24T10:52:00Z",
  "partial_result": {
    "completed_nodes": 7,
    "partial_output": "..."
  }
}
```

---

### POST /runs/:run_id/tool-approve

<div dir="rtl">الموافقة على تنفيذ أداة حساسة</div>

**Request**:
```http
POST /api/v1/runs/run_abc123/tool-approve
Authorization: Bearer <token>
Content-Type: application/json

{
  "tool_call_id": "tool_call_xyz",
  "approved": true,
  "notes": "Safe to execute"
}
```

**Response** (200 OK):
```json
{
  "tool_call_id": "tool_call_xyz",
  "status": "approved",
  "approved_at": "2024-02-24T10:53:00Z"
}
```

---

## Models

### GET /models/catalog

<div dir="rtl">الحصول على كتالوج النماذج المتاحة</div>

**Request**:
```http
GET /api/v1/models/catalog
Authorization: Bearer <token>
```

**Query Parameters**:
- `provider` (optional): Filter by provider (openai, anthropic, google, etc.)
- `capability` (optional): Filter by capability (coding, reasoning, creative, etc.)

**Response** (200 OK):
```json
{
  "models": [
    {
      "model_id": "gpt-4o",
      "provider": "openai",
      "version": "2024-05-13",
      "capabilities": {
        "reasoning": 95,
        "coding": 92,
        "creative": 88,
        "knowledge": 90,
        "multimodal": true
      },
      "context_window": 128000,
      "output_tokens": 4096,
      "supports_function_calling": true,
      "supports_streaming": true,
      "tool_calling_success_rate": 0.94,
      "average_latency_ms": 2500,
      "quality_score": 93
    },
    {
      "model_id": "claude-opus-4",
      "provider": "anthropic",
      "version": "4-6-20240229",
      "capabilities": {
        "reasoning": 98,
        "coding": 95,
        "creative": 94,
        "knowledge": 92,
        "multimodal": true
      },
      "context_window": 200000,
      "output_tokens": 4096,
      "supports_function_calling": true,
      "supports_streaming": true,
      "tool_calling_success_rate": 0.96,
      "average_latency_ms": 3200,
      "quality_score": 96
    }
    // ...
  ],
  "total": 25,
  "filters_applied": {}
}
```

---

## Templates

### GET /templates

<div dir="rtl">قائمة القوالب المتاحة</div>

**Request**:
```http
GET /api/v1/templates?category=research&published=true
Authorization: Bearer <token>
```

**Query Parameters**:
- `category` (optional): research, coding, content, data, mixed
- `published` (optional): true/false
- `created_by` (optional): user_id

**Response** (200 OK):
```json
{
  "templates": [
    {
      "template_id": "research-team-v1",
      "name": "Research & Analysis Team",
      "description": "Comprehensive research team for in-depth analysis",
      "category": "research",
      "version": "1.0.0",
      "published": true,
      "roles_count": 4,
      "estimated_duration": 300,
      "created_by": "system",
      "created_at": "2024-01-01T00:00:00Z",
      "usage_count": 156
    }
    // ...
  ],
  "total": 12,
  "page": 1,
  "per_page": 20
}
```

---

### GET /templates/:template_id

<div dir="rtl">تفاصيل قالب محدد</div>

**Request**:
```http
GET /api/v1/templates/research-team-v1
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "template_id": "research-team-v1",
  "name": "Research & Analysis Team",
  "description": "Comprehensive research team for in-depth analysis",
  "category": "research",
  "version": "1.0.0",
  "roles": [
    {
      "role_id": "lead_researcher",
      "name": "Lead Researcher",
      "capabilities": ["research", "synthesis", "critical_thinking"],
      "model_requirements": {
        "reasoning": "high",
        "knowledge": "high"
      },
      "responsibilities": [
        "Conduct comprehensive research",
        "Synthesize findings",
        "Identify gaps"
      ]
    },
    {
      "role_id": "fact_checker",
      "name": "Fact Checker",
      "capabilities": ["verification", "source_evaluation"],
      "model_requirements": {
        "reasoning": "high"
      },
      "responsibilities": [
        "Verify facts",
        "Evaluate sources",
        "Check citations"
      ]
    }
    // ...
  ],
  "tools": [
    "tavily_search",
    "web_scraper",
    "citation_manager"
  ],
  "skills": [
    "research_methodology",
    "source_evaluation",
    "synthesis"
  ],
  "metadata": {
    "created_by": "system",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-02-01T00:00:00Z",
    "usage_count": 156
  }
}
```

---

### POST /templates

<div dir="rtl">إنشاء قالب جديد</div>

**Request**:
```http
POST /api/v1/templates
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My Custom Research Team",
  "description": "Specialized team for technical research",
  "category": "research",
  "roles": [
    {
      "role_id": "technical_researcher",
      "name": "Technical Researcher",
      "capabilities": ["research", "technical_analysis"],
      "model_requirements": {
        "coding": "high",
        "reasoning": "high"
      },
      "responsibilities": [
        "Research technical topics",
        "Analyze code examples"
      ]
    }
  ],
  "tools": ["tavily_search", "github_search"],
  "skills": ["research_methodology", "code_review"]
}
```

**Response** (201 Created):
```json
{
  "template_id": "tmpl_custom_123",
  "message": "Template created successfully",
  "created_at": "2024-02-24T11:00:00Z"
}
```

---

## Skills

### GET /skills

<div dir="rtl">قائمة المهارات المتاحة</div>

**Request**:
```http
GET /api/v1/skills?category=coding&tags=testing
Authorization: Bearer <token>
```

**Query Parameters**:
- `category` (optional): core, shared, coding, research, content, data
- `tags` (optional): Comma-separated tags

**Response** (200 OK):
```json
{
  "skills": [
    {
      "skill_id": "testing-skill",
      "name": "Testing & Quality Assurance",
      "category": "coding",
      "tags": ["testing", "qa", "tdd"],
      "version": "1.0.0",
      "description": "Comprehensive testing methodology and best practices",
      "requires_tools": ["test_runner", "coverage_analyzer"],
      "size_bytes": 8192,
      "created_at": "2024-01-01T00:00:00Z"
    }
    // ...
  ],
  "total": 21,
  "categories": {
    "core": 3,
    "shared": 4,
    "coding": 5,
    "research": 3,
    "content": 3,
    "data": 3
  }
}
```

---

### GET /skills/:skill_id

<div dir="rtl">تفاصيل مهارة محددة (Full SKILL.md)</div>

**Request**:
```http
GET /api/v1/skills/testing-skill
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "skill_id": "testing-skill",
  "name": "Testing & Quality Assurance",
  "category": "coding",
  "version": "1.0.0",
  "content": "# Testing & Quality Assurance\n\n## Purpose\n...",
  "metadata": {
    "tags": ["testing", "qa", "tdd"],
    "requires_tools": ["test_runner", "coverage_analyzer"],
    "dependencies": [],
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-02-01T00:00:00Z"
  }
}
```

---

### POST /skills/install

<div dir="rtl">تثبيت مهارة مخصصة</div>

**Request**:
```http
POST /api/v1/skills/install
Authorization: Bearer <token>
Content-Type: application/json

{
  "skill_id": "my-custom-skill",
  "name": "My Custom Skill",
  "category": "shared",
  "tags": ["custom"],
  "content": "# My Custom Skill\n\n## Purpose\n...",
  "requires_tools": []
}
```

**Response** (201 Created):
```json
{
  "skill_id": "my-custom-skill",
  "message": "Skill installed successfully",
  "installed_at": "2024-02-24T11:05:00Z"
}
```

---

### POST /skills/reload

<div dir="rtl">إعادة تحميل جميع المهارات من الملفات</div>

**Request**:
```http
POST /api/v1/skills/reload
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "message": "Skills reloaded successfully",
  "loaded": 21,
  "errors": [],
  "reloaded_at": "2024-02-24T11:10:00Z"
}
```

---

## MCP Servers

### GET /mcp/catalog

<div dir="rtl">كتالوج الأدوات المتاحة من MCP servers</div>

**Request**:
```http
GET /api/v1/mcp/catalog
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "servers": [
    {
      "server_id": "github-server",
      "name": "GitHub MCP Server",
      "status": "running",
      "tools_count": 12
    },
    {
      "server_id": "postgres-server",
      "name": "PostgreSQL MCP Server",
      "status": "running",
      "tools_count": 8
    }
  ],
  "tools": [
    {
      "tool_id": "github_search_repos",
      "server_id": "github-server",
      "name": "Search GitHub Repositories",
      "description": "Search for repositories on GitHub",
      "parameters": {
        "query": {
          "type": "string",
          "description": "Search query"
        },
        "sort": {
          "type": "string",
          "enum": ["stars", "forks", "updated"],
          "default": "stars"
        }
      },
      "sensitive": false
    }
    // ...
  ],
  "total_tools": 45
}
```

---

### GET /mcp/servers

<div dir="rtl">قائمة MCP servers المسجلة</div>

**Request**:
```http
GET /api/v1/mcp/servers
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "servers": [
    {
      "server_id": "github-server",
      "name": "GitHub MCP Server",
      "command": "node",
      "args": ["./node_modules/@modelcontextprotocol/server-github/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "***"
      },
      "status": "running",
      "pid": 12345,
      "started_at": "2024-02-24T10:00:00Z",
      "tools_count": 12
    }
    // ...
  ],
  "total": 4
}
```

---

### POST /mcp/servers

<div dir="rtl">تسجيل MCP server جديد</div>

**Request**:
```http
POST /api/v1/mcp/servers
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My Custom MCP Server",
  "command": "node",
  "args": ["./my-mcp-server.js"],
  "env": {
    "API_KEY": "your_api_key"
  }
}
```

**Response** (201 Created):
```json
{
  "server_id": "custom-server-123",
  "message": "MCP server registered successfully",
  "status": "starting",
  "registered_at": "2024-02-24T11:15:00Z"
}
```

---

### POST /mcp/servers/:server_id/test

<div dir="rtl">اختبار MCP server</div>

**Request**:
```http
POST /api/v1/mcp/servers/github-server/test
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "server_id": "github-server",
  "status": "healthy",
  "tools_discovered": 12,
  "test_timestamp": "2024-02-24T11:20:00Z"
}
```

---

## A2A (Agent-to-Agent)

### GET /a2a/agents

<div dir="rtl">الحصول على Agent Card (self-description)</div>

**Request**:
```http
GET /api/v1/a2a/agents
```

**Response** (200 OK):
```json
{
  "agent_id": "multi-model-agent-platform",
  "name": "Multi-Model Agent Teams Platform",
  "description": "Production-ready multi-agent orchestration platform",
  "version": "1.0.0",
  "capabilities": [
    "research",
    "coding",
    "content_creation",
    "data_analysis",
    "mixed_tasks"
  ],
  "tools": [
    "tavily_search",
    "github",
    "postgres",
    "filesystem",
    "playwright"
  ],
  "endpoints": {
    "task": "http://localhost:4000/api/v1/a2a/tasks",
    "status": "http://localhost:4000/api/v1/a2a/tasks/:id",
    "cancel": "http://localhost:4000/api/v1/a2a/tasks/:id/cancel"
  },
  "authentication": {
    "type": "bearer",
    "description": "JWT token required"
  }
}
```

---

### POST /a2a/tasks

<div dir="rtl">إنشاء مهمة عبر A2A protocol</div>

**Request**:
```http
POST /api/v1/a2a/tasks
Authorization: Bearer <token>
Content-Type: application/json

{
  "from_agent": "external-agent-123",
  "task": {
    "description": "Research the latest developments in LangGraph",
    "requirements": {
      "depth": "comprehensive",
      "sources": 10
    }
  },
  "context": {
    "previous_findings": "..."
  },
  "timeout_ms": 300000
}
```

**Response** (202 Accepted):
```json
{
  "task_id": "a2a_task_xyz",
  "status": "accepted",
  "estimated_completion": "2024-02-24T11:30:00Z",
  "status_url": "http://localhost:4000/api/v1/a2a/tasks/a2a_task_xyz"
}
```

---

## Metrics

### GET /metrics

<div dir="rtl">الحصول على مقاييس النظام</div>

**Request**:
```http
GET /api/v1/metrics
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "period": "last_24h",
  "runs": {
    "total": 156,
    "completed": 142,
    "failed": 8,
    "cancelled": 6,
    "success_rate": 91.0
  },
  "performance": {
    "average_duration_ms": 285000,
    "p50_duration_ms": 240000,
    "p95_duration_ms": 420000,
    "p99_duration_ms": 600000
  },
  "models": {
    "total_calls": 1240,
    "by_provider": {
      "openai": 680,
      "anthropic": 420,
      "google": 140
    },
    "total_tokens": 2850000,
    "average_latency_ms": 2800
  },
  "tools": {
    "total_calls": 890,
    "success_rate": 96.5,
    "most_used": [
      {"tool": "tavily_search", "count": 245},
      {"tool": "github_search", "count": 178},
      {"tool": "web_scraper", "count": 134}
    ]
  },
  "cache": {
    "semantic_cache_hit_rate": 42.3,
    "prompt_cache_hit_rate": 68.7,
    "total_hits": 456,
    "total_misses": 623
  }
}
```

---

## Error Handling

<div dir="rtl">

### رموز حالة HTTP

| الرمز | الحالة | الوصف |
|------|---------|--------|
| 200 | OK | طلب ناجح |
| 201 | Created | مورد جديد تم إنشاؤه |
| 202 | Accepted | طلب مقبول للمعالجة |
| 400 | Bad Request | بيانات طلب غير صالحة |
| 401 | Unauthorized | مصادقة مفقودة أو غير صالحة |
| 403 | Forbidden | ليس لديك صلاحية |
| 404 | Not Found | المورد غير موجود |
| 409 | Conflict | تعارض (مثل: draft تم الموافقة عليه سابقاً) |
| 422 | Unprocessable Entity | تحقق من البيانات فشل |
| 429 | Too Many Requests | تجاوز حد المعدل |
| 500 | Internal Server Error | خطأ في الخادم |
| 503 | Service Unavailable | الخدمة غير متاحة مؤقتاً |

### صيغة الخطأ

</div>

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "task",
      "issue": "Task description is required"
    },
    "trace_id": "trace_abc123",
    "retryable": false,
    "timestamp": "2024-02-24T11:40:00Z"
  }
}
```

<div dir="rtl">

### أكواد الأخطاء الشائعة

</div>

| الكود | الوصف | قابل لإعادة المحاولة |
|------|--------|---------------------|
| `VALIDATION_ERROR` | بيانات غير صالحة | ❌ |
| `AUTHENTICATION_ERROR` | مصادقة فاشلة | ❌ |
| `AUTHORIZATION_ERROR` | ليس لديك صلاحية | ❌ |
| `RESOURCE_NOT_FOUND` | المورد غير موجود | ❌ |
| `RATE_LIMIT_ERROR` | تجاوز حد المعدل | ✅ |
| `MODEL_ERROR` | خطأ في النموذج | ✅ |
| `TOOL_ERROR` | خطأ في تنفيذ الأداة | ✅ |
| `TIMEOUT_ERROR` | انتهت المهلة | ✅ |
| `INTERNAL_ERROR` | خطأ داخلي | ✅ |

---

## Rate Limiting

<div dir="rtl">

### الحدود

- **مصادق**: 1000 طلب/ساعة
- **غير مصادق**: 100 طلب/ساعة

### Headers

</div>

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 847
X-RateLimit-Reset: 1709035200
```

<div dir="rtl">

عند تجاوز الحد:

</div>

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 3600

{
  "error": {
    "code": "RATE_LIMIT_ERROR",
    "message": "Too many requests. Please retry after 1 hour.",
    "retryable": true,
    "retry_after_seconds": 3600
  }
}
```

---

## Pagination

<div dir="rtl">

للنقاط التي ترجع قوائم:

</div>

**Query Parameters**:
```
?page=1&per_page=20
```

**Response**:
```json
{
  "data": [ /* items */ ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 156,
    "total_pages": 8,
    "has_next": true,
    "has_prev": false
  }
}
```

---

## Webhooks (Coming Soon)

<div dir="rtl">

سيتم إضافة Webhooks قريباً لإشعارات الأحداث:
- `run.completed`
- `run.failed`
- `tool.approval_required`
- `team.approved`

</div>

---

## Examples

### Complete Flow Example

```bash
# 1. Login
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"pass"}'
# Returns: {"token":"..."}

# 2. Create draft
curl -X POST http://localhost:4000/api/v1/team/draft \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Research LangGraph",
    "preferences": {"template_category": "research"}
  }'
# Returns: {"draft_id":"draft_789"}

# 3. Approve draft
curl -X POST http://localhost:4000/api/v1/team/approve \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"draft_id":"draft_789","approved":true}'

# 4. Run
curl -X POST http://localhost:4000/api/v1/team/run \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"draft_id":"draft_789"}'
# Returns: {"run_id":"run_abc123"}

# 5. Stream events
curl -N http://localhost:4000/api/v1/runs/run_abc123/events \
  -H "Authorization: Bearer <token>" \
  -H "Accept: text/event-stream"

# 6. Get result
curl http://localhost:4000/api/v1/runs/run_abc123 \
  -H "Authorization: Bearer <token>"
```

---

## API Client Libraries

<div dir="rtl">

### TypeScript/JavaScript

</div>

```typescript
import { AgentTeamsClient } from '@repo/client';

const client = new AgentTeamsClient({
  baseUrl: 'http://localhost:4000',
  apiKey: 'your_token'
});

// Create and run team
const draft = await client.teams.createDraft({
  task: 'Research LangGraph',
  preferences: { template_category: 'research' }
});

await client.teams.approve(draft.draft_id);

const run = await client.teams.run(draft.draft_id);

// Stream events
client.runs.streamEvents(run.run_id, (event) => {
  console.log(event.type, event.data);
});
```

<div dir="rtl">

### Python (Coming Soon)

</div>

```python
from agent_teams import Client

client = Client(
    base_url="http://localhost:4000",
    api_key="your_token"
)

# Create and run
draft = client.teams.create_draft(
    task="Research LangGraph",
    preferences={"template_category": "research"}
)

client.teams.approve(draft.draft_id)
run = client.teams.run(draft.draft_id)

# Stream events
for event in client.runs.stream_events(run.run_id):
    print(event.type, event.data)
```

---

<div dir="rtl">

## المزيد

راجع أيضاً:
- [WebSocket API](WEBSOCKET.md)
- [SSE Events](SSE.md)
- [Authentication](AUTHENTICATION.md)
- [Error Codes](ERROR_CODES.md)

</div>

---

<div align="center" dir="rtl">

**API Documentation - v1.0.0**

آخر تحديث: 2024-02-24

</div>
