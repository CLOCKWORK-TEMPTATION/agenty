# E2E Tests Documentation

اختبارات E2E شاملة لـ Multi-Model Agent Teams Platform.

## نظرة عامة

تغطي هذه الاختبارات جميع سيناريوهات استخدام المنصة من البداية للنهاية:

1. **Research Team** - فريق البحث (researcher + analyst + writer)
2. **Coding Team** - فريق البرمجة (architect + developer + tester + reviewer)
3. **Content Creation Team** - فريق المحتوى (writer + editor + designer)
4. **Data Analysis Team** - فريق تحليل البيانات (analyst + visualizer + reporter)
5. **Checkpoint & Resume** - نقاط التفتيش والاستئناف
6. **Tool Approval Flow** - تدفق الموافقة على الأدوات
7. **Model Diversity** - تنوع النماذج
8. **Error Recovery** - استرجاع الأخطاء

## المتطلبات

قبل تشغيل الاختبارات، تأكد من:

1. تشغيل البنية التحتية المطلوبة:
```bash
docker compose up postgres redis litellm -d
```

2. تشغيل migrations:
```bash
pnpm run db:migrate
```

3. تهيئة المتغيرات البيئية:
```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/agents_test
REDIS_URL=redis://localhost:6379
LITELLM_API_BASE=http://localhost:4001
```

## تشغيل الاختبارات

### تشغيل جميع الاختبارات
```bash
pnpm run test:e2e
```

### تشغيل اختبار واحد
```bash
# Research Team
pnpm run test:e2e:research

# Coding Team
pnpm run test:e2e:coding

# Content Creation
pnpm run test:e2e:content

# Data Analysis
pnpm run test:e2e:data

# Checkpoint & Resume
pnpm run test:e2e:checkpoint

# Tool Approval
pnpm run test:e2e:tools

# Model Diversity
pnpm run test:e2e:models

# Error Recovery
pnpm run test:e2e:recovery
```

## بنية الملفات

```
test/e2e/
├── setup.ts                        # Helper functions مشتركة
├── research-team.e2e.test.ts       # اختبارات فريق البحث
├── coding-team.e2e.test.ts         # اختبارات فريق البرمجة
├── content-team.e2e.test.ts        # اختبارات فريق المحتوى
├── data-team.e2e.test.ts           # اختبارات فريق البيانات
├── checkpoint-resume.e2e.test.ts   # اختبارات Checkpoint
├── tool-approval.e2e.test.ts       # اختبارات موافقة الأدوات
├── model-diversity.e2e.test.ts     # اختبارات تنوع النماذج
└── error-recovery.e2e.test.ts      # اختبارات استرجاع الأخطاء
```

## Setup Utilities

ملف `setup.ts` يوفر helper functions مشتركة:

### الدوال الأساسية

- `setupE2EContext()` - تهيئة context للاختبارات
- `teardownE2EContext()` - تنظيف context بعد الاختبارات
- `createDraft()` - إنشاء draft جديد
- `approveDraft()` - الموافقة على draft
- `runTeamTask()` - تشغيل مهمة فريق
- `getRun()` - الحصول على تفاصيل run
- `resumeRun()` - استئناف run
- `approveTool()` - الموافقة على استخدام أداة
- `getRunEvents()` - الحصول على أحداث run
- `uploadArtifact()` - رفع artifact
- `listArtifacts()` - عرض artifacts

### دوال التحقق

- `verifyModelDiversity()` - التحقق من تنوع النماذج (minimum 2)
- `verifyWorkflowOrder()` - التحقق من ترتيب workflow الصحيح

## الاختبارات المغطاة

### 1. Research Team (research-team.e2e.test.ts)

- إنشاء فريق بحث كامل
- استخدام أدوات البحث (search, scraping)
- التحقق من النتائج النهائية
- نمط Auto vs Approval
- Multi-turn conversations
- تسجيل الأحداث و state transitions

### 2. Coding Team (coding-team.e2e.test.ts)

- إنشاء فريق برمجة (architect + developer + tester + reviewer)
- تطوير feature كاملة
- استخدام أدوات البرمجة (git, testing, code analysis)
- التحقق من جودة الكود
- Revision loops (max 2)
- Verifier enforcement
- Code artifacts

### 3. Content Creation Team (content-team.e2e.test.ts)

- إنشاء فريق محتوى
- محتوى متعدد الأنواع (blog, social, images)
- أدوات التصميم
- جودة المحتوى
- محتوى بلغات متعددة
- SEO optimization
- Brand consistency

### 4. Data Analysis Team (data-team.e2e.test.ts)

- فريق تحليل بيانات
- تحليل datasets حقيقية
- إنشاء visualizations
- تقارير نهائية
- Statistical analysis
- Machine learning predictions
- Data cleaning
- Dashboard creation

### 5. Checkpoint & Resume (checkpoint-resume.e2e.test.ts)

- إنشاء checkpoints تلقائياً
- استئناف من آخر checkpoint
- استمرارية الحالة
- Multiple interrupts
- Checkpoint metadata
- Recovery من failure
- State persistence عبر restart

### 6. Tool Approval Flow (tool-approval.e2e.test.ts)

- طلب استخدام أدوات حساسة
- الموافقة/الرفض على الأدوات
- Interrupt للموافقة
- استكمال بعد الموافقة
- أدوات متعددة
- Sensitive tools (DB write, git push)
- RBAC للموافقة
- Audit logging

### 7. Model Diversity (model-diversity.e2e.test.ts)

- Minimum 2 different models
- Model diversity enforcement
- استخدام نماذج مختلفة فعلياً
- Fallback chains
- Quality-first scoring
- عدم اعتماد cost
- توزيع النماذج
- Capability fit
- Tool reliability

### 8. Error Recovery (error-recovery.e2e.test.ts)

- فشل نموذج و fallback
- فشل أداة واستخدام بديل
- فشل MCP server
- Automatic recovery
- Fallback strategies
- Circuit breaker
- Exponential backoff retry
- Graceful degradation
- Timeout handling
- Checkpoint-based recovery

## التحقق من النتائج

كل اختبار يتحقق من:

1. **حالة التنفيذ** - running, completed, waiting_approval, failed
2. **تنوع النماذج** - على الأقل نموذجين مختلفين
3. **ترتيب Workflow** - verifier قبل finalizer
4. **الأحداث** - تسجيل جميع الأحداث المهمة
5. **Artifacts** - إنشاء وحفظ المخرجات
6. **Revision Count** - max 2 revision loops
7. **State Transitions** - انتقالات صحيحة للحالة
8. **Audit Logging** - تسجيل العمليات الحساسة

## التوقيت

- كل اختبار له timeout قدره 2 دقيقة (120 ثانية)
- يمكن تعديل `E2E_TIMEOUT` في setup.ts عند الحاجة

## Best Practices

1. **استخدم setup/teardown** - تنظيف البيئة بعد كل test suite
2. **معزولة** - كل اختبار مستقل ولا يعتمد على آخر
3. **واضحة** - أسماء اختبارات وصفية بالعربية
4. **شاملة** - تغطية جميع السيناريوهات المهمة
5. **قابلة للصيانة** - استخدام helper functions مشتركة

## Debugging

لعرض تفاصيل أكثر أثناء التشغيل:

```bash
# تشغيل مع تفاصيل
DEBUG=* pnpm run test:e2e:research

# تشغيل اختبار واحد محدد
pnpm run test:e2e:research -- "إنشاء وتشغيل فريق بحث"
```

## CI/CD Integration

هذه الاختبارات مصممة للعمل في:

- GitHub Actions
- GitLab CI
- Jenkins
- أي CI/CD pipeline آخر

تأكد من توفير:
- PostgreSQL database
- Redis instance
- LiteLLM gateway
- Environment variables

## Contributing

عند إضافة اختبارات جديدة:

1. استخدم نفس بنية الملفات
2. اتبع naming conventions (kebab-case.e2e.test.ts)
3. استخدم helper functions من setup.ts
4. أضف script في package.json
5. وثق الاختبار في هذا الملف
6. تأكد من typecheck يمر
7. اختبر محلياً قبل commit

## الأخطاء الشائعة

### Database Connection Failed
```
Error: connect ECONNREFUSED ::1:5432
```
**الحل:** تأكد من تشغيل PostgreSQL عبر docker compose

### Redis Connection Failed
```
Error: connect ECONNREFUSED ::1:6379
```
**الحل:** تأكد من تشغيل Redis عبر docker compose

### LiteLLM Not Reachable
```
Error: fetch failed http://localhost:4001
```
**الحل:** تأكد من تشغيل LiteLLM container

### Test Timeout
```
Error: Test timed out after 120000ms
```
**الحل:** زد الـ timeout أو تحقق من البنية التحتية

## الموارد

- [Vitest Documentation](https://vitest.dev/)
- [Fastify Testing](https://www.fastify.io/docs/latest/Guides/Testing/)
- [CLAUDE.md](../../CLAUDE.md) - Project guidelines
- [AGENTS.md](../../AGENTS.md) - Architecture details
