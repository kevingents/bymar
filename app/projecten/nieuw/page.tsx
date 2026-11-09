import { AuthGate } from "@/components/auth/AuthGate";
import { NewProject } from "@/components/projects/NewProject";

export const metadata = { title: "Nieuw project" };

export default function NewProjectPage() {
  return (
    <AuthGate>
      <NewProject />
    </AuthGate>
  );
}
