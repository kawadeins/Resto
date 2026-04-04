/**
 * FriendsPanel — inline friends management widget.
 * Used in the Friends page and profile social tab.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus, UserCheck, UserX, X, Check, Search, Users, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  getFriends,
  getFriendRequests,
  sendFriendRequest,
  respondToRequest,
  removeFriend,
  nameInitials,
  type FriendProfile,
  type FriendRequest,
} from "@/lib/social-api";

function Avatar({ name, photoUrl, size = 10 }: { name: string; photoUrl: string | null; size?: number }) {
  if (photoUrl) {
    return <img src={photoUrl} alt={name} className={`w-${size} h-${size} rounded-full object-cover ring-2 ring-background shrink-0`} />;
  }
  return (
    <div className={`w-${size} h-${size} rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center ring-2 ring-background shrink-0`}>
      <span className="text-white font-bold text-xs">{nameInitials(name)}</span>
    </div>
  );
}

function FriendRow({ friend, email, onRemove }: { friend: FriendProfile; email: string; onRemove: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const remove = useMutation({
    mutationFn: () => removeFriend(email, friend.email),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["friends", email] });
      toast({ title: "Freund entfernt" });
      onRemove();
    },
  });

  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl hover:bg-muted/40 transition-colors">
      <Avatar name={friend.name || friend.email} photoUrl={friend.photoUrl} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{friend.name || friend.email.split("@")[0]}</p>
        <p className="text-xs text-muted-foreground truncate">{friend.email}</p>
      </div>
      {confirming ? (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="destructive"
            className="h-7 text-xs rounded-xl"
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
          >
            Entfernen
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-xl" onClick={() => setConfirming(false)}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-xl text-muted-foreground hover:text-destructive" onClick={() => setConfirming(true)}>
          <UserX className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}

function RequestRow({ req, email, onAction }: { req: FriendRequest; email: string; onAction: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isIncoming = req.recipientEmail === email;

  const respond = useMutation({
    mutationFn: (status: "accepted" | "rejected") => respondToRequest(req.id, status),
    onSuccess: (_, status) => {
      qc.invalidateQueries({ queryKey: ["friends", email] });
      qc.invalidateQueries({ queryKey: ["friend-requests", email] });
      toast({ title: status === "accepted" ? "Freundschaft angenommen!" : "Anfrage abgelehnt" });
      onAction();
    },
  });

  const name = isIncoming ? (req.requesterName ?? req.requesterEmail.split("@")[0]) : (req.recipientName ?? req.recipientEmail.split("@")[0]);
  const photo = isIncoming ? req.requesterPhoto ?? null : req.recipientPhoto ?? null;

  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/30 border border-border/50">
      <Avatar name={name} photoUrl={photo} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{name}</p>
        <p className="text-[11px] text-muted-foreground">{isIncoming ? "Möchte mit dir befreundet sein" : "Anfrage gesendet"}</p>
      </div>
      {isIncoming && (
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            className="h-7 w-7 p-0 rounded-xl bg-emerald-500 hover:bg-emerald-600 border-0"
            onClick={() => respond.mutate("accepted")}
            disabled={respond.isPending}
          >
            <Check className="w-3.5 h-3.5 text-white" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 w-7 p-0 rounded-xl"
            onClick={() => respond.mutate("rejected")}
            disabled={respond.isPending}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

interface FriendsPanelProps {
  email: string;
  compact?: boolean;
  onFriendCountChange?: (n: number) => void;
}

export function FriendsPanel({ email, compact = false, onFriendCountChange }: FriendsPanelProps) {
  const [addEmail, setAddEmail] = useState("");
  const [addError, setAddError] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: friends = [], isLoading: loadingFriends } = useQuery({
    queryKey: ["friends", email],
    queryFn: () => getFriends(email),
    enabled: !!email,
    staleTime: 60000,
    select: (data) => {
      if (onFriendCountChange) onFriendCountChange(data.length);
      return data;
    },
  });

  const { data: requests = { incoming: [], outgoing: [] }, isLoading: loadingReqs } = useQuery({
    queryKey: ["friend-requests", email],
    queryFn: () => getFriendRequests(email),
    enabled: !!email,
    staleTime: 30000,
  });

  const sendReq = useMutation({
    mutationFn: () => sendFriendRequest(email, addEmail.trim().toLowerCase()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["friend-requests", email] });
      toast({ title: "Anfrage gesendet!", description: `Freundschaftsanfrage an ${addEmail} verschickt.` });
      setAddEmail("");
      setAddError("");
    },
    onError: (err: any) => {
      const msg = err.message ?? "";
      if (msg.includes("Already friends")) setAddError("Ihr seid bereits befreundet.");
      else if (msg.includes("pending")) setAddError("Anfrage bereits unterwegs.");
      else if (msg.includes("yourself")) setAddError("Du kannst dich nicht selbst hinzufügen.");
      else setAddError("Benutzer nicht gefunden oder Fehler.");
    },
  });

  const handleSend = () => {
    setAddError("");
    if (!addEmail.includes("@")) { setAddError("Gültige E-Mail eingeben."); return; }
    sendReq.mutate();
  };

  const incomingCount = requests.incoming.length;

  return (
    <div className="space-y-5">

      {/* Add friend */}
      <div className="bg-card border border-border/50 rounded-3xl p-5 space-y-3">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-primary" />
          Freund hinzufügen
        </h3>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="E-Mail-Adresse eingeben"
              value={addEmail}
              onChange={e => { setAddEmail(e.target.value); setAddError(""); }}
              onKeyDown={e => e.key === "Enter" && handleSend()}
              className="pl-10 rounded-2xl h-10"
            />
          </div>
          <Button
            onClick={handleSend}
            disabled={sendReq.isPending || !addEmail}
            className="rounded-2xl h-10 px-4 bg-gradient-to-r from-primary to-accent text-white border-0 font-bold"
          >
            Senden
          </Button>
        </div>
        {addError && <p className="text-xs text-destructive">{addError}</p>}
      </div>

      {/* Incoming requests */}
      {incomingCount > 0 && (
        <div className="bg-card border border-primary/20 rounded-3xl p-5 space-y-3">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-primary" />
            Anfragen
            <span className="bg-primary text-white text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center">{incomingCount}</span>
          </h3>
          <div className="space-y-2">
            {requests.incoming.map(r => (
              <RequestRow key={r.id} req={r} email={email} onAction={() => qc.invalidateQueries({ queryKey: ["friend-requests", email] })} />
            ))}
          </div>
        </div>
      )}

      {/* Outgoing pending */}
      {requests.outgoing.length > 0 && (
        <div className="bg-card border border-border/50 rounded-3xl p-5 space-y-3">
          <h3 className="font-bold text-sm text-muted-foreground flex items-center gap-2">
            <Users className="w-4 h-4" /> Ausstehende Anfragen
          </h3>
          <div className="space-y-2">
            {requests.outgoing.map(r => (
              <RequestRow key={r.id} req={r} email={email} onAction={() => qc.invalidateQueries({ queryKey: ["friend-requests", email] })} />
            ))}
          </div>
        </div>
      )}

      {/* Friends list */}
      <div className="bg-card border border-border/50 rounded-3xl p-5 space-y-3">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          Freunde
          {friends.length > 0 && (
            <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{friends.length}</span>
          )}
        </h3>
        {loadingFriends ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-2xl" />)}
          </div>
        ) : friends.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <div className="text-3xl mb-2">👋</div>
            <p>Noch keine Freunde. Lade jemanden ein!</p>
          </div>
        ) : (
          <div className="space-y-1">
            {(compact ? friends.slice(0, 5) : friends).map(f => (
              <FriendRow key={f.email} friend={f} email={email} onRemove={() => qc.invalidateQueries({ queryKey: ["friends", email] })} />
            ))}
            {compact && friends.length > 5 && (
              <button className="w-full text-xs font-bold text-primary py-2 flex items-center justify-center gap-1 hover:bg-primary/5 rounded-2xl transition-colors">
                Alle {friends.length} Freunde anzeigen <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
