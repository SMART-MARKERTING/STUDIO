import type {
  CrmAppointment,
  CrmCampaign,
  CrmConversation,
  CrmReview,
  CrmState,
  MessageChannel,
} from "./types";

const iso = (hoursAgo: number) =>
  new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

const conversations: CrmConversation[] = [
  {
    id: "starter-conversation-1",
    contact: {
      id: "starter-contact-1",
      name: "Jordan Lee",
      email: "jordan@example.com",
      phone: "+1 (480) 555-0142",
      owner: "Mykoal DeShazo",
      source: "Website",
      stage: "New inquiry",
      value: 185000,
    },
    channel: "sms",
    assignedTo: "Mykoal DeShazo",
    unread: true,
    starred: true,
    updatedAt: iso(1),
    sample: true,
    messages: [
      {
        id: "starter-message-1",
        body: "I would like to check my home equity options. What information do you need?",
        direction: "inbound",
        createdAt: iso(1),
        sender: "Jordan Lee",
        status: "received",
      },
    ],
  },
  {
    id: "starter-conversation-2",
    contact: {
      id: "starter-contact-2",
      name: "Taylor Grant",
      email: "taylor@example.com",
      phone: "+1 (602) 555-0188",
      owner: "Mykoal DeShazo",
      source: "Instagram",
      stage: "Follow-up",
      value: 92000,
    },
    channel: "instagram",
    assignedTo: "Mykoal DeShazo",
    unread: false,
    starred: false,
    updatedAt: iso(5),
    sample: true,
    messages: [
      {
        id: "starter-message-2",
        body: "Can you send the application link?",
        direction: "inbound",
        createdAt: iso(6),
        sender: "Taylor Grant",
        status: "received",
      },
      {
        id: "starter-message-3",
        body: "I can help you check options. I will send the secure link after we confirm a few details.",
        direction: "outbound",
        createdAt: iso(5),
        sender: "Mykoal DeShazo",
        status: "saved-local",
      },
    ],
  },
  {
    id: "starter-conversation-3",
    contact: {
      id: "starter-contact-3",
      name: "SmartR8 Support",
      email: "support@smartr8.com",
      phone: "",
      owner: "Support",
      source: "Internal",
      stage: "Internal",
      value: 0,
    },
    channel: "internal",
    assignedTo: "Team",
    unread: true,
    starred: false,
    updatedAt: iso(22),
    sample: true,
    messages: [
      {
        id: "starter-message-4",
        body: "Use this space for internal notes that should not be sent to a contact.",
        direction: "internal",
        createdAt: iso(22),
        sender: "SmartR8 Support",
        status: "received",
      },
    ],
  },
];

const campaigns: CrmCampaign[] = [
  {
    id: "campaign-starter-1",
    name: "Home equity education follow-up",
    status: "Draft",
    updatedAt: iso(30),
    executedAt: "",
    audience: 0,
  },
];

const reviews: CrmReview[] = [
  {
    id: "review-starter-1",
    customer: "Starter review preview",
    rating: 5,
    body: "Connected Google reviews will replace this clearly marked preview record.",
    createdAt: iso(72),
    source: "Preview",
  },
];

const appointments: CrmAppointment[] = [];

export function createCrmState(): CrmState {
  return {
    version: 1,
    conversations,
    tasks: [
      {
        id: "task-starter-1",
        title: "Review new conversation",
        contactId: "starter-contact-1",
        dueAt: iso(-2),
        completed: false,
      },
    ],
    appointments,
    files: [],
    folders: ["General", "Applications", "Marketing"],
    campaigns,
    reviews,
    pinnedApps: ["conversations", "social", "files", "calendar"],
    appearance: "system",
  };
}

export const channelLabels: Record<MessageChannel, string> = {
  sms: "SMS",
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  google: "Google Business",
  email: "Email",
  internal: "Internal",
};

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "SR";
}

export function relativeTime(value: string) {
  const elapsed = Date.now() - Date.parse(value);
  if (!Number.isFinite(elapsed)) return "Unknown";
  const minutes = Math.max(0, Math.floor(elapsed / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
