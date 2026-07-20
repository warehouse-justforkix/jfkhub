// Sends web-push notifications, triggered by pg_net database triggers:
//  - messages:      staff → all admin devices; admin → that member's devices
//  - announcements: notifies admins (unless an admin posted it)
//  - tasks:         notifies admins, PLUS any teammate on that task's team who
//                   opted in via "notify_new_tasks" on their profile (unless
//                   an admin posted it; auto re-posts from recurring tasks are
//                   skipped — they have no created_by)
// Dead subscriptions are pruned automatically.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

webpush.setVapidDetails(
  "mailto:karley@justforkix.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!
);

const SITE = "https://warehouse-justforkix.github.io/jfkhub/";

Deno.serve(async (req) => {
  if (req.headers.get("x-push-secret") !== Deno.env.get("PUSH_TRIGGER_SECRET")) {
    return new Response("unauthorized", { status: 401 });
  }
  const payload = await req.json();
  const table = payload.table ?? "messages";
  const m = payload.record ?? payload;

  const { data: adminRows, error: adminErr } = await supabase
    .from("profiles")
    .select("id, name")
    .eq("is_admin", true);
  if (adminErr) return new Response(JSON.stringify({ adminErr: adminErr.message }), { status: 500 });
  const admins = adminRows ?? [];

  let recipientIds: string[] = [];
  let title = "";
  let text = "";
  let url = SITE;

  if (table === "messages") {
    recipientIds = m.from_admin ? [m.member_id] : admins.map((a) => a.id);
    title = `New message from ${m.sender_name}`;
    text = String(m.body ?? "").slice(0, 140);
    url += "#messages";
  } else if (table === "announcements") {
    recipientIds = admins.filter((a) => a.id !== m.author_id).map((a) => a.id);
    title = `New announcement from ${m.author_name}`;
    text = String(m.body ?? "").slice(0, 140);
    url += "#announcements";
  } else if (table === "tasks") {
    if (!m.created_by) return new Response("auto repost — skipped");
    const adminIds = admins.filter((a) => a.name !== m.created_by).map((a) => a.id);

    const { data: optedIn, error: optErr } = await supabase
      .from("profiles")
      .select("id, name")
      .eq("notify_new_tasks", true)
      .eq(m.team === "support" ? "support_access" : "warehouse_access", true);
    if (optErr) return new Response(JSON.stringify({ optErr: optErr.message }), { status: 500 });

    const optedInIds = (optedIn ?? []).filter((p) => p.name !== m.created_by).map((p) => p.id);
    recipientIds = [...new Set([...adminIds, ...optedInIds])];
    title = `New task from ${m.created_by}`;
    text = String(m.title ?? "").slice(0, 140);
    url += "#tasks";
  } else {
    return new Response("unknown table — skipped");
  }

  if (!recipientIds.length) return new Response("no recipients");

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, subscription")
    .in("profile_id", recipientIds);

  const body = JSON.stringify({ title, body: text, url });

  let sent = 0;
  const errors: string[] = [];
  await Promise.all(
    (subs ?? []).map(async (s: { id: string; subscription: object }) => {
      try {
        await webpush.sendNotification(s.subscription, body);
        sent++;
      } catch (e) {
        const err = e as { statusCode?: number; body?: string; message?: string };
        errors.push(`${err.statusCode ?? "?"}: ${(err.body || err.message || "").slice(0, 200)}`);
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", s.id);
        }
      }
    })
  );
  return new Response(JSON.stringify({ sent, errors }));
});
