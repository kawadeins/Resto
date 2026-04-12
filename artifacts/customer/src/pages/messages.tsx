/**
 * Nachrichten — Direct Messages + Group Chats
 * Mobile-first chat interface. Requires friendship for DMs.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Send, Plus, Users, MessageCircle, MoreVertical,
  VolumeX, Volume2, ShieldOff, Shield, Check, CheckCheck,
  X, Search, Loader2
} from "lucide-react";
import { useSeo } from "@/hooks/use-seo";
import { useToast } from "@/hooks/use-toast";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const GRAD = "linear-gradient(135deg,hsl(263,70%,52%),hsl(330,85%,58%))";

function timeAgo(ts: string) {
  const d = Date.now() - new Date(ts).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "Jetzt";
  if (m < 60) return `${m} Min.`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} Std.`;
  return new Date(ts).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit" });
}

// ── Avatar ─────────────────────────────────────────────────────────────────────
function Avatar({ photoUrl, name, size = "md" }: { photoUrl?: string | null; name: string; size?: "sm" | "md" | "lg" }) {
  const [err, setErr] = useState(false);
  const dim = size === "sm" ? "w-8 h-8" : size === "lg" ? "w-12 h-12" : "w-10 h-10";
  const txt = size === "sm" ? "text-xs" : size === "lg" ? "text-lg" : "text-sm";
  const initials = (name || "?").split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
  if (photoUrl && !err) {
    const src = photoUrl.startsWith("/api") ? `${API_BASE}${photoUrl}` : photoUrl;
    return <img src={src} alt={name} onError={() => setErr(true)} className={`${dim} rounded-full object-cover border-2 border-white/60 shadow-sm`} />;
  }
  return (
    <div className={`${dim} rounded-full flex items-center justify-center border-2 border-white/30 shrink-0`} style={{ background: GRAD }}>
      <span className={`font-bold text-white ${txt}`}>{initials}</span>
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface ConvParticipant { user_email: string; name: string | null; photo_url: string | null }

interface Conversation {
  id: number; type: "direct" | "group"; name: string | null;
  created_by: string; created_at: string;
  last_message: string | null; last_message_at: string | null;
  unread_count: number; muted: boolean;
  participants: ConvParticipant[];
  allParticipants: ConvParticipant[];
}

interface Message {
  id: number; sender_email: string; text: string;
  is_read: boolean; created_at: string;
  sender_name: string | null; sender_photo: string | null;
}

interface Friend { email: string; name: string | null; photoUrl: string | null }

// ── CreateGroupModal ───────────────────────────────────────────────────────────
function CreateGroupModal({ email, onClose, onCreate }: { email: string; onClose: () => void; onCreate: (id: number) => void }) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: friends = [] } = useQuery<Friend[]>({
    queryKey: ["friends", email],
    queryFn: () => fetch(`${API_BASE}/api/social/friends/${encodeURIComponent(email)}`).then(r => r.json()),
    enabled: !!email,
  });

  const filtered = friends.filter(f =>
    !search || (f.name || f.email).toLowerCase().includes(search.toLowerCase())
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API_BASE}/api/messages/create-group`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorEmail: email, name: name.trim(), participantEmails: selected }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Fehler");
      return r.json();
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["conversations", email] });
      onCreate(d.conversationId);
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b">
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors">
            <X className="w-4 h-4" />
          </button>
          <p className="font-bold text-base flex-1">{"Gruppenchat erstellen"}</p>
          <button
            onClick={() => mutation.mutate()}
            disabled={!name.trim() || selected.length === 0 || mutation.isPending}
            className="text-sm font-bold text-primary disabled:opacity-40"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Erstellen"}
          </button>
        </div>
        <div className="px-5 py-3 border-b">
          <input
            placeholder="Gruppenname…"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-muted/40 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className="px-5 py-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              placeholder="Freunde suchen…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-muted/40 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>
        <div className="overflow-y-auto max-h-64 px-2 py-2">
          {filtered.length === 0 ? (
            <p className="text-center py-8 text-sm text-muted-foreground">{"Keine Freunde gefunden."}</p>
          ) : filtered.map(f => {
            const isSelected = selected.includes(f.email);
            return (
              <button
                key={f.email}
                onClick={() => setSelected(s => isSelected ? s.filter(x => x !== f.email) : [...s, f.email])}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-muted/50 transition-colors"
              >
                <Avatar photoUrl={f.photoUrl} name={f.name || f.email} size="md" />
                <p className="flex-1 text-sm font-semibold text-left">{f.name || f.email.split("@")[0]}</p>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? "border-primary bg-primary" : "border-border"}`}>
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>
              </button>
            );
          })}
        </div>
        {selected.length > 0 && (
          <div className="px-5 py-3 border-t bg-muted/20 text-xs text-muted-foreground font-medium">
            {selected.length} {selected.length === 1 ? "Person" : "Personen"} {"ausgewählt"}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Chat View ──────────────────────────────────────────────────────────────────
function ChatView({ convId, email, onBack }: { convId: number; email: string; onBack: () => void }) {
  const [text, setText] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ["messages", convId, email],
    queryFn: () => fetch(`${API_BASE}/api/messages/conversation/${convId}/${encodeURIComponent(email)}`, { credentials: "include" }).then(r => r.json()),
    refetchInterval: 3000,
  });

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["conversations", email],
  });

  const conv = conversations.find(c => c.id === convId);
  const otherParticipant = conv?.participants?.[0];
  const title = conv?.type === "group" ? (conv.name ?? "Gruppe") : (otherParticipant?.name || otherParticipant?.user_email?.split("@")[0] || "Chat");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async (t: string) => {
      const r = await fetch(`${API_BASE}/api/messages/send`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderEmail: email, conversationId: convId, text: t }),
      });
      const data = await r.json();
      if (!r.ok) {
        const err: any = new Error(data.error || "Fehler");
        err.moderated = data.moderated;
        err.strikeMessage = data.strikeMessage;
        throw err;
      }
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages", convId, email] }),
    onError: (e: any) => {
      if (e.moderated) {
        toast({ title: "Nachricht blockiert", description: e.message, variant: "destructive" });
        if (e.strikeMessage) setTimeout(() => toast({ title: "Hinweis", description: e.strikeMessage }), 800);
      } else {
        toast({ title: e.message || "Fehler", variant: "destructive" });
      }
    },
  });

  const muteMutation = useMutation({
    mutationFn: async (mute: boolean) => {
      const r = await fetch(`${API_BASE}/api/messages/mute/${convId}`, {
        method: mute ? "POST" : "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail: email }),
      });
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations", email] });
      setShowMenu(false);
    },
  });

  const blockMutation = useMutation({
    mutationFn: async () => {
      if (!otherParticipant) return;
      const r = await fetch(`${API_BASE}/api/messages/block`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockerEmail: email, blockedEmail: otherParticipant.user_email }),
      });
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Nutzer blockiert." });
      setShowMenu(false);
    },
  });

  const handleSend = useCallback(() => {
    const t = text.trim();
    if (!t || sendMutation.isPending) return;
    setText("");
    sendMutation.mutate(t);
  }, [text, sendMutation]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3.5 border-b shrink-0"
        style={{ background: "hsl(var(--background)/0.96)", backdropFilter: "blur(14px)" }}
      >
        <button onClick={onBack} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        {conv?.type === "direct" && otherParticipant && (
          <Avatar photoUrl={otherParticipant.photo_url} name={otherParticipant.name || otherParticipant.user_email} size="md" />
        )}
        {conv?.type === "group" && (
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{title}</p>
          {conv?.type === "group" && conv.allParticipants && (
            <p className="text-xs text-muted-foreground truncate">
              {conv.allParticipants.length} {"Mitglieder"}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowMenu(v => !v)}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors relative"
        >
          <MoreVertical className="w-5 h-5" />
          {showMenu && (
            <div className="absolute right-0 top-10 w-48 bg-popover border border-border rounded-2xl shadow-xl z-50 overflow-hidden" onClick={e => e.stopPropagation()}>
              {conv?.type === "direct" && otherParticipant && (
                <>
                  <button
                    onClick={() => muteMutation.mutate(!conv.muted)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50 transition-colors text-left"
                  >
                    {conv.muted ? <Volume2 className="w-4 h-4 text-muted-foreground" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
                    {conv.muted ? "Stummschalten aufheben" : "Stummschalten"}
                  </button>
                  <button
                    onClick={() => blockMutation.mutate()}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-destructive/10 text-destructive transition-colors text-left"
                  >
                    <ShieldOff className="w-4 h-4" /> {"Blockieren"}
                  </button>
                </>
              )}
              {conv?.type === "group" && (
                <button
                  onClick={() => muteMutation.mutate(!conv.muted)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50 transition-colors text-left"
                >
                  {conv.muted ? <Volume2 className="w-4 h-4 text-muted-foreground" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
                  {conv.muted ? "Stummschalten aufheben" : "Stummschalten"}
                </button>
              )}
            </div>
          )}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" onClick={() => setShowMenu(false)}>
        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary/50" />
          </div>
        )}
        {!isLoading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-3xl mb-3">{"👋"}</p>
            <p className="font-bold text-base mb-1">{"Fangt an zu schreiben!"}</p>
            <p className="text-sm text-muted-foreground">{"Noch keine Nachrichten."}</p>
          </div>
        )}
        {messages.map((msg, i) => {
          const isOwn = msg.sender_email === email;
          const showAvatar = !isOwn && (i === 0 || messages[i - 1].sender_email !== msg.sender_email);
          const isConsecutive = i > 0 && messages[i - 1].sender_email === msg.sender_email;

          return (
            <div key={msg.id} className={`flex items-end gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
              {/* Avatar for other */}
              {!isOwn && (
                <div className="w-7 shrink-0">
                  {showAvatar && <Avatar photoUrl={msg.sender_photo} name={msg.sender_name || msg.sender_email} size="sm" />}
                </div>
              )}
              <div className={`max-w-[72%] ${isConsecutive ? "mt-0.5" : "mt-2"}`}>
                {!isOwn && showAvatar && conv?.type === "group" && (
                  <p className="text-[11px] text-muted-foreground font-semibold ml-3 mb-0.5">
                    {msg.sender_name || msg.sender_email.split("@")[0]}
                  </p>
                )}
                <div
                  className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    isOwn
                      ? "text-white rounded-br-md"
                      : "bg-muted/60 text-foreground rounded-bl-md"
                  }`}
                  style={isOwn ? { background: GRAD } : undefined}
                >
                  {msg.text}
                </div>
                <p className={`text-[10px] text-muted-foreground mt-1 ${isOwn ? "text-right mr-1" : "ml-3"}`}>
                  {timeAgo(msg.created_at)}
                  {isOwn && (msg.is_read ? <CheckCheck className="inline w-3 h-3 ml-1 text-primary" /> : <Check className="inline w-3 h-3 ml-1" />)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 pb-6 pt-3 border-t" style={{ background: "hsl(var(--background)/0.97)" }}>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={"Nachricht…"}
            className="flex-1 bg-muted/50 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sendMutation.isPending}
            className="w-11 h-11 rounded-full flex items-center justify-center disabled:opacity-40 transition-all active:scale-90"
            style={{ background: GRAD }}
          >
            {sendMutation.isPending
              ? <Loader2 className="w-5 h-5 text-white animate-spin" />
              : <Send className="w-5 h-5 text-white" />
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Conversation List ──────────────────────────────────────────────────────────
function ConversationList({ email, activeId, onSelect, onCreateGroup, onStartDM }: {
  email: string; activeId: number | null;
  onSelect: (id: number) => void;
  onCreateGroup: () => void;
  onStartDM: () => void;
}) {
  const { data: conversations = [], isLoading } = useQuery<Conversation[]>({
    queryKey: ["conversations", email],
    queryFn: () => fetch(`${API_BASE}/api/messages/conversations/${encodeURIComponent(email)}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!email,
    refetchInterval: 5000,
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 border-b shrink-0"
        style={{ background: "hsl(var(--background)/0.96)", backdropFilter: "blur(14px)" }}
      >
        <p className="text-xl font-black">{"Nachrichten"}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={onStartDM}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors"
            title="Neue Nachricht"
          >
            <MessageCircle className="w-5 h-5" />
          </button>
          <button
            onClick={onCreateGroup}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors"
            title="Gruppe erstellen"
          >
            <Users className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary/50" />
          </div>
        )}
        {!isLoading && conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
            <p className="text-4xl mb-4">{"💬"}</p>
            <p className="font-bold text-lg mb-1">{"Keine Nachrichten"}</p>
            <p className="text-sm text-muted-foreground mb-6">{"Schreib deinen Freunden oder erstelle eine Gruppe."}</p>
            <button
              onClick={onStartDM}
              className="text-sm font-bold text-white px-5 py-2.5 rounded-xl hover:opacity-90 transition-all"
              style={{ background: GRAD }}
            >
              {"Neue Nachricht"}
            </button>
          </div>
        )}
        {conversations.map(conv => {
          const other = conv.participants?.[0];
          const displayName = conv.type === "group"
            ? (conv.name ?? "Gruppe")
            : (other?.name || other?.user_email?.split("@")[0] || "Chat");
          const photoUrl = conv.type === "direct" ? other?.photo_url : null;

          return (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/40 transition-colors text-left ${activeId === conv.id ? "bg-primary/6" : ""}`}
            >
              {conv.type === "group" ? (
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6 text-primary" />
                </div>
              ) : (
                <Avatar photoUrl={photoUrl} name={displayName} size="lg" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <p className={`text-sm font-bold truncate ${conv.unread_count > 0 ? "text-foreground" : "text-foreground/80"}`}>
                    {displayName}
                  </p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {conv.muted && <VolumeX className="w-3 h-3 text-muted-foreground" />}
                    {conv.last_message_at && (
                      <span className="text-[11px] text-muted-foreground">{timeAgo(conv.last_message_at)}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className={`text-xs truncate ${conv.unread_count > 0 ? "text-foreground/70 font-semibold" : "text-muted-foreground"}`}>
                    {conv.last_message ?? "Noch keine Nachrichten"}
                  </p>
                  {conv.unread_count > 0 && (
                    <span
                      className="w-5 h-5 rounded-full text-[10px] font-black text-white flex items-center justify-center shrink-0 ml-2"
                      style={{ background: GRAD }}
                    >
                      {conv.unread_count > 9 ? "9+" : conv.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Start DM Modal ─────────────────────────────────────────────────────────────
function StartDMModal({ email, onClose, onStarted }: { email: string; onClose: () => void; onStarted: (id: number) => void }) {
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: friends = [] } = useQuery<Friend[]>({
    queryKey: ["friends", email],
    queryFn: () => fetch(`${API_BASE}/api/social/friends/${encodeURIComponent(email)}`).then(r => r.json()),
    enabled: !!email,
  });

  const mutation = useMutation({
    mutationFn: async (recipientEmail: string) => {
      const r = await fetch(`${API_BASE}/api/messages/start-dm`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderEmail: email, recipientEmail }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Fehler");
      return r.json();
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["conversations", email] });
      onStarted(d.conversationId);
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const filtered = friends.filter(f =>
    !search || (f.name || f.email).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b">
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted/60 transition-colors">
            <X className="w-4 h-4" />
          </button>
          <p className="font-bold text-base">{"Neue Nachricht"}</p>
        </div>
        <div className="px-5 py-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              autoFocus
              placeholder="Freunde suchen…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-muted/40 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>
        <div className="overflow-y-auto max-h-80">
          {filtered.length === 0 && (
            <p className="text-center py-10 text-sm text-muted-foreground">{"Keine Freunde gefunden."}</p>
          )}
          {filtered.map(f => (
            <button
              key={f.email}
              onClick={() => mutation.mutate(f.email)}
              disabled={mutation.isPending}
              className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/50 transition-colors"
            >
              <Avatar photoUrl={f.photoUrl} name={f.name || f.email} size="md" />
              <p className="flex-1 text-sm font-semibold text-left">{f.name || f.email.split("@")[0]}</p>
              {mutation.isPending && mutation.variables === f.email && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function MessagesPage() {
  useSeo({ title: "Nachrichten – RestoSmart", description: "Schreib deinen Freunden und erstelle Gruppen." });

  const email = localStorage.getItem("restosmart_email") ?? "";
  const [, params] = useRoute("/messages/:convId");
  const convIdFromUrl = params?.convId ? parseInt(params.convId) : null;

  const [activeConvId, setActiveConvId] = useState<number | null>(convIdFromUrl);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showStartDM, setShowStartDM] = useState(false);

  useEffect(() => {
    if (convIdFromUrl) setActiveConvId(convIdFromUrl);
  }, [convIdFromUrl]);

  if (!email) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-8 pb-28">
        <p className="text-5xl mb-4">{"💬"}</p>
        <p className="font-bold text-xl mb-2">{"Nachrichten"}</p>
        <p className="text-sm text-muted-foreground mb-6">{"Melde dich an, um Nachrichten zu senden."}</p>
        <Link href="/profile" className="text-sm font-bold text-white px-6 py-3 rounded-2xl" style={{ background: GRAD }}>
          {"Anmelden"}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-0" style={{ background: "hsl(var(--background))" }}>
      {activeConvId !== null ? (
        <ChatView
          convId={activeConvId}
          email={email}
          onBack={() => setActiveConvId(null)}
        />
      ) : (
        <ConversationList
          email={email}
          activeId={activeConvId}
          onSelect={setActiveConvId}
          onCreateGroup={() => setShowCreateGroup(true)}
          onStartDM={() => setShowStartDM(true)}
        />
      )}

      {showCreateGroup && (
        <CreateGroupModal
          email={email}
          onClose={() => setShowCreateGroup(false)}
          onCreate={(id) => { setShowCreateGroup(false); setActiveConvId(id); }}
        />
      )}

      {showStartDM && (
        <StartDMModal
          email={email}
          onClose={() => setShowStartDM(false)}
          onStarted={(id) => { setShowStartDM(false); setActiveConvId(id); }}
        />
      )}
    </div>
  );
}
