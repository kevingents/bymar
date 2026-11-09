import { Suspense } from "react";
import { SharedProject } from "@/components/share/SharedProject";
import { PageLoader } from "@/components/ui/PageLoader";

export const metadata = { title: "Gedeeld project", robots: { index: false } };

export default function SharedPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <SharedProject />
    </Suspense>
  );
}
