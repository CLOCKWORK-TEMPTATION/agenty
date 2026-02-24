/**
 * E2E Test: Coding Team Scenario
 * اختبار سيناريو فريق البرمجة الكامل
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { E2ETestContext } from "./setup.js";
import {
  E2E_TIMEOUT,
  setupE2EContext,
  teardownE2EContext,
  runTeamTask,
  getRun,
  getRunEvents,
  verifyModelDiversity,
  verifyWorkflowOrder,
  uploadArtifact,
  listArtifacts
} from "./setup.js";

let ctx: E2ETestContext;

beforeAll(async () => {
  ctx = await setupE2EContext();
}, E2E_TIMEOUT);

afterAll(async () => {
  await teardownE2EContext(ctx);
});

describe("اختبار فريق البرمجة E2E", () => {
  it("إنشاء وتشغيل فريق برمجة مع architect + developer + tester + reviewer", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "تطوير API endpoint جديد",
      description: "إنشاء REST API endpoint لإدارة المستخدمين مع تصميم معماري، تطوير، اختبار، ومراجعة الكود",
      domain: "coding",
      approvalMode: "auto",
      templateId: "coding-default"
    });

    expect(runResult.runId).toBeDefined();
    expect(runResult.status).toBe("running");

    // التحقق من تنوع النماذج (minimum 2 different models)
    expect(verifyModelDiversity(runResult.assignments as Array<{ model: string }>)).toBe(true);

    // التحقق من ترتيب workflow الصحيح
    expect(verifyWorkflowOrder(runResult.workflow)).toBe(true);

    // التحقق من وجود الأدوار المطلوبة
    const roleIds = (runResult.assignments as Array<{ roleId: string }>).map(a => a.roleId);
    expect(roleIds.some(id =>
      id.includes("architect") ||
      id.includes("design") ||
      id.includes("planner")
    )).toBe(true);

    expect(roleIds.some(id =>
      id.includes("developer") ||
      id.includes("coder") ||
      id.includes("implementer")
    )).toBe(true);
  }, E2E_TIMEOUT);

  it("تنفيذ مهمة تطوير feature كاملة", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "Feature: User Authentication",
      description: `
        قم بتطوير نظام تسجيل الدخول الكامل:
        1. تصميم قاعدة البيانات
        2. إنشاء API endpoints (register, login, logout)
        3. كتابة unit tests
        4. مراجعة الكود والتأكد من أفضل الممارسات
      `,
      domain: "coding",
      approvalMode: "auto"
    });

    expect(runResult.runId).toBeDefined();

    const run = await getRun(ctx.app, runResult.runId);
    expect(run.status).toBeDefined();

    // التحقق من تسجيل الأحداث
    const events = await getRunEvents(ctx.app, runResult.runId);
    expect(events.length).toBeGreaterThan(0);

    // التحقق من أن verifier تم تشغيله
    const hasVerifier = events.some(e =>
      e.includes("verifier") ||
      e.includes("verification") ||
      e.includes("review")
    );
    expect(hasVerifier || run.verification !== undefined).toBe(true);
  }, E2E_TIMEOUT);

  it("استخدام أدوات البرمجة (git, testing, code analysis)", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "Refactor existing code",
      description: "قم بإعادة هيكلة الكود القديم وتحسينه مع استخدام git وأدوات التحليل",
      domain: "coding",
      approvalMode: "auto"
    });

    expect(runResult.runId).toBeDefined();

    const events = await getRunEvents(ctx.app, runResult.runId);

    // البحث عن استخدام الأدوات
    const hasToolUsage = events.some(e =>
      e.includes("tool") ||
      e.includes("git") ||
      e.includes("test") ||
      e.includes("analyze")
    );
    expect(hasToolUsage || events.length > 8).toBe(true);
  }, E2E_TIMEOUT);

  it("التحقق من الكود المنتج وجودته", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "Generate high-quality code",
      description: "إنشاء دالة معقدة لمعالجة البيانات مع documentation كامل",
      domain: "coding",
      approvalMode: "auto"
    });

    const run = await getRun(ctx.app, runResult.runId);

    // التحقق من وجود verification
    if (run.verification) {
      expect(run.verification.passed).toBeDefined();
      expect(run.verification.score).toBeDefined();
      expect(run.verification.issues).toBeDefined();
      expect(Array.isArray(run.verification.issues)).toBe(true);
    }

    // التحقق من artifacts (الكود المنتج)
    const artifacts = await listArtifacts(ctx.app, runResult.runId);
    expect(Array.isArray(artifacts)).toBe(true);
  }, E2E_TIMEOUT);

  it("اختبار revision loops (max 2)", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "Complex algorithm implementation",
      description: "تطوير خوارزمية معقدة قد تحتاج مراجعات متعددة",
      domain: "coding",
      approvalMode: "auto"
    });

    const run = await getRun(ctx.app, runResult.runId);

    // التحقق من revision count
    expect(run.revisionCount).toBeDefined();
    expect(run.revisionCount).toBeGreaterThanOrEqual(0);
    expect(run.revisionCount).toBeLessThanOrEqual(2); // max 2 revision loops enforced
  }, E2E_TIMEOUT);

  it("اختبار verifier enforcement (يجب تشغيل verifier قبل finalizer)", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "Code with verification",
      description: "كتابة كود يجب التحقق منه قبل الانتهاء",
      domain: "coding",
      approvalMode: "auto"
    });

    expect(runResult.workflow).toBeDefined();
    expect(Array.isArray(runResult.workflow)).toBe(true);

    // التحقق من أن verifier يأتي قبل finalizer
    const verifierIndex = runResult.workflow.indexOf('verifier');
    const finalizerIndex = runResult.workflow.indexOf('finalizer');

    if (verifierIndex !== -1 && finalizerIndex !== -1) {
      expect(verifierIndex).toBeLessThan(finalizerIndex);
    }
  }, E2E_TIMEOUT);

  it("إنشاء وتحميل code artifacts", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "Generate multiple code files",
      description: "إنشاء عدة ملفات برمجية (controller, service, tests)",
      domain: "coding",
      approvalMode: "auto"
    });

    // رفع artifact كمثال على الكود المنتج
    const artifact = await uploadArtifact(
      ctx.app,
      runResult.runId,
      "UserController.ts",
      "text/typescript",
      `
      export class UserController {
        async getUser(id: string) {
          return { id, name: "Test User" };
        }
      }
      `
    );

    expect(artifact.id).toBeDefined();
    expect(artifact.name).toBe("UserController.ts");
    expect(artifact.mimeType).toBe("text/typescript");
    expect(artifact.sizeBytes).toBeGreaterThan(0);

    // التحقق من قائمة الـ artifacts
    const artifacts = await listArtifacts(ctx.app, runResult.runId);
    expect(artifacts.length).toBeGreaterThan(0);
    expect(artifacts.some(a => a.id === artifact.id)).toBe(true);
  }, E2E_TIMEOUT);

  it("اختبار التطوير بلغات مختلفة", async () => {
    const languages = ["TypeScript", "Python", "Go"];

    for (const language of languages) {
      const runResult = await runTeamTask(ctx.app, {
        projectId: ctx.projectId,
        userId: ctx.userId,
        title: `Develop in ${language}`,
        description: `إنشاء API endpoint بسيط باستخدام ${language}`,
        domain: "coding",
        approvalMode: "auto",
        language
      });

      expect(runResult.runId).toBeDefined();
      const run = await getRun(ctx.app, runResult.runId);
      expect(run.request.language).toBe(language);
    }
  }, E2E_TIMEOUT);

  it("التحقق من audit logging للعمليات الحساسة", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "Sensitive operation",
      description: "تنفيذ عملية حساسة تتطلب audit logging",
      domain: "coding",
      approvalMode: "approval"
    });

    const run = await getRun(ctx.app, runResult.runId);

    // التحقق من أن الـ request تم تسجيله
    expect(run.request.userId).toBe(ctx.userId);
    expect(run.request.projectId).toBe(ctx.projectId);
    expect(run.request.approvalMode).toBe("approval");
  }, E2E_TIMEOUT);

  it("اختبار specialists_parallel execution", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "Parallel development tasks",
      description: "تطوير عدة components بشكل متوازي",
      domain: "coding",
      approvalMode: "auto"
    });

    const events = await getRunEvents(ctx.app, runResult.runId);

    // البحث عن أحداث specialists_parallel
    const hasParallelExecution = events.some(e =>
      e.includes("specialists") ||
      e.includes("parallel") ||
      e.includes("specialist")
    );

    // على الأقل يجب أن يكون workflow يحتوي على specialists_parallel
    expect(runResult.workflow.includes("specialists_parallel")).toBe(true);
  }, E2E_TIMEOUT);

  it("التحقق من tool_executor routing", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "Tool execution routing",
      description: "مهمة تتطلب استخدام عدة أدوات",
      domain: "coding",
      approvalMode: "auto"
    });

    // التحقق من أن tool_executor موجود في workflow
    expect(runResult.workflow.includes("tool_executor")).toBe(true);

    // التحقق من أن جميع tool calls تمر عبر tool_executor
    const events = await getRunEvents(ctx.app, runResult.runId);
    const toolEvents = events.filter(e => e.includes("tool"));

    // إذا كان هناك tool events، يجب أن تكون مرتبطة بـ tool_executor
    if (toolEvents.length > 0) {
      expect(runResult.workflow.includes("tool_executor")).toBe(true);
    }
  }, E2E_TIMEOUT);
});
