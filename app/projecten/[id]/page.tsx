import { Suspense } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { PageLoader } from "@/components/ui/PageLoader";
import { Workspace } from "@/components/workspace/Workspace";

export default function ProjectPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <AuthGate>
        <Workspace />
      </AuthGate>
    </Suspense>
  );
}
