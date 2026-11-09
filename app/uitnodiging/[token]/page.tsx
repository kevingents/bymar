import { Suspense } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { AcceptInvite } from "@/components/collab/AcceptInvite";
import { PageLoader } from "@/components/ui/PageLoader";

export const metadata = { title: "Uitnodiging", robots: { index: false } };

export default function InvitePage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <AuthGate>
        <AcceptInvite />
      </AuthGate>
    </Suspense>
  );
}
