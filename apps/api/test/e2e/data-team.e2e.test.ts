/**
 * E2E Test: Data Analysis Team Scenario
 * اختبار سيناريو فريق تحليل البيانات الكامل
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

describe("اختبار فريق تحليل البيانات E2E", () => {
  it("إنشاء فريق تحليل بيانات مع analyst + visualizer + reporter", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "تحليل بيانات المبيعات",
      description: "تحليل شامل لبيانات المبيعات مع visualizations وتقرير نهائي",
      domain: "data",
      approvalMode: "auto",
      templateId: "data-default"
    });

    expect(runResult.runId).toBeDefined();
    expect(runResult.status).toBe("running");

    // التحقق من تنوع النماذج
    expect(verifyModelDiversity(runResult.assignments as Array<{ model: string }>)).toBe(true);

    // التحقق من وجود الأدوار المطلوبة
    const roleIds = (runResult.assignments as Array<{ roleId: string }>).map(a => a.roleId);
    expect(roleIds.some(id =>
      id.includes("analyst") ||
      id.includes("analyze") ||
      id.includes("data")
    )).toBe(true);
  }, E2E_TIMEOUT);

  it("تحليل dataset حقيقي", async () => {
    // إنشاء dataset مثالي
    const sampleData = {
      sales: [
        { date: "2025-01-01", amount: 1000, region: "North" },
        { date: "2025-01-02", amount: 1500, region: "South" },
        { date: "2025-01-03", amount: 1200, region: "East" }
      ]
    };

    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "تحليل بيانات المبيعات الفعلية",
      description: "تحليل بيانات المبيعات المرفقة واستخراج insights",
      domain: "data",
      approvalMode: "auto",
      metadata: { dataset: sampleData }
    });

    expect(runResult.runId).toBeDefined();

    // رفع الـ dataset
    await uploadArtifact(
      ctx.app,
      runResult.runId,
      "sales-data.json",
      "application/json",
      JSON.stringify(sampleData)
    );

    const artifacts = await listArtifacts(ctx.app, runResult.runId);
    expect(artifacts.some(a => a.name === "sales-data.json")).toBe(true);
  }, E2E_TIMEOUT);

  it("إنشاء visualizations", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "إنشاء charts وgraphs",
      description: "إنشاء visualizations احترافية للبيانات المحللة",
      domain: "data",
      approvalMode: "auto"
    });

    // رفع visualization artifacts
    const visualizations = [
      { name: "sales-chart.svg", type: "image/svg+xml", content: "<svg>...</svg>" },
      { name: "trend-graph.json", type: "application/json", content: JSON.stringify({ type: "line", data: [] }) }
    ];

    for (const viz of visualizations) {
      await uploadArtifact(
        ctx.app,
        runResult.runId,
        viz.name,
        viz.type,
        viz.content
      );
    }

    const artifacts = await listArtifacts(ctx.app, runResult.runId);
    expect(artifacts.length).toBeGreaterThanOrEqual(visualizations.length);
  }, E2E_TIMEOUT);

  it("إنتاج تقرير نهائي شامل", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "تقرير تحليل بيانات كامل",
      description: `
        أنشئ تقرير تحليل بيانات شامل يتضمن:
        1. ملخص تنفيذي
        2. تحليل إحصائي
        3. visualizations
        4. توصيات
      `,
      domain: "data",
      approvalMode: "auto"
    });

    // رفع التقرير النهائي
    const report = {
      summary: "Executive summary...",
      analysis: "Statistical analysis...",
      visualizations: ["chart1.png", "chart2.png"],
      recommendations: ["Recommendation 1", "Recommendation 2"]
    };

    await uploadArtifact(
      ctx.app,
      runResult.runId,
      "final-report.json",
      "application/json",
      JSON.stringify(report)
    );

    await uploadArtifact(
      ctx.app,
      runResult.runId,
      "report.pdf",
      "application/pdf",
      "PDF content (base64 would go here)"
    );

    const artifacts = await listArtifacts(ctx.app, runResult.runId);
    expect(artifacts.some(a => a.name === "final-report.json")).toBe(true);
    expect(artifacts.some(a => a.mimeType === "application/pdf")).toBe(true);
  }, E2E_TIMEOUT);

  it("اختبار statistical analysis", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "تحليل إحصائي متقدم",
      description: "إجراء تحليل إحصائي متقدم يشمل correlation, regression, وhypothesis testing",
      domain: "data",
      approvalMode: "auto",
      metadata: { analysisType: "statistical" }
    });

    const run = await getRun(ctx.app, runResult.runId);
    expect(run.request.metadata?.analysisType).toBe("statistical");

    // رفع نتائج التحليل
    const results = {
      correlation: 0.85,
      regression: { slope: 1.2, intercept: 0.5, r_squared: 0.72 },
      hypothesis_test: { p_value: 0.03, significant: true }
    };

    await uploadArtifact(
      ctx.app,
      runResult.runId,
      "statistical-results.json",
      "application/json",
      JSON.stringify(results)
    );
  }, E2E_TIMEOUT);

  it("اختبار machine learning predictions", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "ML predictions",
      description: "بناء نموذج machine learning للتنبؤ بالمبيعات المستقبلية",
      domain: "data",
      approvalMode: "auto",
      metadata: { mlModel: "regression" }
    });

    const run = await getRun(ctx.app, runResult.runId);
    expect(run.request.metadata?.mlModel).toBe("regression");
  }, E2E_TIMEOUT);

  it("اختبار data cleaning وpreprocessing", async () => {
    const dirtyData = {
      records: [
        { name: "Item 1", value: 100, date: "2025-01-01" },
        { name: null, value: null, date: "invalid" }, // dirty record
        { name: "Item 3", value: 300, date: "2025-01-03" }
      ]
    };

    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "تنظيف البيانات",
      description: "تنظيف ومعالجة البيانات قبل التحليل",
      domain: "data",
      approvalMode: "auto",
      metadata: { rawData: dirtyData }
    });

    // رفع البيانات المنظفة
    const cleanData = {
      records: [
        { name: "Item 1", value: 100, date: "2025-01-01" },
        { name: "Item 3", value: 300, date: "2025-01-03" }
      ]
    };

    await uploadArtifact(
      ctx.app,
      runResult.runId,
      "clean-data.json",
      "application/json",
      JSON.stringify(cleanData)
    );
  }, E2E_TIMEOUT);

  it("اختبار dashboard creation", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "إنشاء dashboard تفاعلي",
      description: "بناء dashboard تفاعلي يعرض KPIs وmetrics مهمة",
      domain: "data",
      approvalMode: "auto"
    });

    // رفع dashboard config
    const dashboardConfig = {
      widgets: [
        { type: "metric", title: "Total Sales", value: 50000 },
        { type: "chart", title: "Monthly Trend", data: [] },
        { type: "table", title: "Top Products", data: [] }
      ]
    };

    await uploadArtifact(
      ctx.app,
      runResult.runId,
      "dashboard.json",
      "application/json",
      JSON.stringify(dashboardConfig)
    );
  }, E2E_TIMEOUT);

  it("اختبار time series analysis", async () => {
    const timeSeriesData = {
      timestamps: ["2025-01-01", "2025-01-02", "2025-01-03"],
      values: [100, 150, 120]
    };

    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "تحليل السلاسل الزمنية",
      description: "تحليل trends وseasonality في البيانات الزمنية",
      domain: "data",
      approvalMode: "auto",
      metadata: { timeSeriesData }
    });

    const run = await getRun(ctx.app, runResult.runId);
    expect(run.request.metadata?.timeSeriesData).toBeDefined();
  }, E2E_TIMEOUT);

  it("التحقق من data quality metrics", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "تقييم جودة البيانات",
      description: "تقييم completeness, accuracy, consistency للبيانات",
      domain: "data",
      approvalMode: "auto"
    });

    // رفع data quality report
    const qualityReport = {
      completeness: 0.95,
      accuracy: 0.92,
      consistency: 0.88,
      issues: ["Missing values in column X", "Duplicate records found"]
    };

    await uploadArtifact(
      ctx.app,
      runResult.runId,
      "quality-report.json",
      "application/json",
      JSON.stringify(qualityReport)
    );
  }, E2E_TIMEOUT);
});
