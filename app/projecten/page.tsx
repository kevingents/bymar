import { AuthGate } from "@/components/auth/AuthGate";
import { ProjectList } from "@/components/projects/ProjectList";

export const metadata = { title: "Projecten" };

export default function ProjectsPage() {
  return (
    <AuthGate>
      <ProjectList />
    </AuthGate>
  );
}
