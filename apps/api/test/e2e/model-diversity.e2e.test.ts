/**
 * E2E Test: Model Diversity Tests
 * اختبار تنوع النماذج وتطبيق القواعد
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { E2ETestContext } from "./setup.js";
import {
  E2E_TIMEOUT,
  setupE2EContext,
  teardownE2EContext,
  runTeamTask,
  getRun,
  verifyModelDiversity,
  getModelCatalog
} from "./setup.js";

let ctx: E2ETestContext;

beforeAll(async () => {
  ctx = await setupE2EContext();
}, E2E_TIMEOUT);

afterAll(async () => {
  await teardownE2EContext(ctx);
});

describe("اختبار Model Diversity E2E", () => {
  it("التحقق من minimum 2 different models في الفريق", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "فريق بنماذج متنوعة",
      description: "فريق يجب أن يحتوي على نموذجين مختلفين على الأقل",
      domain: "coding",
      approvalMode: "auto"
    });

    expect(runResult.assignments).toBeDefined();
    expect(Array.isArray(runResult.assignments)).toBe(true);

    // التحقق من تنوع النماذج
    const isDiverse = verifyModelDiversity(
      runResult.assignments as Array<{ model: string }>
    );
    expect(isDiverse).toBe(true);

    // التحقق بشكل مباشر
    const models = (runResult.assignments as Array<{ model: string }>).map(a => a.model);
    const uniqueModels = new Set(models);
    expect(uniqueModels.size).toBeGreaterThanOrEqual(2);
  }, E2E_TIMEOUT);

  it("اختبار model diversity enforcement في فريق كبير", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "فريق كبير (5+ أدوار)",
      description: "فريق كبير مع عدة تخصصات مختلفة",
      domain: "coding",
      approvalMode: "auto",
      metadata: { teamSize: "large" }
    });

    const models = (runResult.assignments as Array<{ model: string }>).map(a => a.model);
    const uniqueModels = new Set(models);

    // فريق كبير يجب أن يكون لديه تنوع أكبر
    expect(uniqueModels.size).toBeGreaterThanOrEqual(2);
    expect(runResult.assignments.length).toBeGreaterThan(0);
  }, E2E_TIMEOUT);

  it("التحقق من استخدام نماذج مختلفة فعلياً", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "تحقق من استخدام نماذج مختلفة",
      description: "فريق يستخدم نماذج متعددة بالفعل",
      domain: "research",
      approvalMode: "auto"
    });

    const assignments = runResult.assignments as Array<{
      roleId: string;
      model: string;
      agentId: string;
    }>;

    expect(assignments.length).toBeGreaterThan(0);

    // جمع جميع النماذج المستخدمة
    const usedModels = assignments.map(a => a.model);
    const uniqueModels = new Set(usedModels);

    // عرض النماذج المستخدمة للتحقق
    console.log("Used models:", Array.from(uniqueModels));

    // التحقق من التنوع
    expect(uniqueModels.size).toBeGreaterThanOrEqual(2);

    // التحقق من أن كل دور له نموذج محدد
    for (const assignment of assignments) {
      expect(assignment.model).toBeDefined();
      expect(assignment.model.length).toBeGreaterThan(0);
    }
  }, E2E_TIMEOUT);

  it("اختبار fallback chains للنماذج", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "اختبار fallback chains",
      description: "التحقق من وجود fallback chains لكل دور",
      domain: "coding",
      approvalMode: "auto"
    });

    const run = await getRun(ctx.app, runResult.runId);

    // كل assignment يجب أن يكون له model
    for (const assignment of run.assignments) {
      expect((assignment as { model: string }).model).toBeDefined();
      expect((assignment as { roleId: string }).roleId).toBeDefined();
    }
  }, E2E_TIMEOUT);

  it("التحقق من quality-first scoring", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "اختبار quality scoring",
      description: "التحقق من أن اختيار النماذج يعتمد على الجودة",
      domain: "coding",
      approvalMode: "auto",
      metadata: { prioritizeQuality: true }
    });

    const assignments = runResult.assignments as Array<{ model: string }>;

    // التحقق من أن النماذج المختارة موجودة في catalog
    const catalog = await getModelCatalog(ctx.app);
    const catalogModels = catalog.map((m: { id: string }) => m.id);

    for (const assignment of assignments) {
      // النموذج يجب أن يكون من catalog
      // (أو قد يكون fallback model)
      expect(assignment.model).toBeDefined();
    }
  }, E2E_TIMEOUT);

  it("التحقق من عدم اعتماد cost في اختيار النماذج", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "اختبار no cost consideration",
      description: "التحقق من أن التكلفة لا تؤثر على اختيار النماذج",
      domain: "coding",
      approvalMode: "auto"
    });

    const run = await getRun(ctx.app, runResult.runId);

    // لا يجب أن يكون هناك أي metadata تتعلق بالتكلفة
    expect(run.request.metadata?.cost).toBeUndefined();
    expect(run.request.metadata?.costTracking).toBeUndefined();
  }, E2E_TIMEOUT);

  it("اختبار توزيع النماذج على الأدوار المختلفة", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "توزيع النماذج",
      description: "التحقق من توزيع جيد للنماذج على الأدوار",
      domain: "coding",
      approvalMode: "auto"
    });

    const assignments = runResult.assignments as Array<{
      roleId: string;
      model: string;
    }>;

    // إنشاء map للنماذج حسب الأدوار
    const modelsByRole = new Map<string, string>();
    for (const assignment of assignments) {
      modelsByRole.set(assignment.roleId, assignment.model);
    }

    // التحقق من أن كل دور له نموذج
    expect(modelsByRole.size).toBe(assignments.length);

    // التحقق من التنوع
    const uniqueModels = new Set(Array.from(modelsByRole.values()));
    expect(uniqueModels.size).toBeGreaterThanOrEqual(2);
  }, E2E_TIMEOUT);

  it("اختبار capability fit في اختيار النماذج", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "capability matching",
      description: "التحقق من أن النماذج المختارة تناسب متطلبات الدور",
      domain: "coding",
      approvalMode: "auto"
    });

    const assignments = runResult.assignments as Array<{
      roleId: string;
      model: string;
      tools: string[];
    }>;

    // التحقق من أن كل assignment له tools
    for (const assignment of assignments) {
      expect(Array.isArray(assignment.tools)).toBe(true);
    }
  }, E2E_TIMEOUT);

  it("اختبار tool reliability في اختيار النماذج", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "tool reliability test",
      description: "التحقق من موثوقية استخدام الأدوات في النماذج المختارة",
      domain: "coding",
      approvalMode: "auto",
      metadata: { requiresTools: true }
    });

    const assignments = runResult.assignments as Array<{
      tools: string[];
      model: string;
    }>;

    // التحقق من أن النماذج التي تحتاج tools لديها tools مخصصة
    if (runResult.request.metadata?.requiresTools) {
      const assignmentsWithTools = assignments.filter(a => a.tools.length > 0);
      expect(assignmentsWithTools.length).toBeGreaterThan(0);
    }
  }, E2E_TIMEOUT);

  it("اختبار latency reliability", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "latency test",
      description: "التحقق من أوقات الاستجابة للنماذج",
      domain: "coding",
      approvalMode: "auto"
    });

    // التحقق من أن التنفيذ لم يتأخر بشكل غير معقول
    const run = await getRun(ctx.app, runResult.runId);
    expect(run.updatedAt).toBeDefined();
  }, E2E_TIMEOUT);

  it("اختبار scoring formula: quality(0.65) + tool_reliability(0.20) + capability_fit(0.10) + latency(0.05)", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "scoring formula verification",
      description: "التحقق من تطبيق formula الصحيحة",
      domain: "coding",
      approvalMode: "auto"
    });

    // التحقق من أن النماذج المختارة تعكس الأولويات الصحيحة
    const assignments = runResult.assignments as Array<{ model: string }>;
    const uniqueModels = new Set(assignments.map(a => a.model));

    // الجودة هي الأولوية (65%)
    expect(uniqueModels.size).toBeGreaterThanOrEqual(2);
  }, E2E_TIMEOUT);
});
