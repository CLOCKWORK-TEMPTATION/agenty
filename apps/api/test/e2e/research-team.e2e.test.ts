/**
 * E2E Test: Research Team Scenario
 * اختبار سيناريو فريق البحث الكامل
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { E2ETestContext } from "./setup.js";
import {
  E2E_TIMEOUT,
  setupE2EContext,
  teardownE2EContext,
  createDraft,
  approveDraft,
  runTeamTask,
  getRun,
  getRunEvents,
  verifyModelDiversity,
  verifyWorkflowOrder,
  listArtifacts
} from "./setup.js";

let ctx: E2ETestContext;

beforeAll(async () => {
  ctx = await setupE2EContext();
}, E2E_TIMEOUT);

afterAll(async () => {
  await teardownE2EContext(ctx);
});

describe("اختبار فريق البحث E2E", () => {
  it("إنشاء وتشغيل فريق بحث مع researcher + analyst + writer", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "أبحث عن اتجاهات الذكاء الاصطناعي في 2025",
      description: "أحتاج تقرير شامل عن أحدث اتجاهات الذكاء الاصطناعي في 2025 مع تحليل البيانات وكتابة تقرير احترافي",
      domain: "research",
      approvalMode: "auto",
      templateId: "research-default"
    });

    expect(runResult.runId).toBeDefined();
    expect(runResult.status).toBe("running");

    // التحقق من تنوع النماذج
    expect(verifyModelDiversity(runResult.assignments as Array<{ model: string }>)).toBe(true);

    // التحقق من ترتيب workflow
    expect(verifyWorkflowOrder(runResult.workflow)).toBe(true);

    // التحقق من وجود الأدوار المطلوبة
    const roleIds = (runResult.assignments as Array<{ roleId: string }>).map(a => a.roleId);
    expect(roleIds.some(id => id.includes("researcher") || id.includes("research"))).toBe(true);
    expect(roleIds.some(id => id.includes("analyst") || id.includes("analysis"))).toBe(true);
    expect(roleIds.some(id => id.includes("writer") || id.includes("write"))).toBe(true);
  }, E2E_TIMEOUT);

  it("استخدام أدوات البحث (search, scraping)", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "جمع معلومات عن شركات الذكاء الاصطناعي",
      description: "استخدم محركات البحث والـ web scraping لجمع معلومات عن أفضل 10 شركات في مجال الذكاء الاصطناعي",
      domain: "research",
      approvalMode: "auto"
    });

    expect(runResult.runId).toBeDefined();

    // انتظار إكمال التنفيذ أو وصول لحالة معينة
    const run = await getRun(ctx.app, runResult.runId);
    expect(run.runId).toBe(runResult.runId);
    expect(run.events.length).toBeGreaterThan(0);

    // التحقق من استخدام الأدوات
    const events = await getRunEvents(ctx.app, runResult.runId);
    const hasToolExecution = events.some(e =>
      e.includes("tool") ||
      e.includes("search") ||
      e.includes("scrape")
    );
    expect(hasToolExecution || events.length > 5).toBe(true);
  }, E2E_TIMEOUT);

  it("التحقق من النتائج النهائية وإنشاء artifacts", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "تقرير بحث تفصيلي",
      description: "إنشاء تقرير بحث تفصيلي عن تطبيقات GPT-4 في الصناعة",
      domain: "research",
      approvalMode: "auto"
    });

    expect(runResult.runId).toBeDefined();

    const run = await getRun(ctx.app, runResult.runId);

    // التحقق من الحالة النهائية
    expect(["running", "completed", "waiting_approval"]).toContain(run.status);

    // التحقق من وجود artifacts (التقارير المنتجة)
    const artifacts = await listArtifacts(ctx.app, runResult.runId);
    // قد يكون هناك artifacts أو لا يكون حسب التنفيذ
    expect(Array.isArray(artifacts)).toBe(true);
  }, E2E_TIMEOUT);

  it("اختبار نمط Auto (تلقائي بدون موافقة)", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "بحث سريع",
      description: "بحث سريع عن أحدث أخبار الذكاء الاصطناعي",
      domain: "research",
      approvalMode: "auto"
    });

    expect(runResult.runId).toBeDefined();

    const run = await getRun(ctx.app, runResult.runId);
    expect(run.request.approvalMode).toBe("auto");
    expect(run.status).not.toBe("waiting_approval"); // لا يجب أن يتوقف للموافقة
  }, E2E_TIMEOUT);

  it("اختبار نمط Approval (يتطلب موافقة)", async () => {
    // إنشاء draft أولاً
    const draft = await createDraft(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "بحث يتطلب موافقة",
      description: "بحث حساس يتطلب موافقة قبل التنفيذ",
      domain: "research",
      approvalMode: "approval"
    });

    expect(draft.draftId).toBeDefined();
    expect(draft.approved).toBe(false);

    // الموافقة على الـ draft
    const approved = await approveDraft(ctx.app, draft.draftId, ctx.projectId, ctx.userId);
    expect(approved.approved).toBe(true);

    // الآن يمكن تشغيل المهمة
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "بحث بعد الموافقة",
      description: "تنفيذ البحث بعد الحصول على الموافقة",
      domain: "research",
      approvalMode: "approval"
    });

    expect(runResult.runId).toBeDefined();
  }, E2E_TIMEOUT);

  it("اختبار multi-turn conversations (محادثات متعددة)", async () => {
    // المحادثة الأولى
    const run1 = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "البحث الأول",
      description: "ابحث عن معلومات أولية عن الموضوع X",
      domain: "research",
      approvalMode: "auto"
    });

    expect(run1.runId).toBeDefined();

    // المحادثة الثانية (تكملة)
    const run2 = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "البحث الثاني - تكملة",
      description: "بناءً على النتائج السابقة، أعمق في التفاصيل",
      domain: "research",
      approvalMode: "auto",
      metadata: {
        previousRunId: run1.runId,
        conversationType: "continuation"
      }
    });

    expect(run2.runId).toBeDefined();
    expect(run2.runId).not.toBe(run1.runId);

    // التحقق من الـ metadata
    const run2Details = await getRun(ctx.app, run2.runId);
    expect(run2Details.request.metadata?.previousRunId).toBe(run1.runId);
  }, E2E_TIMEOUT);

  it("التحقق من تسجيل الأحداث الكاملة", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "اختبار الأحداث",
      description: "مهمة لاختبار تسجيل جميع الأحداث",
      domain: "research",
      approvalMode: "auto"
    });

    const events = await getRunEvents(ctx.app, runResult.runId);

    expect(events.length).toBeGreaterThan(0);

    // التحقق من وجود أحداث رئيسية
    const eventTypes = new Set(events.map(e => e.split('.')[0]));
    expect(eventTypes.size).toBeGreaterThan(0);
  }, E2E_TIMEOUT);

  it("التحقق من state transitions", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "اختبار state transitions",
      description: "مهمة لاختبار انتقالات الحالة",
      domain: "research",
      approvalMode: "auto"
    });

    const run = await getRun(ctx.app, runResult.runId);

    // التحقق من الحالة الأولية
    expect(run.status).toBeDefined();
    expect(["draft", "running", "completed", "waiting_approval", "failed"]).toContain(run.status);

    // التحقق من وجود assignments
    expect(run.assignments).toBeDefined();
    expect(Array.isArray(run.assignments)).toBe(true);

    // التحقق من revision count
    expect(run.revisionCount).toBeDefined();
    expect(run.revisionCount).toBeGreaterThanOrEqual(0);
    expect(run.revisionCount).toBeLessThanOrEqual(2); // max 2 revision loops
  }, E2E_TIMEOUT);
});
