import { getRun } from '@/lib/api/runs';
import { RunDetails } from '@/components/runs/run-details';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    runId: string;
  }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { runId } = await params;
  return {
    title: `تشغيل ${runId.slice(0, 8)} | Multi-Agent Platform`,
    description: 'عرض تفاصيل التشغيل',
  };
}

export default async function RunDetailsPage({ params }: PageProps) {
  const { runId } = await params;

  let run;
  try {
    run = await getRun(runId);
  } catch (error) {
    console.error('Failed to fetch run:', error);
    notFound();
  }

  return (
    <main>
      <RunDetails run={run} />
    </main>
  );
}
