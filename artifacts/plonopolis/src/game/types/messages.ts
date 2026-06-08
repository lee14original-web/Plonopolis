export type Message = {
  type: "success" | "error" | "info";
  title: string;
  text: string;
  fieldOnly?: boolean;
};

export type GameMessage = {
  id: string;
  from_user_id: string | null;
  from_username: string | null;
  from_avatar_skin?: number | null;
  to_user_id: string | null;
  to_username: string | null;
  to_avatar_skin?: number | null;
  type: "received" | "sent" | "system";
  category: "system" | "received" | "sent" | "market";
  subject: string;
  body: string;
  read: boolean;
  saved: boolean;
  created_at: string;
};
