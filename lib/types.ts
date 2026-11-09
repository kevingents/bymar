import type { BuildGuide, Floorplan, ShoppingItem } from "./schemas";

export type Project = {
  id: string;
  owner_id: string;
  title: string;
  room_type: string | null;
  style: string | null;
  budget: number | null;
  description: string | null;
  cover_path: string | null;
  floorplan: Floorplan | null;
  shopping: ShoppingItem[];
  share_enabled: boolean;
  share_token: string | null;
  created_at: string;
  updated_at: string;
};

export type ImageKind = "generated" | "restyle" | "upload" | "progress" | "build";

export type ProjectImage = {
  id: string;
  project_id: string;
  kind: ImageKind;
  prompt: string | null;
  source_path: string | null;
  path: string;
  created_at: string;
};

export type ChatMessage = {
  id: string;
  project_id: string;
  role: "user" | "assistant";
  content: string;
  image_path: string | null;
  created_at: string;
};

export type BuildProgress = { steps?: Record<string, boolean>; materials?: Record<string, boolean> };

export type Build = {
  id: string;
  project_id: string;
  title: string;
  request: string;
  data: BuildGuide;
  progress: BuildProgress;
  image_path: string | null;
  created_at: string;
};

export type Comment = {
  id: string;
  project_id: string;
  author_name: string;
  body: string;
  created_at: string;
};

export const ROOM_TYPES = [
  "Woonkamer",
  "Slaapkamer",
  "Keuken",
  "Badkamer",
  "Werkkamer",
  "Kinderkamer",
  "Hal",
  "Eetkamer",
  "Balkon / tuin",
  "Anders",
];

export const STYLES = [
  "Japandi",
  "Scandinavisch",
  "Modern",
  "Industrieel",
  "Landelijk",
  "Boho",
  "Mid-century",
  "Minimalistisch",
  "Klassiek",
  "Wabi-sabi",
  "Mediterraan",
  "Eclectisch",
];
