import { AuthGate } from "@/components/auth/AuthGate";
import { SettingsPage } from "@/components/settings/SettingsPage";

export const metadata = { title: "Instellingen" };

export default function Page() {
  return (
    <AuthGate>
      <SettingsPage />
    </AuthGate>
  );
}
