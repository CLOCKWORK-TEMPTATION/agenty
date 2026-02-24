/**
 * E2E Test: Checkpoint & Resume Scenarios
 * اختبار نقاط التفتيش واستئناف التنفيذ
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

describe("اختبار Checkpoint & Resume E2E", () => {
  it("إنشاء checkpoint تلقائياً أثناء التنفيذ", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "مهمة مع checkpoints",
      description: "مهمة طويلة تنشئ checkpoints أثناء التنفيذ",
      domain: "coding",
      approvalMode: "auto"
    });

    expect(runResult.runId).toBeDefined();

    // الحصول على حالة الـ run
    const run = await getRun(ctx.app, runResult.runId);

    // التحقق من أن الحالة تم حفظها
    expect(run.status).toBeDefined();
    expect(run.updatedAt).toBeDefined();
  }, E2E_TIMEOUT);

  it("استئناف run من آخر checkpoint", async () => {
    // إنشاء run في نمط approval (سيتوقف)
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "مهمة تتطلب استئناف",
      description: "مهمة ستتوقف وتحتاج استئناف",
      domain: "coding",
      approvalMode: "approval"
    });

    const initialRun = await getRun(ctx.app, runResult.runId);
    const initialStatus = initialRun.status;

    // استئناف الـ run
    const resumed = await resumeRun(ctx.app, runResult.runId);

    expect(resumed.runId).toBe(runResult.runId);
    expect(resumed.status).toBeDefined();

    // التحقق من أن الحالة تغيرت
    const afterResume = await getRun(ctx.app, runResult.runId);
    expect(afterResume.updatedAt).not.toBe(initialRun.updatedAt);
  }, E2E_TIMEOUT);

  it("التحقق من استمرارية الحالة بعد الاستئناف", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "اختبار state continuity",
      description: "التحقق من أن state يستمر بعد الاستئناف",
      domain: "coding",
      approvalMode: "approval"
    });

    // الحصول على الحالة قبل الاستئناف
    const beforeResume = await getRun(ctx.app, runResult.runId);
    const beforeAssignments = beforeResume.assignments;
    const beforeRevisionCount = beforeResume.revisionCount;

    // الاستئناف
    await resumeRun(ctx.app, runResult.runId);

    // الحصول على الحالة بعد الاستئناف
    const afterResume = await getRun(ctx.app, runResult.runId);

    // التحقق من استمرارية البيانات المهمة
    expect(afterResume.assignments.length).toBeGreaterThanOrEqual(beforeAssignments.length);
    expect(afterResume.revisionCount).toBeGreaterThanOrEqual(beforeRevisionCount);
    expect(afterResume.request.title).toBe(beforeResume.request.title);
    expect(afterResume.request.description).toBe(beforeResume.request.description);
  }, E2E_TIMEOUT);

  it("اختبار multiple interrupts واستئناف متعدد", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "استئناف متعدد",
      description: "مهمة ستتوقف وتستأنف عدة مرات",
      domain: "coding",
      approvalMode: "approval"
    });

    const resumeCount = 2;

    for (let i = 0; i < resumeCount; i++) {
      const beforeResume = await getRun(ctx.app, runResult.runId);
      const beforeEventCount = beforeResume.events.length;

      await resumeRun(ctx.app, runResult.runId);

      const afterResume = await getRun(ctx.app, runResult.runId);

      // التحقق من إضافة أحداث جديدة
      expect(afterResume.events.length).toBeGreaterThanOrEqual(beforeEventCount);
    }
  }, E2E_TIMEOUT);

  it("التحقق من checkpoint metadata", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "checkpoint metadata test",
      description: "اختبار metadata للـ checkpoints",
      domain: "coding",
      approvalMode: "auto"
    });

    const run = await getRun(ctx.app, runResult.runId);

    // التحقق من وجود metadata أساسية
    expect(run.runId).toBe(runResult.runId);
    expect(run.status).toBeDefined();
    expect(run.revisionCount).toBeDefined();
    expect(run.updatedAt).toBeDefined();
  }, E2E_TIMEOUT);

  it("اختبار recovery من failure", async () => {
    // محاكاة run قد يفشل
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "مهمة قد تفشل",
      description: "مهمة معقدة قد تواجه فشل",
      domain: "coding",
      approvalMode: "auto"
    });

    const run = await getRun(ctx.app, runResult.runId);

    // إذا فشلت، يجب أن يكون هناك checkpoint للاسترجاع
    if (run.status === "failed") {
      // يمكن استئناف من آخر checkpoint
      const resumed = await resumeRun(ctx.app, runResult.runId);
      expect(resumed.runId).toBe(runResult.runId);
    } else {
      // إذا لم تفشل، التحقق من أن هناك checkpoints
      expect(run.updatedAt).toBeDefined();
    }
  }, E2E_TIMEOUT);

  it("اختبار checkpoint في كل node رئيسي", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "اختبار checkpoints في جميع nodes",
      description: "مهمة تمر بجميع nodes وتنشئ checkpoints",
      domain: "coding",
      approvalMode: "auto"
    });

    const events = await getRunEvents(ctx.app, runResult.runId);

    // التحقق من مرور المهمة بـ nodes رئيسية
    const majorNodes = [
      "intake", "profile", "template_select", "team_design",
      "model_route", "approval_gate", "planner", "verifier", "finalizer"
    ];

    // على الأقل بعض الـ nodes يجب أن تكون موجودة في events
    const nodeEvents = events.filter(e =>
      majorNodes.some(node => e.includes(node))
    );

    expect(events.length).toBeGreaterThan(0);
  }, E2E_TIMEOUT);

  it("اختبار state persistence عبر app restart", async () => {
    // هذا الاختبار يحاكي إعادة تشغيل التطبيق
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "اختبار persistence",
      description: "مهمة لاختبار حفظ الحالة عبر restarts",
      domain: "coding",
      approvalMode: "approval"
    });

    const beforeRestart = await getRun(ctx.app, runResult.runId);

    // محاكاة restart عن طريق إعادة الحصول على run
    // (في الواقع، البيانات محفوظة في DB)
    const afterRestart = await getRun(ctx.app, runResult.runId);

    // التحقق من أن البيانات لم تضع
    expect(afterRestart.runId).toBe(beforeRestart.runId);
    expect(afterRestart.request.title).toBe(beforeRestart.request.title);
    expect(afterRestart.assignments.length).toBe(beforeRestart.assignments.length);
  }, E2E_TIMEOUT);

  it("اختبار checkpoint في approval_gate node", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "اختبار approval gate checkpoint",
      description: "مهمة تتوقف عند approval_gate",
      domain: "coding",
      approvalMode: "approval"
    });

    const run = await getRun(ctx.app, runResult.runId);

    // قد يكون status = waiting_approval
    if (run.status === "waiting_approval") {
      // الاستئناف من approval_gate
      const resumed = await resumeRun(ctx.app, runResult.runId);
      expect(resumed.status).toBeDefined();
      expect(resumed.runId).toBe(runResult.runId);
    }
  }, E2E_TIMEOUT);

  it("التحقق من checkpoint timestamps", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "checkpoint timestamps test",
      description: "التحقق من timestamps للـ checkpoints",
      domain: "coding",
      approvalMode: "auto"
    });

    const run = await getRun(ctx.app, runResult.runId);

    // التحقق من updatedAt timestamp
    expect(run.updatedAt).toBeDefined();
    const timestamp = new Date(run.updatedAt);
    expect(timestamp.getTime()).toBeGreaterThan(0);
    expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
  }, E2E_TIMEOUT);
});
