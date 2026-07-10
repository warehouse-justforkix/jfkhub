// Sends a web-push notification to the recipient's devices when a chat
// message is inserted (triggered by a database trigger via pg_net).
// Staff → admin messages notify every admin device; admin → staff messages
// notify that member's devices. Dead subscriptions are pruned automatically.
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

Deno.serve(async (req) => {
  if (req.headers.get("x-push-secret") !== Deno.env.get("PUSH_TRIGGER_SECRET")) {
    return new Response("unauthorized", { status: 401 });
  }
  const payload = await req.json();
  const m = payload.record ?? payload;

  let recipientIds: string[] = [];
  if (m.from_admin) {
    recipientIds = [m.member_id];
  } else {
    const { data } = await supabase.from("profiles").select("id").eq("is_admin", true);
    recipientIds = (data ?? []).map((r: { id: string }) => r.id);
  }
  if (!recipientIds.length) return new Response("no recipients");

  const { data: subs, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("id, subscription")
    .in("profile_id", recipientIds);
  if (subsError) return new Response(JSON.stringify({ subsError: subsError.message, recipientIds }), { status: 500 });

  const body = JSON.stringify({
    title: `New message from ${m.sender_name}`,
    body: String(m.body ?? "").slice(0, 140),
    url: "https://warehouse-justforkix.github.io/jfkhub/#messages",
  });

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
