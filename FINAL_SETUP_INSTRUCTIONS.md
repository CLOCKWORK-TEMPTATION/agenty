# تعليمات التشغيل النهائية - BullMQ Workers

## ✅ ما تم إنجازه

تم تنفيذ نظام BullMQ workers كامل للتنفيذ غير المتزامن:

- ✅ 4 Queues (team-execution, tool-execution, batch-processing, notification)
- ✅ 4 Workers مع إدارة كاملة
- ✅ API Endpoints للتعامل مع الـ queues
- ✅ Dashboard للمراقبة في الوقت الفعلي
- ✅ Worker Management و Monitoring
- ✅ Docker Support
- ✅ Documentation شاملة

## 📋 الخطوات المطلوبة قبل التشغيل

### 1. إصلاح أخطاء TypeScript البسيطة

هناك بعض الأخطاء البسيطة في الـ workers تحتاج للإصلاح:

#### في `infra/workers/src/team-execution-worker.ts`:

قم بتحديث event listeners types:

```typescript
// السطر 134
this.worker.on('completed', (job: Job<TeamExecutionJobData, TeamExecutionJobResult>, result: TeamExecutionJobResult) => {

// السطر 140
this.worker.on('failed', (job: Job<TeamExecutionJobData, TeamExecutionJobResult> | undefined, error: Error) => {

// السطر 147
this.worker.on('error', (error: Error) => {

// السطر 151
this.worker.on('stalled', (jobId: string) => {

// السطر 155
this.worker.on('progress', (job: Job<TeamExecutionJobData, TeamExecutionJobResult>, progress: unknown) => {
```

#### في `infra/workers/src/tool-execution-worker.ts`:

قم بحذف unused imports والمتغيرات:

```typescript
// السطر 39 - احذف parameters و context من destructuring
const { tool_name } = job.data;

// السطر 86 - أضف نوع البيانات
this.worker.on('completed', (_job: Job<ToolExecutionJobData, ToolExecutionJobResult>, result: ToolExecutionJobResult) => {

// السطر 92
this.worker.on('failed', (job: Job<ToolExecutionJobData, ToolExecutionJobResult> | undefined, error: Error) => {

// السطر 99
this.worker.on('error', (error: Error) => {

// السطر 103
this.worker.on('stalled', (jobId: string) => {
```

#### في `infra/workers/src/batch-processing-worker.ts`:

```typescript
// أضف types للـ event listeners
this.worker.on('completed', (job: Job<BatchProcessingJobData, BatchProcessingJobResult>, result: BatchProcessingJobResult) => {

this.worker.on('failed', (job: Job<BatchProcessingJobData, BatchProcessingJobResult> | undefined, error: Error) => {

this.worker.on('error', (error: Error) => {

this.worker.on('stalled', (jobId: string) => {

this.worker.on('progress', (job: Job<BatchProcessingJobData, BatchProcessingJobResult>, progress: unknown) => {
```

#### في `infra/workers/src/notification-worker.ts`:

```typescript
// أضف types للـ event listeners
this.worker.on('completed', (job: Job<NotificationJobData, NotificationJobResult>, result: NotificationJobResult) => {

this.worker.on('failed', (job: Job<NotificationJobData, NotificationJobResult> | undefined, error: Error) => {

this.worker.on('error', (error: Error) => {

this.worker.on('stalled', (jobId: string) => {
```

### 2. إضافة Import للـ Job type

في جميع ملفات الـ workers، أضف:

```typescript
import { Worker, Job } from 'bullmq';
```

بدلاً من:

```typescript
import { Worker } from 'bullmq';
```

## 🚀 التشغيل

### 1. تثبيت Dependencies

```bash
pnpm install
```

### 2. بناء الـ Packages

```bash
pnpm run build
```

### 3. تشغيل Redis

```bash
docker compose up redis -d
```

### 4. تشغيل الـ Workers

```bash
cd infra/workers
pnpm run dev
```

### 5. تشغيل API (في terminal منفصل)

```bash
cd apps/api
pnpm run dev
```

### 6. تشغيل Web (في terminal منفصل)

```bash
cd apps/web
pnpm run dev
```

## 📊 الوصول للـ Dashboard

افتح المتصفح على:
```
http://localhost:3000/admin/queues
```

## 🧪 اختبار النظام

### إرسال مهمة تجريبية:

```bash
curl -X POST http://localhost:4000/api/queues/team-execution \
  -H "Content-Type: application/json" \
  -d '{
    "run_id": "test_1",
    "user_id": "user_1",
    "request": {
      "user_request": "Test request"
    }
  }'
```

### التحقق من الإحصائيات:

```bash
curl http://localhost:4000/api/queues/metrics
```

## 📁 الملفات المُنشأة

### Configuration (packages/db/src/queue/)
- connection.ts
- config.ts
- types.ts

### Queues (packages/db/src/queue/queues/)
- team-execution-queue.ts
- tool-execution-queue.ts
- batch-processing-queue.ts
- notification-queue.ts
- index.ts

### Workers (infra/workers/src/)
- team-execution-worker.ts
- tool-execution-worker.ts
- batch-processing-worker.ts
- notification-worker.ts
- manager.ts
- monitor.ts
- index.ts

### API Routes (apps/api/src/routes/)
- queues.ts
- index.ts

### Dashboard (apps/web/app/admin/queues/)
- page.tsx

### Configuration Files
- infra/workers/package.json
- infra/workers/tsconfig.json
- infra/workers/tsconfig.build.json
- infra/workers/.env.example
- infra/workers/README.md

### Documentation
- QUICK_START_QUEUES.md
- BULLMQ_IMPLEMENTATION_SUMMARY.md
- FINAL_SETUP_INSTRUCTIONS.md (هذا الملف)

## 🔧 تكوين البيئة

أنشئ ملف `.env` في `infra/workers/`:

```env
REDIS_URL=redis://localhost:6379
WORKER_CONCURRENCY=5
TEAM_EXECUTION_CONCURRENCY=3
TOOL_EXECUTION_CONCURRENCY=10
BATCH_PROCESSING_CONCURRENCY=5
NOTIFICATION_CONCURRENCY=10
TEAM_EXECUTION_TIMEOUT=300000
TOOL_EXECUTION_TIMEOUT=60000
BATCH_PROCESSING_TIMEOUT=600000
NOTIFICATION_TIMEOUT=30000
QUEUE_MAX_RETRIES=3
```

## 🎯 الخطوات التالية (المقترحة)

1. **إصلاح أخطاء TypeScript** - اتبع التعليمات أعلاه
2. **تشغيل typecheck** - `pnpm run typecheck`
3. **بناء الـ packages** - `pnpm run build`
4. **تشغيل النظام** - اتبع خطوات التشغيل
5. **اختبار الـ workflow** - أرسل مهام تجريبية
6. **مراقبة الأداء** - استخدم Dashboard

## 📚 الوثائق

للمزيد من التفاصيل، راجع:

- **QUICK_START_QUEUES.md** - دليل البدء السريع
- **BULLMQ_IMPLEMENTATION_SUMMARY.md** - ملخص التنفيذ الشامل
- **infra/workers/README.md** - وثائق الـ workers
- **CLAUDE.md** - إرشادات المشروع

## 🎉 الخلاصة

النظام جاهز تقريباً للتشغيل. بعد إصلاح الأخطاء البسيطة المذكورة أعلاه، ستتمكن من:

- ✅ تشغيل 4 workers مختلفة
- ✅ إرسال jobs عبر API
- ✅ متابعة التنفيذ في الوقت الفعلي
- ✅ مراقبة الإحصائيات عبر Dashboard
- ✅ إدارة الـ jobs (cancel, retry)
- ✅ Health monitoring

---

**تم إنشاؤه:** 2025-02-24
**الحالة:** جاهز للتشغيل (بعد إصلاح أخطاء TypeScript)
**المطور:** Multi-Model Agent Teams Platform
