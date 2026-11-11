import { Suspense } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { PageLoader } from "@/components/ui/PageLoader";
import { PrintPlan } from "@/components/floorplan/PrintPlan";

export const metadata = { title: "Plattegrond afdrukken" };

export default function PrintPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <AuthGate>
        <PrintPlan />
      </AuthGate>
    </Suspense>
  );
}
