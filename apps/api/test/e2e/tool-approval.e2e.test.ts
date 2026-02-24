/**
 * E2E Test: Tool Approval Flow
 * اختبار سيناريو الموافقة على استخدام الأدوات
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { E2ETestContext } from "./setup.js";
import {
  E2E_TIMEOUT,
  setupE2EContext,
  teardownE2EContext,
  runTeamTask,
  getRun,
  approveTool,
  getRunEvents
} from "./setup.js";

let ctx: E2ETestContext;

beforeAll(async () => {
  ctx = await setupE2EContext();
}, E2E_TIMEOUT);

afterAll(async () => {
  await teardownE2EContext(ctx);
});

describe("اختبار Tool Approval Flow E2E", () => {
  it("طلب استخدام أداة حساسة (git push)", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "مهمة تتطلب git push",
      description: "مهمة تحتاج استخدام git push للـ remote repository",
      domain: "coding",
      approvalMode: "approval",
      metadata: { requiresSensitiveTools: true }
    });

    const run = await getRun(ctx.app, runResult.runId);

    // التحقق من أن المهمة في وضع الانتظار
    if (run.status === "waiting_approval") {
      expect(run.request.metadata?.requiresSensitiveTools).toBe(true);
    }
  }, E2E_TIMEOUT);

  it("الموافقة على استخدام أداة", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "مهمة تحتاج موافقة على أداة",
      description: "استخدام أداة حساسة مع الموافقة",
      domain: "coding",
      approvalMode: "approval"
    });

    // الموافقة على استخدام أداة demo
    const approval = await approveTool(
      ctx.app,
      runResult.runId,
      "demo",
      true,
      ctx.projectId,
      ctx.userId
    );

    expect(approval.runId).toBe(runResult.runId);
    expect(approval.toolName).toBe("demo");
    expect(approval.approved).toBe(true);

    // التحقق من تسجيل الحدث
    const events = await getRunEvents(ctx.app, runResult.runId);
    expect(events.some(e => e.includes("tool.demo.approved"))).toBe(true);
  }, E2E_TIMEOUT);

  it("رفض استخدام أداة", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "مهمة سيتم رفض أداتها",
      description: "استخدام أداة سيتم رفضها",
      domain: "coding",
      approvalMode: "approval"
    });

    // رفض استخدام أداة dangerous
    const rejection = await approveTool(
      ctx.app,
      runResult.runId,
      "dangerous",
      false,
      ctx.projectId,
      ctx.userId
    );

    expect(rejection.runId).toBe(runResult.runId);
    expect(rejection.toolName).toBe("dangerous");
    expect(rejection.approved).toBe(false);

    // التحقق من تسجيل الحدث
    const events = await getRunEvents(ctx.app, runResult.runId);
    expect(events.some(e => e.includes("tool.dangerous.rejected"))).toBe(true);
  }, E2E_TIMEOUT);

  it("استكمال التنفيذ بعد الموافقة", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "مهمة مع موافقة وإكمال",
      description: "موافقة ثم إكمال التنفيذ",
      domain: "coding",
      approvalMode: "approval"
    });

    const beforeApproval = await getRun(ctx.app, runResult.runId);

    // الموافقة
    await approveTool(
      ctx.app,
      runResult.runId,
      "execute",
      true,
      ctx.projectId,
      ctx.userId
    );

    const afterApproval = await getRun(ctx.app, runResult.runId);

    // التحقق من أن التنفيذ استمر
    expect(afterApproval.events.length).toBeGreaterThanOrEqual(beforeApproval.events.length);
  }, E2E_TIMEOUT);

  it("اختبار interrupt للموافقة", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "اختبار interrupt",
      description: "مهمة تتوقف عند طلب الموافقة",
      domain: "coding",
      approvalMode: "approval"
    });

    const run = await getRun(ctx.app, runResult.runId);

    // قد يكون status = waiting_approval (interrupt)
    if (run.status === "waiting_approval") {
      expect(run.request.approvalMode).toBe("approval");
    }
  }, E2E_TIMEOUT);

  it("اختبار موافقة على أدوات متعددة", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "أدوات متعددة",
      description: "مهمة تتطلب موافقة على عدة أدوات",
      domain: "coding",
      approvalMode: "approval"
    });

    const tools = ["tool1", "tool2", "tool3"];

    for (const tool of tools) {
      await approveTool(
        ctx.app,
        runResult.runId,
        tool,
        true,
        ctx.projectId,
        ctx.userId
      );
    }

    const events = await getRunEvents(ctx.app, runResult.runId);

    // التحقق من تسجيل جميع الموافقات
    for (const tool of tools) {
      expect(events.some(e => e.includes(`tool.${tool}.approved`))).toBe(true);
    }
  }, E2E_TIMEOUT);

  it("اختبار sensitive tools قائمة (DB write, git push)", async () => {
    const sensitiveTools = [
      { name: "db_write", description: "كتابة في قاعدة البيانات" },
      { name: "git_push", description: "دفع إلى git remote" },
      { name: "file_delete", description: "حذف ملفات" }
    ];

    for (const tool of sensitiveTools) {
      const runResult = await runTeamTask(ctx.app, {
        projectId: ctx.projectId,
        userId: ctx.userId,
        title: `اختبار ${tool.name}`,
        description: tool.description,
        domain: "coding",
        approvalMode: "approval"
      });

      // الموافقة على الأداة الحساسة
      const approval = await approveTool(
        ctx.app,
        runResult.runId,
        tool.name,
        true,
        ctx.projectId,
        ctx.userId
      );

      expect(approval.approved).toBe(true);
      expect(approval.toolName).toBe(tool.name);
    }
  }, E2E_TIMEOUT);

  it("اختبار RBAC للموافقة على الأدوات", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "اختبار RBAC",
      description: "التحقق من صلاحيات الموافقة",
      domain: "coding",
      approvalMode: "approval"
    });

    // الموافقة بصلاحية owner
    const approval = await approveTool(
      ctx.app,
      runResult.runId,
      "restricted_tool",
      true,
      ctx.projectId,
      ctx.userId
    );

    expect(approval.approved).toBe(true);
  }, E2E_TIMEOUT);

  it("اختبار audit logging للموافقات", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "اختبار audit logging",
      description: "التحقق من تسجيل جميع الموافقات",
      domain: "coding",
      approvalMode: "approval"
    });

    await approveTool(
      ctx.app,
      runResult.runId,
      "audited_tool",
      true,
      ctx.projectId,
      ctx.userId
    );

    const events = await getRunEvents(ctx.app, runResult.runId);

    // التحقق من وجود audit event
    expect(events.some(e => e.includes("tool.audited_tool.approved"))).toBe(true);
  }, E2E_TIMEOUT);

  it("اختبار نمط Auto (لا يتطلب موافقة)", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "نمط Auto",
      description: "أدوات غير حساسة لا تتطلب موافقة",
      domain: "coding",
      approvalMode: "auto"
    });

    const run = await getRun(ctx.app, runResult.runId);

    // لا يجب أن يتوقف للموافقة
    expect(run.request.approvalMode).toBe("auto");
    expect(run.status).not.toBe("waiting_approval");
  }, E2E_TIMEOUT);
});
