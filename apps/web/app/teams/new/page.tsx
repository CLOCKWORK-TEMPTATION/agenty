import { TeamBuilderForm } from '@/components/team-builder/team-builder-form';

export const metadata = {
  title: 'فريق جديد | Multi-Agent Platform',
  description: 'إنشاء فريق وكلاء جديد',
};

export default function NewTeamPage() {
  return (
    <main>
      <div className="page-header">
        <div>
          <h1>إنشاء فريق جديد</h1>
          <p>قم ببناء فريق وكلاء مخصص أو استخدم قالب جاهز</p>
        </div>
      </div>

      <TeamBuilderForm />
    </main>
  );
}
