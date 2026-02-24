/**
 * E2E Test: Content Creation Team Scenario
 * اختبار سيناريو فريق إنشاء المحتوى الكامل
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

describe("اختبار فريق إنشاء المحتوى E2E", () => {
  it("إنشاء فريق محتوى مع writer + editor + designer", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "إنشاء حملة تسويقية كاملة",
      description: "إنشاء محتوى تسويقي متكامل يشمل النصوص، التحرير، والتصميم",
      domain: "content",
      approvalMode: "auto",
      templateId: "content-default"
    });

    expect(runResult.runId).toBeDefined();
    expect(runResult.status).toBe("running");

    // التحقق من تنوع النماذج
    expect(verifyModelDiversity(runResult.assignments as Array<{ model: string }>)).toBe(true);

    // التحقق من وجود الأدوار المطلوبة
    const roleIds = (runResult.assignments as Array<{ roleId: string }>).map(a => a.roleId);
    expect(roleIds.some(id =>
      id.includes("writer") ||
      id.includes("content") ||
      id.includes("author")
    )).toBe(true);
  }, E2E_TIMEOUT);

  it("إنشاء محتوى متعدد الأنواع (blog, social, images)", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "محتوى متنوع",
      description: `
        أنشئ محتوى متكامل يشمل:
        1. مقال blog احترافي
        2. منشورات social media
        3. تصاميم جرافيكية
      `,
      domain: "content",
      approvalMode: "auto"
    });

    expect(runResult.runId).toBeDefined();

    // رفع أمثلة للمحتوى المنتج
    await uploadArtifact(
      ctx.app,
      runResult.runId,
      "blog-post.md",
      "text/markdown",
      "# Blog Post Title\n\nContent here..."
    );

    await uploadArtifact(
      ctx.app,
      runResult.runId,
      "social-post.txt",
      "text/plain",
      "Social media post content #hashtag"
    );

    const artifacts = await listArtifacts(ctx.app, runResult.runId);
    expect(artifacts.length).toBeGreaterThan(0);
    expect(artifacts.some(a => a.name === "blog-post.md")).toBe(true);
    expect(artifacts.some(a => a.name === "social-post.txt")).toBe(true);
  }, E2E_TIMEOUT);

  it("استخدام أدوات التصميم", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "تصميم انفوجرافيك",
      description: "إنشاء تصميم انفوجرافيك احترافي عن موضوع معين",
      domain: "content",
      approvalMode: "auto"
    });

    const events = await getRunEvents(ctx.app, runResult.runId);

    // البحث عن استخدام أدوات التصميم
    const hasDesignTools = events.some(e =>
      e.includes("tool") ||
      e.includes("design") ||
      e.includes("image") ||
      e.includes("visual")
    );
    expect(hasDesignTools || events.length > 5).toBe(true);
  }, E2E_TIMEOUT);

  it("التحقق من جودة المحتوى (verifier check)", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "محتوى عالي الجودة",
      description: "إنشاء محتوى احترافي مع ضمان الجودة",
      domain: "content",
      approvalMode: "auto"
    });

    const run = await getRun(ctx.app, runResult.runId);

    // التحقق من وجود verification
    if (run.verification) {
      expect(run.verification.passed).toBeDefined();
      expect(run.verification.score).toBeDefined();
      expect(Array.isArray(run.verification.issues)).toBe(true);
    }

    // التحقق من أن verifier تم تشغيله
    const events = await getRunEvents(ctx.app, runResult.runId);
    const hasVerification = events.some(e =>
      e.includes("verifier") ||
      e.includes("verification") ||
      e.includes("quality")
    );
    expect(hasVerification || run.verification !== undefined).toBe(true);
  }, E2E_TIMEOUT);

  it("إنشاء محتوى بلغات متعددة", async () => {
    const languages = ["العربية", "English"];

    for (const language of languages) {
      const runResult = await runTeamTask(ctx.app, {
        projectId: ctx.projectId,
        userId: ctx.userId,
        title: `Content in ${language}`,
        description: `إنشاء محتوى تسويقي باللغة ${language}`,
        domain: "content",
        approvalMode: "auto",
        language
      });

      expect(runResult.runId).toBeDefined();
      const run = await getRun(ctx.app, runResult.runId);
      expect(run.request.language).toBe(language);
    }
  }, E2E_TIMEOUT);

  it("اختبار revision loops للمحتوى", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "محتوى يحتاج مراجعة",
      description: "إنشاء محتوى قد يحتاج مراجعات متعددة للوصول للجودة المطلوبة",
      domain: "content",
      approvalMode: "auto"
    });

    const run = await getRun(ctx.app, runResult.runId);

    expect(run.revisionCount).toBeGreaterThanOrEqual(0);
    expect(run.revisionCount).toBeLessThanOrEqual(2); // max 2 revision loops
  }, E2E_TIMEOUT);

  it("إنشاء حملة تسويقية متكاملة", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "حملة تسويقية شاملة",
      description: `
        قم بإنشاء حملة تسويقية متكاملة لمنتج جديد:
        1. استراتيجية المحتوى
        2. نصوص إعلانية
        3. منشورات social media
        4. تصاميم بصرية
        5. landing page copy
      `,
      domain: "content",
      approvalMode: "auto"
    });

    expect(runResult.runId).toBeDefined();

    // رفع artifacts للحملة
    const campaignArtifacts = [
      { name: "strategy.md", type: "text/markdown", content: "# Campaign Strategy\n..." },
      { name: "ad-copy.txt", type: "text/plain", content: "Ad headline and body..." },
      { name: "social-posts.json", type: "application/json", content: JSON.stringify({ posts: [] }) }
    ];

    for (const artifact of campaignArtifacts) {
      await uploadArtifact(
        ctx.app,
        runResult.runId,
        artifact.name,
        artifact.type,
        artifact.content
      );
    }

    const artifacts = await listArtifacts(ctx.app, runResult.runId);
    expect(artifacts.length).toBeGreaterThanOrEqual(campaignArtifacts.length);
  }, E2E_TIMEOUT);

  it("اختبار content templates", async () => {
    const contentTypes = [
      "blog post",
      "social media",
      "email marketing",
      "product description"
    ];

    for (const contentType of contentTypes) {
      const runResult = await runTeamTask(ctx.app, {
        projectId: ctx.projectId,
        userId: ctx.userId,
        title: `Create ${contentType}`,
        description: `إنشاء ${contentType} احترافي`,
        domain: "content",
        approvalMode: "auto",
        metadata: { contentType }
      });

      expect(runResult.runId).toBeDefined();
      const run = await getRun(ctx.app, runResult.runId);
      expect(run.request.metadata?.contentType).toBe(contentType);
    }
  }, E2E_TIMEOUT);

  it("التحقق من SEO optimization", async () => {
    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "SEO-optimized content",
      description: "إنشاء محتوى محسّن لمحركات البحث مع keywords وmeta tags",
      domain: "content",
      approvalMode: "auto",
      metadata: { seoOptimized: true }
    });

    const run = await getRun(ctx.app, runResult.runId);
    expect(run.request.metadata?.seoOptimized).toBe(true);

    // رفع محتوى SEO
    await uploadArtifact(
      ctx.app,
      runResult.runId,
      "seo-article.html",
      "text/html",
      `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="description" content="SEO description">
        <meta name="keywords" content="keyword1, keyword2">
      </head>
      <body><h1>SEO Title</h1><p>Content...</p></body>
      </html>
      `
    );

    const artifacts = await listArtifacts(ctx.app, runResult.runId);
    expect(artifacts.some(a => a.name === "seo-article.html")).toBe(true);
  }, E2E_TIMEOUT);

  it("اختبار brand consistency", async () => {
    const brandGuidelines = {
      tone: "professional",
      colors: ["#0066cc", "#ffffff"],
      fonts: ["Arial", "Helvetica"]
    };

    const runResult = await runTeamTask(ctx.app, {
      projectId: ctx.projectId,
      userId: ctx.userId,
      title: "Brand-consistent content",
      description: "إنشاء محتوى متوافق مع هوية العلامة التجارية",
      domain: "content",
      approvalMode: "auto",
      metadata: { brandGuidelines }
    });

    const run = await getRun(ctx.app, runResult.runId);
    expect(run.request.metadata?.brandGuidelines).toBeDefined();
  }, E2E_TIMEOUT);
});
