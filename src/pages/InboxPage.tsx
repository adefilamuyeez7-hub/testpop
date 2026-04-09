import { useEffect, useMemo, useState } from "react";
import { Inbox, Loader2, MessageSquare, Plus, Send, Sparkles, Star, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/hooks/useContracts";
import { toast } from "sonner";
import {
  broadcastCreatorThreads,
  curateProductFeedbackThread,
  createCreatorChannel,
  createCreatorPost,
  createOrOpenCreatorThread,
  getCreatorThreadMessages,
  getFanHubOverview,
  getProductFeedbackThreadMessages,
  sendCreatorThreadMessage,
  sendProductFeedbackMessage,
  type CreatorThreadMessage,
  type FanHubOverview,
  type ProductFeedbackMessage,
} from "@/lib/db";
import { establishSecureSession } from "@/lib/secureAuth";
import { resolveMediaUrl } from "@/lib/pinata";

function formatRelativeDate(value?: string | null) {
  if (!value) return "Just now";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Just now";
  const diffMinutes = Math.floor((Date.now() - timestamp) / 60_000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(value).toLocaleDateString();
}

function formatEth(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0.00";
  return value >= 10 ? value.toFixed(1) : value.toFixed(2);
}

function getFeedbackThreadLabel(thread: FanHubOverview["feedback_threads"][number]) {
  const metadataTitle =
    typeof thread.metadata?.item_title === "string" ? thread.metadata.item_title : null;
  return thread.product?.name || thread.catalog_item?.title || metadataTitle || thread.title || "Item feedback";
}

const InboxPage = () => {
  const { address, isConnected, connectWallet } = useWallet();
  const [overview, setOverview] = useState<FanHubOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<CreatorThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadDraft, setThreadDraft] = useState("");
  const [selectedFeedbackThreadId, setSelectedFeedbackThreadId] = useState<string | null>(null);
  const [feedbackMessages, setFeedbackMessages] = useState<ProductFeedbackMessage[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackDraft, setFeedbackDraft] = useState("");
  const [threadForm, setThreadForm] = useState({ artistId: "", fanWallet: "", subject: "", body: "" });
  const [broadcastForm, setBroadcastForm] = useState({
    artistId: "",
    audience: "subscribers" as "collectors" | "subscribers" | "all_fans",
    subject: "",
    body: "",
  });
  const [channelForm, setChannelForm] = useState({
    artistId: "",
    name: "",
    description: "",
    accessLevel: "public" as "public" | "fan" | "subscriber" | "collector" | "backer",
  });
  const [postForm, setPostForm] = useState({
    artistId: "",
    channelId: "",
    title: "",
    body: "",
    postKind: "update" as "update" | "drop" | "release" | "reward" | "event" | "poll",
  });
  const [busy, setBusy] = useState<null | "channel" | "post" | "thread" | "broadcast" | "message" | "feedbackMessage" | "feedbackCurate">(null);

  const ownedCreators = overview?.owned_creators || [];
  const relationships = overview?.relationships || [];
  const channels = overview?.channels || [];
  const posts = overview?.recent_posts || [];
  const threads = overview?.threads || [];
  const feedbackThreads = overview?.feedback_threads || [];

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) || null,
    [selectedThreadId, threads],
  );
  const selectedFeedbackThread = useMemo(
    () => feedbackThreads.find((thread) => thread.id === selectedFeedbackThreadId) || null,
    [feedbackThreads, selectedFeedbackThreadId],
  );

  const artistOptions = useMemo(() => {
    const merged = new Map<string, string>();
    ownedCreators.forEach((artist) => merged.set(artist.id, artist.name || artist.handle || "Untitled Creator"));
    relationships.forEach((relationship) => merged.set(relationship.artist_id, relationship.artist_name));
    return Array.from(merged.entries()).map(([artistId, label]) => ({ artistId, label }));
  }, [ownedCreators, relationships]);

  const postChannels = useMemo(
    () => channels.filter((channel) => channel.artist_id === postForm.artistId),
    [channels, postForm.artistId],
  );

  async function loadOverview(preferredThreadId?: string | null) {
    if (!address || !isConnected) {
      setOverview(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await establishSecureSession(address);
      const nextOverview = await getFanHubOverview();
      setOverview(nextOverview);
      const defaultArtistId = nextOverview.owned_creators[0]?.id || nextOverview.relationships[0]?.artist_id || "";
      setSelectedThreadId(preferredThreadId || selectedThreadId || nextOverview.threads[0]?.id || null);
      setSelectedFeedbackThreadId((current) => current || nextOverview.feedback_threads[0]?.id || null);
      setThreadForm((prev) => ({ ...prev, artistId: prev.artistId || defaultArtistId }));
      setBroadcastForm((prev) => ({ ...prev, artistId: prev.artistId || nextOverview.owned_creators[0]?.id || "" }));
      setChannelForm((prev) => ({ ...prev, artistId: prev.artistId || nextOverview.owned_creators[0]?.id || "" }));
      setPostForm((prev) => {
        const artistId = prev.artistId || nextOverview.owned_creators[0]?.id || "";
        const channelId = prev.channelId || nextOverview.channels.find((channel) => channel.artist_id === artistId)?.id || "";
        return { ...prev, artistId, channelId };
      });
    } catch (loadError) {
      console.error(loadError);
      setOverview(null);
      setError(loadError instanceof Error ? loadError.message : "Failed to load inbox");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOverview();
  }, [address, isConnected]);

  useEffect(() => {
    if (!selectedThreadId || !isConnected) {
      setThreadMessages([]);
      return;
    }

    let active = true;
    setThreadLoading(true);
    getCreatorThreadMessages(selectedThreadId)
      .then((data) => {
        if (active) setThreadMessages(data.messages || []);
      })
      .catch((loadError) => {
        if (active) {
          console.error(loadError);
          setThreadMessages([]);
        }
      })
      .finally(() => {
        if (active) setThreadLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isConnected, selectedThreadId]);

  useEffect(() => {
    if (!selectedFeedbackThreadId || !isConnected) {
      setFeedbackMessages([]);
      return;
    }

    let active = true;
    setFeedbackLoading(true);
    getProductFeedbackThreadMessages(selectedFeedbackThreadId)
      .then((data) => {
        if (active) setFeedbackMessages(data.messages || []);
      })
      .catch((loadError) => {
        if (active) {
          console.error(loadError);
          setFeedbackMessages([]);
        }
      })
      .finally(() => {
        if (active) setFeedbackLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isConnected, selectedFeedbackThreadId]);

  useEffect(() => {
    if (!postForm.artistId) return;
    if (postChannels.some((channel) => channel.id === postForm.channelId)) return;
    setPostForm((prev) => ({ ...prev, channelId: postChannels[0]?.id || "" }));
  }, [postChannels, postForm.artistId, postForm.channelId]);

  useEffect(() => {
    if (!feedbackThreads.length) {
      setSelectedFeedbackThreadId(null);
      return;
    }

    if (selectedFeedbackThreadId && feedbackThreads.some((thread) => thread.id === selectedFeedbackThreadId)) {
      return;
    }

    setSelectedFeedbackThreadId(feedbackThreads[0]?.id || null);
  }, [feedbackThreads, selectedFeedbackThreadId]);

  async function handleCreateChannel() {
    if (!channelForm.artistId || !channelForm.name.trim()) {
      toast.error("Choose a creator and channel name first.");
      return;
    }

    setBusy("channel");
    try {
      await createCreatorChannel(channelForm);
      setChannelForm((prev) => ({ ...prev, name: "", description: "" }));
      toast.success("Channel created.");
      await loadOverview();
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Failed to create channel");
    } finally {
      setBusy(null);
    }
  }

  async function handleCreatePost() {
    if (!postForm.artistId || !postForm.channelId || !postForm.body.trim()) {
      toast.error("Choose a creator, channel, and post body.");
      return;
    }

    setBusy("post");
    try {
      await createCreatorPost(postForm);
      setPostForm((prev) => ({ ...prev, title: "", body: "" }));
      toast.success("Post published.");
      await loadOverview();
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Failed to publish post");
    } finally {
      setBusy(null);
    }
  }

  async function handleCreateThread() {
    if (!threadForm.artistId || !threadForm.body.trim()) {
      toast.error("Choose a creator and write the opening message.");
      return;
    }

    setBusy("thread");
    try {
      const thread = await createOrOpenCreatorThread(threadForm);
      setThreadForm((prev) => ({ ...prev, fanWallet: "", subject: "", body: "" }));
      toast.success("Thread ready.");
      await loadOverview(thread.id);
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Failed to create thread");
    } finally {
      setBusy(null);
    }
  }

  async function handleBroadcastThread() {
    if (!broadcastForm.artistId || !broadcastForm.body.trim()) {
      toast.error("Choose a creator and write the broadcast message.");
      return;
    }

    setBusy("broadcast");
    try {
      const result = await broadcastCreatorThreads(broadcastForm);
      setBroadcastForm((prev) => ({ ...prev, subject: "", body: "" }));
      toast.success(`Broadcast sent to ${result.recipient_count} fans.`);
      await loadOverview(selectedThreadId);
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Failed to send broadcast");
    } finally {
      setBusy(null);
    }
  }

  async function handleSendMessage() {
    if (!selectedThreadId || !threadDraft.trim()) return;

    setBusy("message");
    try {
      const message = await sendCreatorThreadMessage(selectedThreadId, threadDraft);
      setThreadMessages((prev) => [...prev, message]);
      setThreadDraft("");
      await loadOverview(selectedThreadId);
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Failed to send message");
    } finally {
      setBusy(null);
    }
  }

  async function handleSendFeedbackMessage() {
    if (!selectedFeedbackThreadId || !feedbackDraft.trim()) return;

    setBusy("feedbackMessage");
    try {
      const message = await sendProductFeedbackMessage(selectedFeedbackThreadId, feedbackDraft);
      setFeedbackMessages((prev) => [...prev, message]);
      setFeedbackDraft("");
      await loadOverview();
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Failed to send feedback reply");
    } finally {
      setBusy(null);
    }
  }

  async function handleCurateFeedback(updates: {
    featured?: boolean;
    creatorCurated?: boolean;
    status?: "open" | "closed" | "archived";
    visibility?: "public" | "private";
  }) {
    if (!selectedFeedbackThreadId) return;

    setBusy("feedbackCurate");
    try {
      await curateProductFeedbackThread({
        threadId: selectedFeedbackThreadId,
        ...updates,
      });
      await loadOverview(selectedThreadId);
      toast.success("Feedback thread updated.");
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Failed to update feedback thread");
    } finally {
      setBusy(null);
    }
  }

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <div className="rounded-[2rem] border border-[#dbeafe] bg-[linear-gradient(180deg,#ffffff_0%,#f4f9ff_100%)] p-8 shadow-[0_30px_80px_rgba(37,99,235,0.08)]">
          <Inbox className="mx-auto mb-4 h-12 w-12 text-primary" />
          <h1 className="text-2xl font-black text-foreground">Creator Inbox</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Connect your wallet to read creator channels, fan updates, and private threads.
          </p>
          <Button onClick={() => void connectWallet()} className="mt-6 rounded-full gradient-primary text-primary-foreground">
            Connect wallet
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-88px)] bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.18),transparent_28%),linear-gradient(180deg,#f7fbff_0%,#edf5ff_100%)] px-4 py-4 md:px-6 md:py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-white/80 bg-white/92 p-5 shadow-[0_35px_120px_rgba(37,99,235,0.10)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/70">Superfan OS</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground">Inbox & Fan Club</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Read creator updates, publish gated posts, and keep creator-fan threads alive from one shared surface.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-[1.4rem] bg-[#eff6ff] px-4 py-3"><p className="text-[11px] uppercase tracking-[0.18em] text-primary/70">Relationships</p><p className="mt-2 text-2xl font-black text-foreground">{relationships.length}</p></div>
              <div className="rounded-[1.4rem] bg-[#eff6ff] px-4 py-3"><p className="text-[11px] uppercase tracking-[0.18em] text-primary/70">Channels</p><p className="mt-2 text-2xl font-black text-foreground">{channels.length}</p></div>
              <div className="rounded-[1.4rem] bg-[#eff6ff] px-4 py-3"><p className="text-[11px] uppercase tracking-[0.18em] text-primary/70">Feedback</p><p className="mt-2 text-2xl font-black text-foreground">{overview?.unread_counts.feedback || 0}</p></div>
              <div className="rounded-[1.4rem] bg-[#eff6ff] px-4 py-3"><p className="text-[11px] uppercase tracking-[0.18em] text-primary/70">Threads</p><p className="mt-2 text-2xl font-black text-foreground">{threads.length}</p></div>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="rounded-[2rem] border border-white/80 bg-white/92 p-10 text-center shadow-[0_30px_80px_rgba(37,99,235,0.08)]">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Loading your creator relationships...</p>
          </div>
        ) : error ? (
          <div className="rounded-[2rem] border border-[#fecaca] bg-white/92 p-6 shadow-[0_30px_80px_rgba(239,68,68,0.08)]">
            <p className="text-lg font-semibold text-foreground">Inbox unavailable</p>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <Button onClick={() => void loadOverview()} className="mt-4 rounded-full">Try again</Button>
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1.1fr)_minmax(320px,0.95fr)]">
            <aside className="space-y-4">
              <div className="rounded-[1.8rem] border border-white/80 bg-white/92 p-4 shadow-[0_30px_80px_rgba(37,99,235,0.08)]">
                <div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><p className="text-sm font-semibold text-foreground">Your creator relationships</p></div>
                <div className="mt-4 space-y-3">
                  {relationships.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No synced relationships yet. Subscribe, collect, or back a creator and the inbox will build your fan graph.</p>
                  ) : relationships.map((relationship) => (
                    <div key={relationship.artist_id} className="rounded-[1.2rem] bg-[#f7fbff] p-3">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 overflow-hidden rounded-2xl bg-secondary">
                          {resolveMediaUrl(relationship.avatar_url, relationship.banner_url) ? <img src={resolveMediaUrl(relationship.avatar_url, relationship.banner_url)} alt={relationship.artist_name} className="h-full w-full object-cover" /> : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{relationship.artist_name}</p>
                          <p className="text-xs text-muted-foreground">Score {relationship.relationship_score} · {formatRelativeDate(relationship.last_interacted_at)}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {relationship.active_subscription && <Badge className="bg-[#dbeafe] text-[#1d4ed8]">Subscriber</Badge>}
                        {!relationship.active_subscription && relationship.is_subscriber && <Badge variant="outline">Past subscriber</Badge>}
                        {relationship.is_collector && <Badge variant="outline">Collector</Badge>}
                        {relationship.is_backer && <Badge variant="outline">Backer</Badge>}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div className="rounded-xl bg-white px-3 py-2"><p className="font-semibold text-foreground">{relationship.orders_count}</p><p>Orders</p></div>
                        <div className="rounded-xl bg-white px-3 py-2"><p className="font-semibold text-foreground">{formatEth(relationship.total_spent_eth)} ETH</p><p>Spent</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {ownedCreators.length > 0 && (
                <div className="rounded-[1.8rem] border border-white/80 bg-white/92 p-4 shadow-[0_30px_80px_rgba(37,99,235,0.08)]">
                  <div className="flex items-center gap-2"><Plus className="h-4 w-4 text-primary" /><p className="text-sm font-semibold text-foreground">Creator tools</p></div>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-[1.2rem] bg-[#f7fbff] p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">New channel</p>
                      <select value={channelForm.artistId} onChange={(event) => setChannelForm((prev) => ({ ...prev, artistId: event.target.value }))} className="mt-3 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm">
                        <option value="">Select creator</option>
                        {ownedCreators.map((artist) => <option key={artist.id} value={artist.id}>{artist.name || artist.handle || "Untitled Creator"}</option>)}
                      </select>
                      <Input value={channelForm.name} onChange={(event) => setChannelForm((prev) => ({ ...prev, name: event.target.value }))} className="mt-3 h-10 rounded-xl bg-white" placeholder="Channel name" />
                      <Input value={channelForm.description} onChange={(event) => setChannelForm((prev) => ({ ...prev, description: event.target.value }))} className="mt-3 h-10 rounded-xl bg-white" placeholder="What lives here?" />
                      <select value={channelForm.accessLevel} onChange={(event) => setChannelForm((prev) => ({ ...prev, accessLevel: event.target.value as typeof channelForm.accessLevel }))} className="mt-3 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm">
                        <option value="public">Public</option>
                        <option value="fan">Any fan</option>
                        <option value="subscriber">Subscribers</option>
                        <option value="collector">Collectors</option>
                        <option value="backer">Backers</option>
                      </select>
                      <Button onClick={() => void handleCreateChannel()} disabled={busy === "channel"} className="mt-3 h-10 w-full rounded-xl gradient-primary text-primary-foreground">{busy === "channel" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create channel"}</Button>
                    </div>

                    <div className="rounded-[1.2rem] bg-[#f7fbff] p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Publish update</p>
                      <select value={postForm.artistId} onChange={(event) => setPostForm((prev) => ({ ...prev, artistId: event.target.value, channelId: "" }))} className="mt-3 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm">
                        <option value="">Select creator</option>
                        {ownedCreators.map((artist) => <option key={artist.id} value={artist.id}>{artist.name || artist.handle || "Untitled Creator"}</option>)}
                      </select>
                      <select value={postForm.channelId} onChange={(event) => setPostForm((prev) => ({ ...prev, channelId: event.target.value }))} className="mt-3 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm">
                        <option value="">Select channel</option>
                        {postChannels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}
                      </select>
                      <select value={postForm.postKind} onChange={(event) => setPostForm((prev) => ({ ...prev, postKind: event.target.value as typeof postForm.postKind }))} className="mt-3 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm">
                        <option value="update">Update</option>
                        <option value="drop">Drop</option>
                        <option value="release">Release</option>
                        <option value="reward">Reward</option>
                        <option value="event">Event</option>
                        <option value="poll">Poll</option>
                      </select>
                      <Input value={postForm.title} onChange={(event) => setPostForm((prev) => ({ ...prev, title: event.target.value }))} className="mt-3 h-10 rounded-xl bg-white" placeholder="Optional title" />
                      <textarea value={postForm.body} onChange={(event) => setPostForm((prev) => ({ ...prev, body: event.target.value }))} className="mt-3 min-h-[112px] w-full rounded-xl border border-border bg-white px-3 py-3 text-sm" placeholder="Write the update your fans should see..." />
                      <Button onClick={() => void handleCreatePost()} disabled={busy === "post"} className="mt-3 h-10 w-full rounded-xl gradient-primary text-primary-foreground">{busy === "post" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish post"}</Button>
                    </div>
                  </div>
                </div>
              )}
            </aside>

            <section className="space-y-4">
              <div className="rounded-[1.8rem] border border-white/80 bg-white/92 p-4 shadow-[0_30px_80px_rgba(37,99,235,0.08)]">
                <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><p className="text-sm font-semibold text-foreground">Creator feed</p></div>
                <div className="mt-4 space-y-3">
                  {posts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No posts yet. As creators publish updates, this becomes the living heartbeat of the fan club.</p>
                  ) : posts.map((post) => (
                    <article key={post.id} className="rounded-[1.3rem] bg-[#f7fbff] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{post.title || post.channel?.name || "Creator update"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{(post.artist?.name || post.artist?.handle || "Creator")} · {post.post_kind} · {formatRelativeDate(post.published_at || post.created_at)}</p>
                        </div>
                        <Badge variant="outline" className="capitalize">{post.channel?.access_level || "public"}</Badge>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground/85">{post.body}</p>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="rounded-[1.8rem] border border-white/80 bg-white/92 p-4 shadow-[0_30px_80px_rgba(37,99,235,0.08)]">
                <div className="flex items-center gap-2"><Star className="h-4 w-4 text-primary" /><p className="text-sm font-semibold text-foreground">Feedback Inbox</p></div>
                <div className="mt-4 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="space-y-2">
                    {feedbackThreads.length === 0 ? (
                      <p className="rounded-[1.2rem] bg-[#f7fbff] px-4 py-5 text-sm text-muted-foreground">
                        Verified collector feedback will appear here once fans respond from their collection.
                      </p>
                    ) : feedbackThreads.map((thread) => (
                      <button
                        key={thread.id}
                        type="button"
                        onClick={() => setSelectedFeedbackThreadId(thread.id)}
                        className={`w-full rounded-[1.2rem] px-3 py-3 text-left transition-colors ${selectedFeedbackThreadId === thread.id ? "bg-[#dbeafe]" : "bg-[#f7fbff]"}`}
                      >
                        <p className="truncate text-sm font-semibold text-foreground">{getFeedbackThreadLabel(thread)}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {thread.latest_message?.body || thread.title || "Open feedback thread"}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <Badge variant="outline" className="capitalize">{thread.item_type}</Badge>
                          {thread.visibility === "public" ? <Badge variant="outline">Public</Badge> : <Badge variant="outline">Private</Badge>}
                          {thread.feedback_type === "review" ? <Badge className="bg-[#ecfeff] text-[#155e75]">Review</Badge> : null}
                          {thread.subscriber_priority ? <Badge className="bg-[#dcfce7] text-[#166534]">Subscriber</Badge> : null}
                          {thread.featured ? <Badge className="bg-[#fef3c7] text-[#92400e]">Featured</Badge> : null}
                        </div>
                        <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-primary/70">{formatRelativeDate(thread.last_message_at)}</p>
                      </button>
                    ))}
                  </div>

                  <div className="rounded-[1.2rem] bg-[#f7fbff] p-3">
                    {selectedFeedbackThread ? (
                      <>
                        <div className="border-b border-border/60 pb-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                {getFeedbackThreadLabel(selectedFeedbackThread)}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {selectedFeedbackThread.item_type} · {selectedFeedbackThread.feedback_type} · {selectedFeedbackThread.visibility} · {selectedFeedbackThread.rating ? `${selectedFeedbackThread.rating}/5` : "no rating"}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {selectedFeedbackThread.subscriber_priority ? <Badge className="bg-[#dcfce7] text-[#166534]">Subscriber priority</Badge> : null}
                              {selectedFeedbackThread.creator_curated ? <Badge variant="outline">Curated</Badge> : null}
                            </div>
                          </div>

                          {ownedCreators.some((artist) => artist.id === selectedFeedbackThread.artist_id) ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void handleCurateFeedback({ featured: !selectedFeedbackThread.featured, creatorCurated: true })}
                                disabled={busy === "feedbackCurate"}
                                className="rounded-full"
                              >
                                {selectedFeedbackThread.featured ? "Unfeature" : "Feature"}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void handleCurateFeedback({ visibility: selectedFeedbackThread.visibility === "public" ? "private" : "public", creatorCurated: true })}
                                disabled={busy === "feedbackCurate"}
                                className="rounded-full"
                              >
                                Make {selectedFeedbackThread.visibility === "public" ? "private" : "public"}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void handleCurateFeedback({ status: selectedFeedbackThread.status === "archived" ? "open" : "archived" })}
                                disabled={busy === "feedbackCurate"}
                                className="rounded-full"
                              >
                                {selectedFeedbackThread.status === "archived" ? "Reopen" : "Archive"}
                              </Button>
                            </div>
                          ) : null}
                        </div>

                        <div className="mt-3 max-h-[300px] space-y-3 overflow-y-auto pr-1">
                          {feedbackLoading ? (
                            <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                          ) : feedbackMessages.length === 0 ? (
                            <p className="py-10 text-center text-sm text-muted-foreground">No messages yet.</p>
                          ) : feedbackMessages.map((message) => {
                            const isOwn = message.sender_wallet.toLowerCase() === (address || "").toLowerCase();
                            return (
                              <div key={message.id} className={`rounded-2xl px-4 py-3 text-sm ${isOwn ? "ml-10 bg-[#1d4ed8] text-white" : "mr-10 bg-white text-foreground"}`}>
                                <p className="whitespace-pre-wrap leading-6">{message.body}</p>
                                <p className={`mt-2 text-[11px] ${isOwn ? "text-white/75" : "text-muted-foreground"}`}>{message.sender_role} · {formatRelativeDate(message.created_at)}</p>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-3 flex items-end gap-2">
                          <textarea value={feedbackDraft} onChange={(event) => setFeedbackDraft(event.target.value)} className="min-h-[84px] flex-1 rounded-2xl border border-border bg-white px-3 py-3 text-sm" placeholder="Reply to the collector, ask a follow-up, or thank them for the feedback..." />
                          <Button onClick={() => void handleSendFeedbackMessage()} disabled={busy === "feedbackMessage" || !feedbackDraft.trim()} className="h-11 rounded-full gradient-primary text-primary-foreground">{busy === "feedbackMessage" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
                        </div>
                      </>
                    ) : (
                      <div className="flex min-h-[280px] items-center justify-center text-center"><div><Star className="mx-auto h-8 w-8 text-primary/70" /><p className="mt-3 text-sm font-semibold text-foreground">Choose a feedback thread</p><p className="mt-1 text-xs text-muted-foreground">Verified product feedback from collectors and subscribers lives here.</p></div></div>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-[1.8rem] border border-white/80 bg-white/92 p-4 shadow-[0_30px_80px_rgba(37,99,235,0.08)]">
                <div className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-primary" /><p className="text-sm font-semibold text-foreground">Threads</p></div>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-[1.2rem] bg-[#f7fbff] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Broadcast to collectors or subscribers</p>
                    <select value={broadcastForm.artistId} onChange={(event) => setBroadcastForm((prev) => ({ ...prev, artistId: event.target.value }))} className="mt-3 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm">
                      <option value="">Select creator</option>
                      {ownedCreators.map((artist) => <option key={artist.id} value={artist.id}>{artist.name || artist.handle || "Untitled Creator"}</option>)}
                    </select>
                    <select value={broadcastForm.audience} onChange={(event) => setBroadcastForm((prev) => ({ ...prev, audience: event.target.value as typeof broadcastForm.audience }))} className="mt-3 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm">
                      <option value="subscribers">Subscribers</option>
                      <option value="collectors">Collectors</option>
                      <option value="all_fans">All fans</option>
                    </select>
                    <Input value={broadcastForm.subject} onChange={(event) => setBroadcastForm((prev) => ({ ...prev, subject: event.target.value }))} className="mt-3 h-10 rounded-xl bg-white" placeholder="Optional broadcast subject" />
                    <textarea value={broadcastForm.body} onChange={(event) => setBroadcastForm((prev) => ({ ...prev, body: event.target.value }))} className="mt-3 min-h-[100px] w-full rounded-xl border border-border bg-white px-3 py-3 text-sm" placeholder="Send a direct thread update to the chosen fan audience..." />
                    <Button onClick={() => void handleBroadcastThread()} disabled={busy === "broadcast"} className="mt-3 h-10 w-full rounded-xl gradient-primary text-primary-foreground">{busy === "broadcast" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send broadcast"}</Button>
                  </div>

                  <div className="rounded-[1.2rem] bg-[#f7fbff] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Start a thread</p>
                    <select value={threadForm.artistId} onChange={(event) => setThreadForm((prev) => ({ ...prev, artistId: event.target.value }))} className="mt-3 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm">
                      <option value="">Select creator</option>
                      {artistOptions.map((artist) => <option key={artist.artistId} value={artist.artistId}>{artist.label}</option>)}
                    </select>
                    {ownedCreators.some((artist) => artist.id === threadForm.artistId) ? <Input value={threadForm.fanWallet} onChange={(event) => setThreadForm((prev) => ({ ...prev, fanWallet: event.target.value }))} className="mt-3 h-10 rounded-xl bg-white" placeholder="Fan wallet address" /> : null}
                    <Input value={threadForm.subject} onChange={(event) => setThreadForm((prev) => ({ ...prev, subject: event.target.value }))} className="mt-3 h-10 rounded-xl bg-white" placeholder="Optional subject" />
                    <textarea value={threadForm.body} onChange={(event) => setThreadForm((prev) => ({ ...prev, body: event.target.value }))} className="mt-3 min-h-[100px] w-full rounded-xl border border-border bg-white px-3 py-3 text-sm" placeholder="Open the thread with context, gratitude, or a direct question." />
                    <Button onClick={() => void handleCreateThread()} disabled={busy === "thread"} className="mt-3 h-10 w-full rounded-xl gradient-primary text-primary-foreground">{busy === "thread" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Open thread"}</Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="space-y-2">
                    {threads.length === 0 ? <p className="rounded-[1.2rem] bg-[#f7fbff] px-4 py-5 text-sm text-muted-foreground">No direct threads yet.</p> : threads.map((thread) => (
                      <button key={thread.id} type="button" onClick={() => setSelectedThreadId(thread.id)} className={`w-full rounded-[1.2rem] px-3 py-3 text-left transition-colors ${selectedThreadId === thread.id ? "bg-[#dbeafe]" : "bg-[#f7fbff]"}`}>
                        <p className="truncate text-sm font-semibold text-foreground">{thread.artist?.name || thread.artist?.handle || "Creator thread"}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{thread.latest_message?.body || thread.subject || "Open conversation"}</p>
                        <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-primary/70">{formatRelativeDate(thread.last_message_at)}</p>
                      </button>
                    ))}
                  </div>

                  <div className="rounded-[1.2rem] bg-[#f7fbff] p-3">
                    {selectedThread ? (
                      <>
                        <div className="border-b border-border/60 pb-3">
                          <p className="text-sm font-semibold text-foreground">{selectedThread.artist?.name || selectedThread.artist?.handle || "Creator"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{selectedThread.subject || "Direct creator-fan thread"}</p>
                        </div>
                        <div className="mt-3 max-h-[360px] space-y-3 overflow-y-auto pr-1">
                          {threadLoading ? <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : threadMessages.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No messages yet.</p> : threadMessages.map((message) => {
                            const isOwn = message.sender_wallet.toLowerCase() === (address || "").toLowerCase();
                            return (
                              <div key={message.id} className={`rounded-2xl px-4 py-3 text-sm ${isOwn ? "ml-10 bg-[#1d4ed8] text-white" : "mr-10 bg-white text-foreground"}`}>
                                <p className="whitespace-pre-wrap leading-6">{message.body}</p>
                                <p className={`mt-2 text-[11px] ${isOwn ? "text-white/75" : "text-muted-foreground"}`}>{message.sender_role} · {formatRelativeDate(message.created_at)}</p>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-3 flex items-end gap-2">
                          <textarea value={threadDraft} onChange={(event) => setThreadDraft(event.target.value)} className="min-h-[84px] flex-1 rounded-2xl border border-border bg-white px-3 py-3 text-sm" placeholder="Reply to keep the relationship warm..." />
                          <Button onClick={() => void handleSendMessage()} disabled={busy === "message" || !threadDraft.trim()} className="h-11 rounded-full gradient-primary text-primary-foreground">{busy === "message" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
                        </div>
                      </>
                    ) : (
                      <div className="flex min-h-[320px] items-center justify-center text-center"><div><MessageSquare className="mx-auto h-8 w-8 text-primary/70" /><p className="mt-3 text-sm font-semibold text-foreground">Choose a thread</p><p className="mt-1 text-xs text-muted-foreground">Open an existing conversation or start a new one above.</p></div></div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default InboxPage;
