export type CrmView =
  | "home"
  | "conversations"
  | "search"
  | "calendar"
  | "apps"
  | "social"
  | "files"
  | "campaigns"
  | "reputation"
  | "settings";

export type MessageChannel =
  | "sms"
  | "whatsapp"
  | "facebook"
  | "instagram"
  | "tiktok"
  | "google"
  | "email"
  | "internal";

export type MessageDirection = "inbound" | "outbound" | "internal";

export type CrmMessage = {
  id: string;
  body: string;
  direction: MessageDirection;
  createdAt: string;
  sender: string;
  status: "received" | "saved-local" | "failed";
};

export type CrmContact = {
  id: string;
  name: string;
  email: string;
  phone: string;
  owner: string;
  source: string;
  stage: string;
  value: number;
};

export type CrmConversation = {
  id: string;
  contact: CrmContact;
  channel: MessageChannel;
  assignedTo: string;
  unread: boolean;
  starred: boolean;
  updatedAt: string;
  messages: CrmMessage[];
  sample?: boolean;
};

export type CrmTask = {
  id: string;
  title: string;
  contactId?: string;
  dueAt: string;
  completed: boolean;
};

export type CrmAppointment = {
  id: string;
  title: string;
  contactName: string;
  startAt: string;
  durationMinutes: number;
  ccEmail: string;
  location: string;
};

export type CrmFile = {
  id: string;
  name: string;
  folder: string;
  type: string;
  size: number;
  createdAt: string;
  dataUrl: string;
};

export type CrmCampaign = {
  id: string;
  name: string;
  status: "Succeeded" | "Failed" | "Draft" | "Archived";
  updatedAt: string;
  executedAt: string;
  audience: number;
};

export type CrmReview = {
  id: string;
  customer: string;
  rating: number;
  body: string;
  createdAt: string;
  source: string;
};

export type AppearanceMode = "light" | "dark" | "system";

export type CrmState = {
  version: 1;
  conversations: CrmConversation[];
  tasks: CrmTask[];
  appointments: CrmAppointment[];
  files: CrmFile[];
  folders: string[];
  campaigns: CrmCampaign[];
  reviews: CrmReview[];
  pinnedApps: CrmView[];
  appearance: AppearanceMode;
};

export type IntegrationChannel = {
  connected: boolean;
  handle: string;
};

export type IntegrationStatus = {
  configured: boolean;
  modelConfigured: boolean;
  paidPlan: boolean;
  channels: Record<string, IntegrationChannel>;
};

export type AppNotice = {
  tone: "info" | "error" | "success";
  message: string;
};
