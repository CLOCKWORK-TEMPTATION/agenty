"use client";

/**
 * Template Marketplace Page - Browse + Install + Publish + Ratings
 */

import { useState, useEffect, useCallback } from "react";
import type { MarketplaceTemplate, TemplateRating } from "@repo/types";
import { useRouter } from "next/navigation";

interface TemplateWithRating extends MarketplaceTemplate {
  userRating?: number;
  isInstalled?: boolean;
}

export default function MarketplacePage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateWithRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"rating" | "installs" | "newest">("rating");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateWithRating | null>(null);
  const [ratings, setRatings] = useState<TemplateRating[]>([]);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [userTemplates, setUserTemplates] = useState<MarketplaceTemplate[]>([]);

  // Fetch marketplace templates
  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/v1/templates/marketplace");
      if (!response.ok) throw new Error("Failed to fetch templates");
      const data = await response.json();
      setTemplates(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const fetchRatings = async (templateId: string) => {
    try {
      const response = await fetch(`/api/v1/templates/${templateId}/ratings`);
      if (!response.ok) throw new Error("Failed to fetch ratings");
      const data = await response.json();
      setRatings(data.data || []);
    } catch (err) {
      console.error("Failed to fetch ratings:", err);
    }
  };

  const handleInstall = async (template: TemplateWithRating) => {
    try {
      const response = await fetch(`/api/v1/templates/${template.id}/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: "current-project" }),
      });

      if (!response.ok) throw new Error("Failed to install template");

      setTemplates(prev =>
        prev.map(t =>
          t.id === template.id ? { ...t, isInstalled: true, installCount: t.installCount + 1 } : t
        )
      );

      alert(`تم تثبيت القالب "${template.name}" بنجاح!`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "فشل التثبيت");
    }
  };

  const handleUninstall = async (template: TemplateWithRating) => {
    try {
      const response = await fetch(`/api/v1/templates/${template.id}/uninstall`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to uninstall template");

      setTemplates(prev =>
        prev.map(t =>
          t.id === template.id ? { ...t, isInstalled: false, installCount: Math.max(0, t.installCount - 1) } : t
        )
      );

      alert(`تم إلغاء تثبيت القالب "${template.name}"`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "فشل إلغاء التثبيت");
    }
  };

  const handleRate = async (templateId: string, rating: number, review?: string) => {
    try {
      const response = await fetch(`/api/v1/templates/${templateId}/ratings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, review }),
      });

      if (!response.ok) throw new Error("Failed to submit rating");

      setTemplates(prev =>
        prev.map(t =>
          t.id === templateId ? { ...t, userRating: rating } : t
        )
      );

      fetchRatings(templateId);
      alert("تم إضافة التقييم بنجاح!");
    } catch (err) {
      alert(err instanceof Error ? err.message : "فشل إرسال التقييم");
    }
  };

  const handlePublish = async (templateId: string) => {
    try {
      const response = await fetch(`/api/v1/templates/${templateId}/publish`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to publish template");

      setPublishModalOpen(false);
      fetchTemplates();
      alert("تم إرسال القالب للمراجعة بنجاح!");
    } catch (err) {
      alert(err instanceof Error ? err.message : "فشل النشر");
    }
  };

  const filteredTemplates = templates
    .filter(t => {
      if (selectedDomain !== "all" && !t.domains.includes(selectedDomain as any)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "rating") return b.averageRating - a.averageRating;
      if (sortBy === "installs") return b.installCount - a.installCount;
      if (sortBy === "newest") return new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime();
      return 0;
    });

  const domains = ["all", "coding", "research", "content", "data", "operations"];

  const openTemplateDetail = (template: TemplateWithRating) => {
    setSelectedTemplate(template);
    fetchRatings(template.id);
  };

  if (loading) {
    return (
      <div className="marketplace-container">
        <div className="loading-spinner">جاري التحميل...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="marketplace-container">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="marketplace-container" dir="rtl">
      {/* Header */}
      <div className="marketplace-header-section">
        <h1>سوق القوالب</h1>
        <p>اكتشف وثبّت قوالب فرق الوكلاء المذهلة</p>
      </div>

      {/* Controls */}
      <div className="marketplace-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="البحث في القوالب..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <select value={selectedDomain} onChange={(e) => setSelectedDomain(e.target.value)}>
            <option value="all">جميع المجالات</option>
            <option value="coding">برمجة</option>
            <option value="research">بحث</option>
            <option value="content">محتوى</option>
            <option value="data">بيانات</option>
            <option value="operations">عمليات</option>
          </select>

          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
            <option value="rating">الأعلى تقييماً</option>
            <option value="installs">الأكثر تثبيتاً</option>
            <option value="newest">الأحدث</option>
          </select>
        </div>

        <button className="publish-btn" onClick={() => setPublishModalOpen(true)}>
          نشر قالب جديد
        </button>
      </div>

      {/* Templates Grid */}
      <div className="templates-grid">
        {filteredTemplates.map((template) => (
          <div key={template.id} className="template-card-marketplace">
            <div className="card-header">
              <h3>{template.name}</h3>
              <span className="version">v{template.version}</span>
            </div>

            <p className="description">{template.description}</p>

            <div className="domains">
              {template.domains.map((d) => (
                <span key={d} className={`domain-badge ${d}`}>{d}</span>
              ))}
            </div>

            <div className="stats">
              <div className="stat">
                <span className="stars">{"★".repeat(Math.round(template.averageRating))}{"☆".repeat(5 - Math.round(template.averageRating))}</span>
                <span className="rating-text">({template.ratingCount})</span>
              </div>
              <div className="stat">
                <span>📥 {template.installCount} تثبيت</span>
              </div>
            </div>

            <div className="publisher">
              بواسطة: {template.publisherName}
            </div>

            <div className="card-actions">
              <button
                className="btn-view"
                onClick={() => openTemplateDetail(template)}
              >
                عرض التفاصيل
              </button>

              {template.isInstalled ? (
                <button
                  className="btn-uninstall"
                  onClick={() => handleUninstall(template)}
                >
                  إلغاء التثبيت
                </button>
              ) : (
                <button
                  className="btn-install"
                  onClick={() => handleInstall(template)}
                >
                  تثبيت
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Template Detail Modal */}
      {selectedTemplate && (
        <div className="modal-overlay" onClick={() => setSelectedTemplate(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedTemplate(null)}>×</button>

            <h2>{selectedTemplate.name}</h2>
            <p className="modal-description">{selectedTemplate.description}</p>

            <div className="modal-stats">
              <div className="stat-box">
                <div className="stat-value">{selectedTemplate.averageRating.toFixed(1)}</div>
                <div className="stat-label">التقييم</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">{selectedTemplate.installCount}</div>
                <div className="stat-label">التثبيتات</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">{selectedTemplate.roles.length}</div>
                <div className="stat-label">الأدوار</div>
              </div>
            </div>

            {/* User Rating */}
            <div className="user-rating-section">
              <h4>قيّم هذا القالب</h4>
              <div className="rating-input">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    className={`star-btn ${star <= (selectedTemplate.userRating || 0) ? "active" : ""}`}
                    onClick={() => handleRate(selectedTemplate.id, star)}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            {/* Reviews */}
            <div className="reviews-section">
              <h4>التقييمات ({ratings.length})</h4>
              {ratings.length === 0 ? (
                <p>لا توجد تقييمات بعد</p>
              ) : (
                ratings.map((rating) => (
                  <div key={rating.id} className="review-item">
                    <div className="review-header">
                      <span className="review-rating">{"★".repeat(rating.rating)}</span>
                      <span className="review-date">{new Date(rating.createdAt).toLocaleDateString("ar")}</span>
                    </div>
                    {rating.review && <p className="review-text">{rating.review}</p>}
                  </div>
                ))
              )}
            </div>

            <div className="modal-actions">
              {selectedTemplate.isInstalled ? (
                <button className="btn-uninstall-large" onClick={() => handleUninstall(selectedTemplate)}>
                  إلغاء التثبيت
                </button>
              ) : (
                <button className="btn-install-large" onClick={() => handleInstall(selectedTemplate)}>
                  تثبيت القالب
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Publish Modal */}
      {publishModalOpen && (
        <div className="modal-overlay" onClick={() => setPublishModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setPublishModalOpen(false)}>×</button>
            <h2>نشر قالب جديد</h2>
            <p>اختر قالباً من قوالبك لنشره في السوق</p>

            <div className="user-templates-list">
              {userTemplates.length === 0 ? (
                <p>لا توجد قوالب متاحة للنشر</p>
              ) : (
                userTemplates.map((template) => (
                  <div key={template.id} className="user-template-item">
                    <span>{template.name}</span>
                    <button onClick={() => handlePublish(template.id)}>نشر</button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .marketplace-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
        }

        .marketplace-header-section {
          text-align: center;
          margin-bottom: 2rem;
        }

        .marketplace-header-section h1 {
          font-size: 2rem;
          margin-bottom: 0.5rem;
        }

        .marketplace-controls {
          display: flex;
          gap: 1rem;
          margin-bottom: 2rem;
          flex-wrap: wrap;
          align-items: center;
        }

        .search-box input {
          padding: 0.75rem 1rem;
          border: 1px solid #ddd;
          border-radius: 8px;
          width: 300px;
          font-size: 1rem;
        }

        .filter-group {
          display: flex;
          gap: 0.5rem;
        }

        .filter-group select {
          padding: 0.75rem;
          border: 1px solid #ddd;
          border-radius: 8px;
        }

        .publish-btn {
          margin-right: auto;
          padding: 0.75rem 1.5rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
        }

        .templates-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 1.5rem;
        }

        .template-card-marketplace {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 12px;
          padding: 1.5rem;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          display: flex;
          flex-direction: column;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .card-header h3 {
          margin: 0;
          font-size: 1.25rem;
        }

        .version {
          background: #f0f0f0;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.875rem;
          color: #666;
        }

        .description {
          color: #666;
          margin-bottom: 1rem;
          line-height: 1.5;
          flex: 1;
        }

        .domains {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }

        .domain-badge {
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          text-transform: uppercase;
        }

        .domain-badge.coding { background: #e3f2fd; color: #1565c0; }
        .domain-badge.research { background: #f3e5f5; color: #7b1fa2; }
        .domain-badge.content { background: #e8f5e9; color: #2e7d32; }
        .domain-badge.data { background: #fff3e0; color: #ef6c00; }
        .domain-badge.operations { background: #fce4ec; color: #c2185b; }

        .stats {
          display: flex;
          gap: 1rem;
          margin-bottom: 0.75rem;
          font-size: 0.875rem;
          color: #666;
        }

        .stars {
          color: #ffc107;
        }

        .publisher {
          font-size: 0.875rem;
          color: #999;
          margin-bottom: 1rem;
        }

        .card-actions {
          display: flex;
          gap: 0.5rem;
        }

        .btn-view, .btn-install, .btn-uninstall {
          padding: 0.5rem 1rem;
          border-radius: 6px;
          border: none;
          cursor: pointer;
          font-weight: 500;
          flex: 1;
        }

        .btn-view {
          background: #f0f0f0;
          color: #333;
        }

        .btn-install {
          background: #4caf50;
          color: white;
        }

        .btn-uninstall {
          background: #f44336;
          color: white;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: white;
          border-radius: 12px;
          padding: 2rem;
          max-width: 600px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
          position: relative;
        }

        .modal-close {
          position: absolute;
          top: 1rem;
          left: 1rem;
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: #666;
        }

        .modal-description {
          color: #666;
          margin-bottom: 1.5rem;
        }

        .modal-stats {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .stat-box {
          background: #f5f5f5;
          padding: 1rem;
          border-radius: 8px;
          text-align: center;
          flex: 1;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: bold;
          color: #333;
        }

        .stat-label {
          font-size: 0.875rem;
          color: #666;
        }

        .user-rating-section {
          margin-bottom: 1.5rem;
        }

        .rating-input {
          display: flex;
          gap: 0.5rem;
        }

        .star-btn {
          font-size: 1.5rem;
          background: none;
          border: none;
          cursor: pointer;
          color: #ddd;
        }

        .star-btn.active {
          color: #ffc107;
        }

        .reviews-section {
          margin-bottom: 1.5rem;
        }

        .review-item {
          border-bottom: 1px solid #eee;
          padding: 1rem 0;
        }

        .review-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }

        .review-rating {
          color: #ffc107;
        }

        .review-date {
          color: #999;
          font-size: 0.875rem;
        }

        .review-text {
          color: #666;
          margin: 0;
        }

        .modal-actions {
          display: flex;
          gap: 1rem;
        }

        .btn-install-large, .btn-uninstall-large {
          flex: 1;
          padding: 1rem;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-install-large {
          background: #4caf50;
          color: white;
        }

        .btn-uninstall-large {
          background: #f44336;
          color: white;
        }

        .user-templates-list {
          margin-top: 1rem;
        }

        .user-template-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          border: 1px solid #eee;
          border-radius: 8px;
          margin-bottom: 0.5rem;
        }
      `}</style>
    </div>
  );
}
