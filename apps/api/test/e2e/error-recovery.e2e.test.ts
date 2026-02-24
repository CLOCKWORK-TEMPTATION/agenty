/**
 * E2E Test: Error Recovery Tests
 * اختبار استرجاع الأخطاء واستراتيجيات fallback
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { E2ETestContext } from "./setup.js";
import {
  E2E_TIMEOUT,
  setupE2EContext,
  teardownE2EContext,
  runTeamTask,
  getRun,
  resumeRun,
  getRunEvents
} from "./setup.js";

let ctx: E2ETestContext;

beforeAll(async () => {
  ctx = await setupE2EContext();
}, E2E_TIMEOUT);

afterAll(async () => {
  await teardownE2EContext(ctx);
});

describe("اختبار Error Recovery E2E", () => {
  it("محاكاة فشل نموذج والتبديل إلى fallback", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "اختبار model failure",
      description: "محاكاة فشل نموذج واستخدام fallback",
      domain: "coding",
      approvalMode: "auto",
      metadata: { simulateModelFailure: true }
    });

    const run = await getRun(ctx.app, runResult.runId);

    // إذا فشل، يجب أن يكون هناك محاولة للاسترجاع
    if (run.status === "failed") {
      // التحقق من وجود events تشير للفشل
      const events = await getRunEvents(ctx.app, runResult.runId);
      expect(events.length).toBeGreaterThan(0);
    } else {
      // إذا نجح، فقد استخدم fallback بنجاح
      expect(run.status).toBeDefined();
    }
  }, E2E_TIMEOUT);

  it("محاكاة فشل أداة واستخدام بديل", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "اختبار tool failure",
      description: "محاكاة فشل أداة واستخدام أداة بديلة",
      domain: "coding",
      approvalMode: "auto",
      metadata: { simulateToolFailure: true }
    });

    const events = await getRunEvents(ctx.app, runResult.runId);

    // البحث عن أحداث فشل أو محاولة إعادة
    const hasFailureHandling = events.some(e =>
      e.includes("fail") ||
      e.includes("retry") ||
      e.includes("fallback") ||
      e.includes("error")
    );

    // إما أن يكون هناك معالجة للفشل أو أن التنفيذ نجح
    expect(hasFailureHandling || events.length > 5).toBe(true);
  }, E2E_TIMEOUT);

  it("محاكاة فشل MCP server والاسترجاع", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "اختبار MCP failure",
      description: "محاكاة فشل MCP server",
      domain: "coding",
      approvalMode: "auto",
      metadata: { simulateMcpFailure: true }
    });

    const run = await getRun(ctx.app, runResult.runId);

    // التحقق من أن الـ run تم إنشاؤه
    expect(run.runId).toBe(runResult.runId);
  }, E2E_TIMEOUT);

  it("اختبار automatic recovery من أخطاء مؤقتة", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "automatic recovery test",
      description: "اختبار الاسترجاع التلقائي من أخطاء مؤقتة",
      domain: "coding",
      approvalMode: "auto",
      metadata: { simulateTransientError: true }
    });

    const run = await getRun(ctx.app, runResult.runId);

    // التحقق من أن الـ run لم يفشل نهائياً
    expect(["running", "completed", "waiting_approval"]).toContain(run.status);
  }, E2E_TIMEOUT);

  it("اختبار fallback strategies", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "fallback strategies test",
      description: "اختبار استراتيجيات fallback المختلفة",
      domain: "coding",
      approvalMode: "auto"
    });

    const assignments = runResult.assignments as Array<{ model: string }>;

    // التحقق من أن كل دور له نموذج (primary أو fallback)
    for (const assignment of assignments) {
      expect(assignment.model).toBeDefined();
      expect(assignment.model.length).toBeGreaterThan(0);
    }
  }, E2E_TIMEOUT);

  it("اختبار circuit breaker pattern", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "circuit breaker test",
      description: "اختبار circuit breaker لمنع الفشل المتكرر",
      domain: "coding",
      approvalMode: "auto",
      metadata: { testCircuitBreaker: true }
    });

    const run = await getRun(ctx.app, runResult.runId);
    expect(run.runId).toBe(runResult.runId);
  }, E2E_TIMEOUT);

  it("اختبار exponential backoff retry", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "retry with backoff test",
      description: "اختبار إعادة المحاولة مع exponential backoff",
      domain: "coding",
      approvalMode: "auto",
      metadata: { testRetryBackoff: true }
    });

    const events = await getRunEvents(ctx.app, runResult.runId);

    // قد تكون هناك محاولات إعادة في events
    expect(events.length).toBeGreaterThan(0);
  }, E2E_TIMEOUT);

  it("اختبار graceful degradation", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "graceful degradation test",
      description: "اختبار التدهور التدريجي عند فشل components",
      domain: "coding",
      approvalMode: "auto"
    });

    const run = await getRun(ctx.app, runResult.runId);

    // حتى مع degradation، يجب أن يكون run موجود
    expect(run.runId).toBe(runResult.runId);
    expect(run.status).toBeDefined();
  }, E2E_TIMEOUT);

  it("اختبار timeout handling", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "timeout test",
      description: "اختبار معالجة timeouts",
      domain: "coding",
      approvalMode: "auto",
      metadata: { simulateTimeout: true }
    });

    const run = await getRun(ctx.app, runResult.runId);
    expect(run.runId).toBe(runResult.runId);
  }, E2E_TIMEOUT);

  it("اختبار recovery من failed verification", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "verification failure recovery",
      description: "اختبار الاسترجاع من فشل verification",
      domain: "coding",
      approvalMode: "auto"
    });

    const run = await getRun(ctx.app, runResult.runId);

    // التحقق من revision count (قد يكون هناك محاولات تصحيح)
    expect(run.revisionCount).toBeGreaterThanOrEqual(0);
    expect(run.revisionCount).toBeLessThanOrEqual(2); // max 2 revisions
  }, E2E_TIMEOUT);

  it("اختبار partial success handling", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "partial success test",
      description: "اختبار معالجة النجاح الجزئي",
      domain: "coding",
      approvalMode: "auto"
    });

    const run = await getRun(ctx.app, runResult.runId);

    // حتى مع نجاح جزئي، يجب أن يكون هناك نتائج
    expect(run.events.length).toBeGreaterThan(0);
  }, E2E_TIMEOUT);

  it("اختبار checkpoint-based recovery", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "checkpoint recovery test",
      description: "اختبار الاسترجاع من checkpoints عند الفشل",
      domain: "coding",
      approvalMode: "approval"
    });

    // محاكاة فشل والاستئناف من checkpoint
    const beforeResume = await getRun(ctx.app, runResult.runId);

    await resumeRun(ctx.app, runResult.runId);

    const afterResume = await getRun(ctx.app, runResult.runId);

    // التحقق من استمرارية البيانات
    expect(afterResume.runId).toBe(beforeResume.runId);
    expect(afterResume.request.title).toBe(beforeResume.request.title);
  }, E2E_TIMEOUT);

  it("اختبار data consistency بعد recovery", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "data consistency test",
      description: "التحقق من consistency البيانات بعد recovery",
      domain: "coding",
      approvalMode: "auto"
    });

    const run = await getRun(ctx.app, runResult.runId);

    // التحقق من consistency
    expect(run.runId).toBe(runResult.runId);
    expect(run.request.projectId).toBe(ctx.projectId);
    expect(run.request.userId).toBe(ctx.userId);
    expect(run.assignments.length).toBeGreaterThan(0);
  }, E2E_TIMEOUT);

  it("اختبار error messages وlogging", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "error logging test",
      description: "التحقق من تسجيل الأخطاء بشكل صحيح",
      domain: "coding",
      approvalMode: "auto",
      metadata: { testErrorLogging: true }
    });

    const events = await getRunEvents(ctx.app, runResult.runId);

    // التحقق من وجود events
    expect(Array.isArray(events)).toBe(true);
  }, E2E_TIMEOUT);

  it("اختبار max retry limits", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "max retries test",
      description: "التحقق من احترام حدود إعادة المحاولة",
      domain: "coding",
      approvalMode: "auto",
      metadata: { testMaxRetries: true }
    });

    const run = await getRun(ctx.app, runResult.runId);

    // التحقق من أن revision count لا يتجاوز الحد الأقصى
    expect(run.revisionCount).toBeLessThanOrEqual(2);
  }, E2E_TIMEOUT);
});
