// Templates Marketplace — Server Component (data fetching)
// The interactive shell (filter, modal, form) lives in TemplatesMarketplace (client).

import { fetchTemplates } from "@/lib/api";
import type { TemplateItem } from "@/lib/api";
import { TemplatesMarketplace } from "./templates-marketplace";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const result = await fetchTemplates();

  const templates: TemplateItem[] = result.ok ? result.data.items : [];
  const total = result.ok ? result.data.total : 0;
  const fetchError = result.ok ? null : result.message;

  return (
    <main>
      <TemplatesMarketplace
        initialTemplates={templates}
        total={total}
        fetchError={fetchError}
      />
    </main>
  );
}
