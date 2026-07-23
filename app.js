import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createAvatar } from "https://esm.sh/@dicebear/core@9";
import { avataaars } from "https://esm.sh/@dicebear/collection@9";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DAYS = ["mon", "tue", "wed", "thu", "fri"];
const $ = (id) => document.getElementById(id);

const els = {
  // views
  authView: $("auth-view"),
  profileView: $("profile-view"),
  gateView: $("gate-view"),
  appView: $("app-view"),
  siteNav: $("site-nav"),
  navAdmin: $("nav-admin"),
  userChip: $("user-chip"),
  userName: $("user-name"),
  // auth
  authForm: $("auth-form"),
  authEmail: $("auth-email"),
  authPassword: $("auth-password"),
  btnSignup: $("btn-signup"),
  btnForgot: $("btn-forgot"),
  authStatus: $("auth-status"),
  signOut: $("sign-out"),
  gateMsg: $("gate-msg"),
  gateSignout: $("gate-signout"),
  // profile form
  profileView: $("profile-view"),
  profileTitle: $("profile-title"),
  profileForm: $("profile-form"),
  pfName: $("pf-name"),
  pfRole: $("pf-role"),
  pfAvatar: $("pf-avatar"),
  pfReminders: $("pf-reminders"),
  pfNotifyTasks: $("pf-notify-tasks"),
  profileStatus: $("profile-status"),
  profileBack: $("profile-back"),
  editProfile: $("edit-profile"),
  userAvatar: $("user-avatar"),
  remindersBanner: $("reminders"),
  msgBadge: $("msg-badge"),
  // time clock
  clockState: $("clock-state"),
  punchButtons: document.querySelectorAll(".punch"),
  undoPunch: $("undo-punch"),
  myPunches: $("my-punches"),
  punchAdmin: $("punch-admin"),
  punchDate: $("punch-date"),
  punchList: $("punch-list"),
  punchFixHint: $("punch-fix-hint"),
  myPunchReqs: $("my-punch-reqs"),
  punchReqs: $("punch-reqs"),
  punchReqList: $("punch-req-list"),
  // announcements
  annForm: $("ann-form"),
  annBody: $("ann-body"),
  annStatus: $("ann-status"),
  annList: $("ann-list"),
  // schedules
  schedulesTitle: $("schedules-title"),
  schedulesHint: $("schedules-hint"),
  tableBody: document.querySelector("#schedule-table tbody"),
  editToggle: $("edit-toggle"),
  editActions: $("edit-actions"),
  saveSchedules: $("save-schedules"),
  cancelEdit: $("cancel-edit"),
  // calendar + notes
  calTitle: $("cal-title"),
  calGrid: $("cal-grid"),
  calPrev: $("cal-prev"),
  calNext: $("cal-next"),
  form: $("note-form"),
  nfVisField: $("nf-vis-field"),
  nfVis: $("nf-vis"),
  postingAs: $("posting-as"),
  nfType: $("nf-type"),
  nfStart: $("nf-start"),
  nfEnd: $("nf-end"),
  nfTime: $("nf-time"),
  nfDetails: $("nf-details"),
  formStatus: $("form-status"),
  notesList: $("notes-list"),
  showPast: $("show-past"),
  todayCallout: $("today-callout"),
  // tasks
  taskForm: $("task-form"),
  tfTitle: $("tf-title"),
  tfDue: $("tf-due"),
  tfRecurrence: $("tf-recurrence"),
  tfAssign: $("tf-assign"),
  tfDetails: $("tf-details"),
  taskStatus: $("task-status"),
  colOpen: $("col-open"),
  colClaimed: $("col-claimed"),
  colDone: $("col-done"),
  countOpen: $("count-open"),
  countClaimed: $("count-claimed"),
  // messages
  msgTitle: $("msg-title"),
  msgHint: $("msg-hint"),
  msgRefresh: $("msg-refresh"),
  roster: $("roster"),
  threadWith: $("thread-with"),
  msgThread: $("msg-thread"),
  msgForm: $("msg-form"),
  msgBody: $("msg-body"),
  msgStatus: $("msg-status"),
  // checklists
  clAdminForm: $("cl-admin-form"),
  clLabel: $("cl-label"),
  clCadence: $("cl-cadence"),
  clTeam: $("cl-team"),
  clAdd: $("cl-add"),
  clStatus: $("cl-status"),
  clDaily: $("cl-daily"),
  clWeekly: $("cl-weekly"),
  // admin
  adminSection: $("admin"),
  inviteForm: $("invite-form"),
  invEmail: $("inv-email"),
  invTeam: $("inv-team"),
  inviteStatus: $("invite-status"),
  inviteList: $("invite-list"),
  memberList: $("member-list"),
};

// ---------- feature flags ----------
// Time Clock is OFF for now (punch buttons, Who's In, pending punch changes,
// Hours This Week, and clock-in/out reminders). All the code and data stay in
// place — set this to true to bring the whole thing back.
// See archive/README-time-clock.md for details.
const FEATURE_TIME_CLOCK = false;

let session = null;
let myProfile = null;
let staff = [];        // all profiles (names/roles — no hours)
let hoursById = {};    // member_hours visible to me (mine, or everyone's if admin)
let notes = [];
let tasks = [];
let invites = [];
let punches = [];      // punches visible to me for the selected day
let punchRequests = []; // punch-fix requests (mine, or all if admin)
let messages = [];
let editing = false;
let calMonth = null;   // Date, first of displayed month
let curTeam = "warehouse";
let curHub = localStorage.getItem("jfk-hub") === "support" ? "support" : "warehouse";

// Members belonging to the currently selected hub.
function hubMembers() {
  return curHub === "support"
    ? staff.filter((p) => p.support_access || p.is_admin)
    : staff.filter((p) => p.warehouse_access !== false || p.is_admin);
}

function setHub(hub) {
  curHub = hub;
  localStorage.setItem("jfk-hub", hub);
  $("hub-title").textContent = hub === "support" ? "Customer Support Hub" : "Warehouse Hub";
  $("tasks-title").textContent = hub === "support" ? "Support Task Board" : "Warehouse Task Board";
  document.querySelectorAll("#hub-toggle button").forEach((b) =>
    b.classList.toggle("active", b.dataset.hub === hub)
  );
  els.clTeam.value = hub;
  // Restocking is a warehouse-floor feature
  $("restocking").classList.toggle("hub-hidden", hub === "support");
  $("nav-restocking").classList.toggle("hub-hidden", hub === "support");
  setTeam(hub);          // task board follows the hub
  renderSchedules();
  renderPunchTable();
  renderHoursTable();
  renderChecklists();
  // calendar shows only the current hub's people
  renderCalendar();
  renderNotes();
  renderTodayCallout();
}

$("hub-toggle").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-hub]");
  if (btn) setHub(btn.dataset.hub);
});

// ---------- helpers ----------

function todayStr() {
  return dateToStr(new Date());
}

function dateToStr(d) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function fmtDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function esc(s) {
  const div = document.createElement("div");
  div.textContent = s ?? "";
  return div.innerHTML;
}

function setStatus(el, msg, isError = false) {
  el.textContent = msg;
  el.classList.toggle("error", isError);
}

// ---------- avatars (emoji or built character) ----------

const CB_OPTIONS = {
  skinColor: [["ffdbb4", "Light"], ["edb98a", "Medium light"], ["d08b5b", "Tan"], ["ae5d29", "Brown"], ["614335", "Deep"]],
  top: [
    ["straight01", "Long straight"], ["curvy", "Long curly"], ["bob", "Bob"],
    ["bun", "Bun / ponytail"], ["shortFlat", "Short straight"], ["shortCurly", "Short curly"],
    ["theCaesar", "Short men's cut"],
  ],
  hairColor: [["2c1b18", "Black"], ["724133", "Brown"], ["d6b370", "Blonde"], ["c93305", "Red"], ["e8e1e1", "Gray"]],
  eyeColor: [["5C3317", "Brown"], ["3B7AD9", "Blue"], ["3D8A5A", "Green"], ["8E6B23", "Hazel"], ["6E7B8B", "Gray"]],
  clothing: [["shirtCrewNeck", "T-shirt"], ["shirtVNeck", "V-neck"], ["hoodie", "Hoodie"], ["blazerAndShirt", "Blazer"]],
  clothesColor: [["ff488e", "JFK pink"], ["65c9ff", "Sky blue"], ["25557c", "Navy"], ["ff5c5c", "Red"], ["a7ffc4", "Mint"], ["929598", "Gray"], ["e6e6e6", "White"], ["262e33", "Black"]],
};

const charCache = new Map();

function characterUri(opts) {
  const key = JSON.stringify(opts);
  if (!charCache.has(key)) {
    let svg = createAvatar(avataaars, {
      seed: "jfk",
      skinColor: [opts.skinColor],
      top: [opts.top],
      hairColor: [opts.hairColor],
      eyes: ["squint"],
      eyebrows: ["defaultNatural"],
      mouth: ["smile"],
      clothing: [opts.clothing || "shirtCrewNeck"],
      clothesColor: [opts.clothesColor],
      accessoriesProbability: 0,
      facialHairProbability: 0,
      backgroundColor: ["ffd6ea"],
      radius: 50,
    }).toString();
    // Recolor the irises (the "squint" eyes draw white eyeballs plus two
    // fixed-geometry pupil paths we can safely recolor), then add upper
    // eyelid lines for dimension.
    if (opts.eyeColor) {
      svg = svg.replace(
        /(<path d="M32\.82 28\.3[^"]*") fill="#000"( fill-opacity="[^"]*")?/,
        `$1 fill="#${opts.eyeColor}" fill-opacity=".9"`
      );
    }
    const lids =
      '<path d="M16 20c4.5-8 23.5-8 28 0" stroke="#4a3728" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
      '<path d="M68 20c4.5-8 23.5-8 28 0" stroke="#4a3728" stroke-width="2.6" fill="none" stroke-linecap="round"/>';
    svg = svg.replace(/(<path d="M32\.82 28\.3[^>]*\/>)/, `$1${lids}`);
    charCache.set(key, "data:image/svg+xml;utf8," + encodeURIComponent(svg));
  }
  return charCache.get(key);
}

function avatarHtml(p) {
  if (p?.avatar_options?.style === "image" && p.avatar_options.url) {
    return `<span class="avatar-wrap"><img class="avatar-img avatar-photo" src="${esc(p.avatar_options.url)}" alt=""></span>`;
  }
  if (p?.avatar_options && p.avatar_options.style !== "image") {
    return `<span class="avatar-wrap"><img class="avatar-img" src="${characterUri(p.avatar_options)}" alt=""></span>`;
  }
  return `<span class="name-avatar">${esc(p?.avatar || "🙂")}</span>`;
}

function nameWithAvatar(name) {
  const p = staff.find((s) => s.name === name);
  return avatarHtml(p) + esc(name);
}

function cbValues() {
  const out = {};
  Object.keys(CB_OPTIONS).forEach((k) => (out[k] = $(`cb-${k}`).value));
  return out;
}

function cbSet(opts) {
  Object.keys(CB_OPTIONS).forEach((k) => {
    if (opts && opts[k]) $(`cb-${k}`).value = opts[k];
  });
}

function cbPreview() {
  $("cb-preview").src = characterUri(cbValues());
}

function avatarMode() {
  if ($("mode-image").checked) return "image";
  if ($("mode-character").checked) return "character";
  return "emoji";
}

function setAvatarMode(mode) {
  $("mode-character").checked = mode === "character";
  $("mode-image").checked = mode === "image";
  $("mode-emoji").checked = mode === "emoji";
  $("character-builder").classList.toggle("hidden", mode !== "character");
  $("image-chooser").classList.toggle("hidden", mode !== "image");
  $("emoji-chooser").classList.toggle("hidden", mode !== "emoji");
  if (mode === "character") cbPreview();
  if (mode === "image") {
    const existing = myProfile?.avatar_options?.style === "image" ? myProfile.avatar_options.url : null;
    $("img-preview").classList.toggle("hidden", !existing && !$("pf-image").files[0]);
    if (existing && !$("pf-image").files[0]) $("img-preview").src = existing;
  }
}

// populate builder selects once
Object.entries(CB_OPTIONS).forEach(([k, opts]) => {
  $(`cb-${k}`).innerHTML = opts
    .map(([v, label]) => `<option value="${v}">${label}</option>`)
    .join("");
  $(`cb-${k}`).addEventListener("change", cbPreview);
});
$("mode-emoji").addEventListener("change", () => setAvatarMode("emoji"));
$("mode-character").addEventListener("change", () => setAvatarMode("character"));
$("mode-image").addEventListener("change", () => setAvatarMode("image"));

$("pf-image").addEventListener("change", () => {
  const file = $("pf-image").files[0];
  if (file) {
    $("img-preview").src = URL.createObjectURL(file);
    $("img-preview").classList.remove("hidden");
  }
});

// Downscales the chosen picture to a small square and stores it inline on the
// profile — no external storage needed at this team size.
async function uploadAvatarImage() {
  const file = $("pf-image").files[0];
  if (!file) {
    // keep existing uploaded image if there is one
    return myProfile?.avatar_options?.style === "image" ? myProfile.avatar_options : null;
  }
  if (file.size > 8 * 1024 * 1024) throw new Error("Image is over 8 MB — pick a smaller one.");
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("That file doesn't look like an image.");
  const SIZE = 128;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  // center-crop to square
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, SIZE, SIZE);
  const url = canvas.toDataURL("image/png");
  return { style: "image", url };
}

// ---------- auth & routing ----------

function showView(view) {
  [els.authView, els.profileView, els.gateView, els.appView].forEach((v) =>
    v.classList.toggle("hidden", v !== view)
  );
  els.userChip.classList.toggle("hidden", !session);
  els.siteNav.classList.toggle("hidden", view !== els.appView);
  $("admin-quick").classList.toggle("hidden", view !== els.appView);
}

async function route() {
  const { data } = await supabase.auth.getSession();
  session = data.session;

  if (!session) {
    myProfile = null;
    showView(els.authView);
    return;
  }

  els.userName.textContent = session.user.email;

  const { data: prof, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error) {
    setStatus(els.authStatus, `Something went wrong: ${error.message}`, true);
    showView(els.authView);
    return;
  }

  if (prof) {
    myProfile = prof;
    els.userName.textContent = prof.name;
    els.userAvatar.innerHTML = avatarHtml(prof);
    els.postingAs.textContent = prof.name;
    const admin = prof.is_admin;
    els.editToggle.textContent = admin ? "Edit schedules" : "Edit my hours";
    els.schedulesTitle.textContent = "Team Schedules";
    els.schedulesHint.textContent = admin
      ? "Everyone's current weekly hours."
      : "Everyone's current weekly hours. You can edit your own row.";
    els.navAdmin.classList.toggle("hidden", !admin);
    els.adminSection.classList.toggle("hidden", !admin);
    els.nfVisField.classList.toggle("hidden", !admin);
    els.punchAdmin.classList.remove("hidden"); // everyone sees who's in
    els.punchFixHint.classList.toggle("hidden", admin);
    if (!admin) els.punchReqs.classList.add("hidden"); // shown by renderPunchRequests when pending exist
    els.msgTitle.textContent = admin ? "Team & Chats" : "Message Karley";
    $("chip-msg-label").textContent = admin ? "Admin Messages" : "Message Karley";
    els.msgHint.textContent = admin
      ? "Your team — tap a person to open their private chat."
      : "Private message Karley (admin) - only you and her can see this thread.";
    els.roster.classList.toggle("hidden", !admin);
    els.msgThread.classList.toggle("hidden", admin);
    els.msgForm.classList.toggle("hidden", admin);
    els.clAdminForm.classList.toggle("hidden", !admin);
    const bothTeams = prof.support_access && prof.warehouse_access !== false;
    $("hub-toggle").classList.toggle("hidden", !(admin || bothTeams));
    $("team-indicator").classList.toggle("hidden", admin || bothTeams);
    if (!admin && !bothTeams) {
      curHub = prof.support_access ? "support" : "warehouse";
      $("team-indicator-label").textContent = prof.support_access ? "🎧 Customer Support" : "📦 Warehouse";
    }
    $("hours-card").classList.toggle("hidden", !admin || !FEATURE_TIME_CLOCK);
    $("clock").classList.toggle("hidden", !FEATURE_TIME_CLOCK);
    $("nav-clock").classList.toggle("hidden", !FEATURE_TIME_CLOCK);
    showView(els.appView);
    await loadEverything();
    setHub(curHub);
    maybeAskNotifications();
    // (re)register this device for push if permission is already granted,
    // then show the "Turn On Notifications" banner if it still isn't set up
    enablePush().then(() => updateNotifBanner());
    checkShiftReminders();
    return;
  }

  // Signed in, no profile yet — are they invited?
  const email = (session.user.email || "").toLowerCase();
  const { data: inv } = await supabase
    .from("invited_emails")
    .select("email")
    .eq("email", email);

  if (inv && inv.length) {
    showView(els.profileView);
  } else {
    els.gateMsg.textContent =
      "Your account is created, but this email isn't on the team list yet. " +
      "Ask an admin to add " + (session.user.email || "your email") + ", then sign back in.";
    showView(els.gateView);
  }
}

supabase.auth.onAuthStateChange(async (event) => {
  if (event === "PASSWORD_RECOVERY") {
    const np = prompt("Choose a new password (8+ characters):");
    if (np) {
      const { error } = await supabase.auth.updateUser({ password: np });
      alert(error ? `Couldn't set it: ${error.message}` : "Password updated — you're signed in.");
    }
  }
  if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "INITIAL_SESSION") {
    route();
  }
});

els.authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setStatus(els.authStatus, "Signing in…");
  const { error } = await supabase.auth.signInWithPassword({
    email: els.authEmail.value.trim(),
    password: els.authPassword.value,
  });
  if (error) setStatus(els.authStatus, error.message, true);
  else setStatus(els.authStatus, "");
});

els.btnSignup.addEventListener("click", async () => {
  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;
  if (!email || password.length < 8) {
    setStatus(els.authStatus, "Enter your email and a password of at least 8 characters, then hit Create account.", true);
    return;
  }
  setStatus(els.authStatus, "Creating your account…");
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    setStatus(els.authStatus, error.message, true);
    return;
  }
  if (!data.session) {
    setStatus(els.authStatus, "Almost done — check your email to confirm your account, then sign in here.");
  }
  // If email confirmation is disabled, SIGNED_IN fires and route() takes over.
});

els.btnForgot.addEventListener("click", async () => {
  const email = els.authEmail.value.trim();
  if (!email) {
    setStatus(els.authStatus, "Type your email above first, then hit Forgot password.", true);
    return;
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  setStatus(els.authStatus, error ? error.message : "Reset link sent — check your email.", !!error);
});

els.signOut.addEventListener("click", () => supabase.auth.signOut());
els.gateSignout.addEventListener("click", () => supabase.auth.signOut());

// ---------- profile creation & editing ----------

els.avatarPicksWired = $("avatar-picks").addEventListener("click", (e) => {
  if (e.target.tagName === "BUTTON") {
    e.preventDefault();
    els.pfAvatar.value = e.target.textContent;
  }
});

els.editProfile.addEventListener("click", () => {
  if (!myProfile) return;
  els.profileTitle.textContent = "Edit your profile";
  els.pfName.value = myProfile.name;
  els.pfRole.value = myProfile.role;
  els.pfAvatar.value = myProfile.avatar || "🙂";
  const opts = myProfile.avatar_options;
  if (opts && opts.style !== "image") cbSet(opts);
  setAvatarMode(opts?.style === "image" ? "image" : opts ? "character" : "emoji");
  els.pfReminders.checked = !!myProfile.reminders;
  els.pfNotifyTasks.checked = !!myProfile.notify_new_tasks;
  const hours = hoursById[myProfile.id] || {};
  DAYS.forEach((d) => ($(`pf-${d}`).value = hours[d] || ""));
  // off-schedule members (view/add-only) don't fill in weekly hours
  $("pf-mon").closest("fieldset").classList.toggle("hidden", myProfile.on_schedule === false);
  els.profileBack.classList.remove("hidden");
  showView(els.profileView);
});

els.profileBack.addEventListener("click", () => {
  els.profileBack.classList.add("hidden");
  route();
});

els.profileForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setStatus(els.profileStatus, "Saving…");

  const mode = avatarMode();
  let avatarOptions = null;
  try {
    if (mode === "character") avatarOptions = cbValues();
    else if (mode === "image") {
      avatarOptions = await uploadAvatarImage();
      if (!avatarOptions) {
        setStatus(els.profileStatus, "Pick an image file first (or choose Emoji / Build a character).", true);
        return;
      }
    }
  } catch (err) {
    setStatus(els.profileStatus, `Image upload failed: ${err.message}`, true);
    return;
  }
  const fields = {
    name: els.pfName.value.trim().split(/\s+/)[0], // first name only
    role: els.pfRole.value,
    avatar: els.pfAvatar.value.trim() || "🙂",
    avatar_options: avatarOptions,
    reminders: els.pfReminders.checked,
    notify_new_tasks: els.pfNotifyTasks.checked,
  };

  const { error } = myProfile
    ? await supabase.from("profiles").update(fields).eq("id", myProfile.id)
    : await supabase.from("profiles").insert({
        id: session.user.id,
        email: (session.user.email || "").toLowerCase(),
        ...fields,
      });
  if (error) {
    setStatus(els.profileStatus, `Couldn't save: ${error.message}`, true);
    return;
  }

  const hours = {};
  DAYS.forEach((d) => (hours[d] = $(`pf-${d}`).value.trim()));
  const { error: hErr } = await supabase
    .from("member_hours")
    .upsert({ profile_id: session.user.id, hours });
  if (hErr) {
    setStatus(els.profileStatus, `Profile saved, but hours didn't: ${hErr.message}`, true);
  }
  setStatus(els.profileStatus, "");
  els.profileForm.reset();
  els.profileBack.classList.add("hidden");
  els.profileTitle.textContent = "Create your profile";
  route();
});

// ---------- load everything ----------

async function loadEverything() {
  await loadStaff();
  await Promise.all([
    loadHours(),
    loadNotes(),
    loadTasks(),
    ...(FEATURE_TIME_CLOCK ? [loadPunches(), loadPunchRequests(), loadWeekPunches()] : []),
    loadAnnouncements(),
    loadMessages(),
    loadChecklists(),
    loadSupplies(),
    loadRestock(),
    loadWarnings(),
    loadAdmin(),
    loadPersonalNotes(),
  ]);
}

// ---------- restocking list ----------

let restock = [];
let restockComments = [];

async function loadRestock() {
  const [itemsRes, commentsRes] = await Promise.all([
    supabase.from("restock_items").select("*").order("created_at", { ascending: false }),
    supabase.from("restock_comments").select("*").order("created_at", { ascending: true }),
  ]);
  if (itemsRes.error) {
    $("rs-open").innerHTML = `<li class="empty">Couldn't load: ${esc(itemsRes.error.message)}</li>`;
    return;
  }
  restock = itemsRes.data;
  restockComments = commentsRes.data || [];
  renderRestock();
}

function restockLine(r) {
  const mine = r.assigned_to === myProfile.name;
  const assignSel = `<select class="team-select" data-rs-assign="${r.id}" title="Assign this item">
        <option value="">Assign to…</option>
        ${staff
          .filter((p) => p.warehouse_access !== false || p.is_admin)
          .map((p) => `<option value="${esc(p.name)}" ${r.assigned_to === p.name ? "selected" : ""}>${esc(p.name)}</option>`)
          .join("")}
      </select>`;
  const buttons =
    r.status === "open"
      ? [
          !r.assigned_to ? `<button class="btn-mini primary" data-rs-claim="${r.id}">I'll do it</button>` : "",
          mine ? `<button class="btn-mini" data-rs-unclaim="${r.id}">Unclaim</button>` : "",
          assignSel,
          `<button class="btn-mini ${r.assigned_to ? "primary" : ""}" data-rs-done="${r.id}">Done ✓</button>`,
        ].filter(Boolean).join("")
      : `<button class="btn-mini" data-rs-reopen="${r.id}">Reopen</button>`;

  const comments = restockComments.filter((c) => c.restock_item_id === r.id);
  const commentRows = comments
    .map(
      (c) => `<li class="rs-comment">
        <span class="rs-comment-body">${esc(c.body)}</span>
        <span class="cl-by">${esc(c.author_name)} · ${fmtTime(c.created_at)} ${new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
        ${c.author_name === myProfile.name || myProfile.is_admin ? `<button class="note-delete" data-rs-comment-del="${c.id}" title="Delete comment">✕</button>` : ""}
      </li>`
    )
    .join("");

  return `<li class="cl-item rs-line ${r.status === "done" ? "done" : ""}">
    <div class="rs-line-top">
      <span class="cl-label" style="flex:1;text-align:left"><b>${esc(r.item)}</b>${r.note ? ` — ${esc(r.note)}` : ""}
        <span class="cl-by" style="color:var(--ink-soft)">· ${esc(r.requested_by)}</span>
        ${r.assigned_to ? `<span class="task-owner">${nameWithAvatar(r.assigned_to)}</span>` : ""}
        ${photoThumb(r.photo, true)}</span>
      ${buttons}
      <button class="note-delete" data-rs-del="${r.id}" title="Remove">✕</button>
    </div>
    <details class="rs-comments-acc" data-rsid="${r.id}">
      <summary>💬 Comments <span class="cl-by">${comments.length ? `(${comments.length})` : ""}</span></summary>
      <div class="rs-comments-body">
        <ul class="rs-comment-list">${commentRows || `<li class="empty">No comments yet.</li>`}</ul>
        <form class="rs-comment-form" data-rsid="${r.id}">
          <input type="text" maxlength="500" required placeholder="Add a comment…">
          <button class="btn-mini primary" type="submit">Post</button>
        </form>
      </div>
    </details>
  </li>`;
}

function renderRestock() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const unclaimed = restock.filter((r) => r.status === "open" && !r.assigned_to);
  const claimed = restock.filter((r) => r.status === "open" && r.assigned_to);
  const done = restock.filter((r) => r.status === "done" && (r.completed_at || "") >= weekAgo);

  // preserve which comment threads are open (and any draft being typed) across re-renders
  const board = $("restocking");
  const openIds = new Set([...board.querySelectorAll(".rs-comments-acc[open]")].map((d) => d.dataset.rsid));
  const drafts = {};
  board.querySelectorAll(".rs-comment-form input").forEach((inp) => {
    if (inp.value) drafts[inp.closest("form").dataset.rsid] = inp.value;
  });

  $("rs-open").innerHTML = unclaimed.length ? unclaimed.map(restockLine).join("") : `<li class="empty">Nothing waiting to be restocked. 🎉</li>`;
  $("rs-claimed").innerHTML = claimed.length ? claimed.map(restockLine).join("") : `<li class="empty">Nothing claimed right now.</li>`;
  $("rs-done").innerHTML = done.length ? done.map(restockLine).join("") : `<li class="empty">Nothing restocked this week yet.</li>`;
  $("rs-count").textContent = unclaimed.length ? `(${unclaimed.length})` : "";
  $("rs-count-claimed").textContent = claimed.length ? `(${claimed.length})` : "";

  openIds.forEach((id) => {
    const d = board.querySelector(`.rs-comments-acc[data-rsid="${id}"]`);
    if (d) d.open = true;
  });
  Object.entries(drafts).forEach(([id, val]) => {
    const inp = board.querySelector(`.rs-comment-form[data-rsid="${id}"] input`);
    if (inp) inp.value = val;
  });
}

$("restocking").addEventListener("submit", async (e) => {
  const form = e.target.closest(".rs-comment-form");
  if (!form) return;
  e.preventDefault();
  const input = form.querySelector("input");
  const body = input.value.trim();
  if (!body) return;
  const { error } = await supabase.from("restock_comments").insert({
    restock_item_id: form.dataset.rsid,
    author_name: myProfile.name,
    body,
  });
  if (error) {
    alert(`Couldn't post comment: ${error.message}`);
    return;
  }
  await loadRestock();
});

$("rs-add").addEventListener("click", async () => {
  const item = $("rs-item").value.trim();
  if (!item) return;
  const { error } = await supabase.from("restock_items").insert({
    item,
    note: $("rs-note").value.trim() || null,
    requested_by: myProfile.name,
    photo: rsPhoto.uri,
  });
  if (error) {
    setStatus($("rs-status"), `Couldn't add: ${error.message}`, true);
    return;
  }
  $("rs-item").value = "";
  $("rs-note").value = "";
  rsPhoto.clear();
  setStatus($("rs-status"), "Added to the restock list! ✔");
  await loadRestock();
});

$("restocking").addEventListener("click", async (e) => {
  const act = (attr) => e.target.closest(`button[${attr}]`)?.getAttribute(attr);
  const claim = act("data-rs-claim");
  const unclaim = act("data-rs-unclaim");
  const done = act("data-rs-done");
  const reopen = act("data-rs-reopen");
  const del = act("data-rs-del");
  const commentDel = act("data-rs-comment-del");
  if (claim) await supabase.from("restock_items").update({ assigned_to: myProfile.name }).eq("id", claim);
  else if (unclaim) await supabase.from("restock_items").update({ assigned_to: null }).eq("id", unclaim);
  else if (done) await supabase.from("restock_items").update({ status: "done", assigned_to: myProfile.name, completed_at: new Date().toISOString() }).eq("id", done);
  else if (reopen) await supabase.from("restock_items").update({ status: "open", completed_at: null }).eq("id", reopen);
  else if (del) {
    if (!confirm("Remove this restock item?")) return;
    await supabase.from("restock_items").delete().eq("id", del);
  } else if (commentDel) {
    if (!confirm("Delete this comment?")) return;
    await supabase.from("restock_comments").delete().eq("id", commentDel);
  } else return;
  await loadRestock();
});

// anyone reassigns an open restock item to a teammate from its dropdown
$("restocking").addEventListener("change", async (e) => {
  const sel = e.target.closest("select[data-rs-assign]");
  if (!sel) return;
  const { error } = await supabase
    .from("restock_items")
    .update({ assigned_to: sel.value || null })
    .eq("id", sel.dataset.rsAssign);
  if (error) alert(`Couldn't assign: ${error.message}`);
  await loadRestock();
});

// ---------- warnings (private: the member + admins only) ----------

let warnings = [];

async function loadWarnings() {
  const { data, error } = await supabase
    .from("warnings")
    .select("*")
    .order("incident_date", { ascending: false });
  if (error) {
    $("warn-list").innerHTML = `<li class="empty">Couldn't load warnings: ${esc(error.message)}</li>`;
    return;
  }
  warnings = data;
  renderWarnings();
}

function renderWarnings() {
  const admin = myProfile.is_admin;
  $("warn-admin-form").classList.toggle("hidden", !admin);
  if (admin) {
    const members = staff.filter((p) => !p.is_admin);
    $("warn-member").innerHTML = members.length
      ? members.map((p) => `<option value="${p.id}">${esc(p.avatar || "🙂")} ${esc(p.name)}</option>`).join("")
      : `<option value="">No members yet</option>`;
  }

  const mine = admin ? warnings : warnings.filter((w) => w.profile_id === myProfile.id);
  if (!mine.length) {
    $("warn-list").innerHTML = `<li class="empty">${admin ? "No warnings on record." : "You have no warnings — keep it up! 🎉"}</li>`;
    return;
  }
  $("warn-list").innerHTML = mine
    .map((w) => {
      const person = staff.find((p) => p.id === w.profile_id);
      return `<li class="cl-item warn-item">
        <span class="cl-label" style="flex:1">⚠ <b>${fmtDate(w.incident_date)}</b>
          ${admin && person ? `— ${nameWithAvatar(person.name)}` : ""}
          — ${esc(w.reason)}
          <span class="cl-by" style="color:var(--ink-soft)">· logged by ${esc(w.created_by)}</span></span>
        ${admin ? `<button class="note-delete" data-warn-del="${w.id}" title="Remove warning">✕</button>` : ""}
      </li>`;
    })
    .join("");
}

$("warn-add").addEventListener("click", async () => {
  const reason = $("warn-reason").value.trim();
  const memberId = $("warn-member").value;
  if (!reason || !memberId) {
    setStatus($("warn-status"), "Pick a member and describe what happened.", true);
    return;
  }
  const { error } = await supabase.from("warnings").insert({
    profile_id: memberId,
    incident_date: $("warn-date").value || todayStr(),
    reason,
    created_by: myProfile.name,
  });
  if (error) {
    setStatus($("warn-status"), `Couldn't add: ${error.message}`, true);
    return;
  }
  $("warn-reason").value = "";
  setStatus($("warn-status"), "Warning logged. Only that member and admins can see it. ✔");
  await loadWarnings();
});

$("warnings-card").addEventListener("click", async (e) => {
  const del = e.target.closest("button[data-warn-del]");
  if (!del) return;
  if (!confirm("Remove this warning from the record?")) return;
  await supabase.from("warnings").delete().eq("id", del.dataset.warnDel);
  await loadWarnings();
});

// ---------- supplies to order ----------

let supplies = [];

// Quick-add catalog from the Uline order sheet — category → list of items.
const SUPPLY_CATALOG = {
  "Boxes": [
    "12x12x10 - S-4126",
    "14x12x12 - S-4407",
    "18x12x12 - S-4181",
    "18x10x10 - S-4496 (boxes for shelves)",
    "20x14x14 - S-4207",
    "24x14x14 - S-4654",
    "10x8x5 - S-4517",
  ],
  "Clear Resealable Bags (Uni's)": [
    "6x8 - S-5065",
    "8x10 - S-14477",
    "12x12 - S-10611",
    "12x15 - S-11064",
    "14x16 - S-20314",
  ],
  "Polyethylene Mailers (Catalog)": [
    "14.5x19 - S-12910",
    "12x15.5 - S-12909",
    "7x10.5 - S-20785",
    "10x13 - S-12908",
  ],
  "Labels": [
    "Dymo - 2 5/16x4",
    "Returns - 4x2",
    "US Mail labels - 4x6",
    "Boxing labels 4x4",
  ],
  "Miscellaneous Items": [
    "Brown Paper",
    "Bubble Wrap S-10551",
    "Tape - 2in - S-423",
    "Tape - 3in - S-4-445",
    "Roll Tubes- S-3388",
    "Disinfecting Wipes",
    "Stretch Wrap - S-3212",
    "Clear Binder Sleeves",
    "Rhinestone Glue",
    "Lint Rollers",
    "Try-On Socks",
    "Highlighters",
    "Pens",
    "Sharpies",
    "Paper Clips",
    "Rubber Bands",
    "Invisible Tape - S-12640",
    "Bags for walk-ins - S-7258P",
    "Box cutters H-64",
  ],
};

renderSupplyCatalog();

function renderSupplyCatalog() {
  const el = $("sup-catalog");
  if (!el) return;
  el.innerHTML = Object.entries(SUPPLY_CATALOG)
    .map(([cat, items], i) => {
      const catId = `sup-cat-${i}`;
      return `<div class="sup-cat-row" data-cat="${esc(cat)}">
        <label class="sup-cat-label">${esc(cat)}</label>
        <select id="${catId}-sel" class="sup-cat-select">
          <option value="">Add an item…</option>
          ${items.map((it) => `<option value="${esc(it)}">${esc(it)}</option>`).join("")}
          <option value="__other__">Other (write in)</option>
        </select>
        <input type="text" id="${catId}-other" class="sup-cat-other hidden" placeholder="Type item…">
        <button class="btn btn-primary btn-mini sup-cat-add" type="button" data-catsel="${catId}-sel" data-catother="${catId}-other">Add</button>
      </div>`;
    })
    .join("");
}

document.addEventListener("change", (e) => {
  if (!e.target.matches(".sup-cat-select")) return;
  const other = e.target.closest(".sup-cat-row").querySelector(".sup-cat-other");
  const isOther = e.target.value === "__other__";
  other.classList.toggle("hidden", !isOther);
  if (isOther) other.focus();
});

document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".sup-cat-add");
  if (!btn) return;
  const sel = $(btn.dataset.catsel);
  const other = $(btn.dataset.catother);
  const item = sel.value === "__other__" ? other.value.trim() : sel.value;
  if (!item) return;
  const { error } = await supabase.from("supply_requests").insert({
    item,
    requested_by: myProfile.name,
  });
  if (error) {
    alert(`Couldn't add: ${error.message}`);
    return;
  }
  sel.value = "";
  other.value = "";
  other.classList.add("hidden");
  setStatus($("sup-status"), `Added "${item}" ✔`);
  await loadSupplies();
});

async function loadSupplies() {
  const { data, error } = await supabase
    .from("supply_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    $("sup-needed").innerHTML = `<li class="empty">Couldn't load: ${esc(error.message)}</li>`;
    return;
  }
  supplies = data;
  renderSupplies();
}

function supplyLine(s) {
  const canAdvance = myProfile.is_admin;
  const advance =
    s.status === "needed" && canAdvance
      ? `<button class="btn-mini primary" data-sup-status="ordered" data-sup="${s.id}">Ordered</button>`
      : s.status === "ordered" && canAdvance
        ? `<button class="btn-mini primary" data-sup-status="received" data-sup="${s.id}">Received</button>`
        : "";
  return `<li class="cl-item ${s.status === "received" ? "done" : ""}">
    <span class="cl-label" style="flex:1"><b>${esc(s.item)}</b>${s.note ? ` — ${esc(s.note)}` : ""}
      <span class="cl-by" style="color:var(--ink-soft)">· ${esc(s.requested_by)}</span>
      ${photoThumb(s.photo, true)}</span>
    ${advance}
    <button class="note-delete" data-sup-del="${s.id}" title="Remove">✕</button>
  </li>`;
}

function renderSupplies() {
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
  const needed = supplies.filter((s) => s.status === "needed");
  const ordered = supplies.filter((s) => s.status === "ordered");
  const received = supplies.filter((s) => s.status === "received" && s.updated_at >= twoWeeksAgo);
  $("sup-needed").innerHTML = needed.length ? needed.map(supplyLine).join("") : `<li class="empty">Nothing needed right now.</li>`;
  $("sup-ordered").innerHTML = ordered.length ? ordered.map(supplyLine).join("") : `<li class="empty">Nothing on order.</li>`;
  $("sup-received").innerHTML = received.length ? received.map(supplyLine).join("") : `<li class="empty">Nothing received lately.</li>`;
  $("sup-count").textContent = needed.length ? `(${needed.length})` : "";
  $("sup-confirm-order").classList.toggle("hidden", !needed.length);
  renderOrderReceipts();
}

// Order Receipts: every item carries the batch id + timestamp it was ordered
// under, so a "receipt" is just every item sharing that batch id.
function renderOrderReceipts() {
  const el = $("sup-receipts");
  if (!el) return;
  const batches = new Map();
  supplies.forEach((s) => {
    if (!s.order_batch_id) return;
    if (!batches.has(s.order_batch_id)) batches.set(s.order_batch_id, []);
    batches.get(s.order_batch_id).push(s);
  });
  const ordered = [...batches.entries()].sort(
    (a, b) => (b[1][0]?.updated_at || "").localeCompare(a[1][0]?.updated_at || "")
  );
  if (!ordered.length) {
    el.innerHTML = `<p class="empty-hint">No orders confirmed yet.</p>`;
    return;
  }
  const wasOpen = new Set([...el.querySelectorAll("details[open]")].map((d) => d.dataset.batch));
  el.innerHTML = ordered
    .map(([batchId, items]) => {
      const when = items[0].updated_at;
      const who = items[0].ordered_by;
      const rows = items
        .map((s) => `<li class="cl-item"><span class="cl-label" style="flex:1"><b>${esc(s.item)}</b>${s.note ? ` — ${esc(s.note)}` : ""}${photoThumb(s.photo, true)}</span></li>`)
        .join("");
      return `<details class="hrs-acc" data-batch="${batchId}" ${wasOpen.has(batchId) ? "open" : ""}>
        <summary><span class="roster-name">Order — ${fmtDate(when.slice(0, 10))} at ${fmtTime(when)}</span><span class="cl-by">${items.length} item${items.length === 1 ? "" : "s"} · ${esc(who || "")}</span></summary>
        <ul class="cl-list" style="margin-top:.4rem">${rows}</ul>
      </details>`;
    })
    .join("");
}

$("sup-confirm-order").addEventListener("click", async () => {
  const needed = supplies.filter((s) => s.status === "needed");
  if (!needed.length) return;
  if (!confirm(`Confirm order for ${needed.length} item${needed.length === 1 ? "" : "s"}? They'll move to Ordered and a receipt will be saved below.`)) return;
  const batchId = crypto.randomUUID();
  const { error } = await supabase
    .from("supply_requests")
    .update({ status: "ordered", order_batch_id: batchId, ordered_by: myProfile.name, updated_at: new Date().toISOString() })
    .in("id", needed.map((s) => s.id));
  if (error) {
    alert(`Couldn't confirm the order: ${error.message}`);
    return;
  }
  await loadSupplies();
});

$("sup-add").addEventListener("click", async () => {
  const item = $("sup-item").value.trim();
  if (!item) return;
  const { error } = await supabase.from("supply_requests").insert({
    item,
    note: $("sup-note").value.trim() || null,
    requested_by: myProfile.name,
    photo: supPhoto.uri,
  });
  if (error) {
    setStatus($("sup-status"), `Couldn't add: ${error.message}`, true);
    return;
  }
  $("sup-item").value = "";
  $("sup-note").value = "";
  supPhoto.clear();
  setStatus($("sup-status"), "Added! ✔");
  await loadSupplies();
});

$("supplies").addEventListener("click", async (e) => {
  const adv = e.target.closest("button[data-sup-status]");
  if (adv) {
    await supabase
      .from("supply_requests")
      .update({ status: adv.dataset.supStatus, updated_at: new Date().toISOString() })
      .eq("id", adv.dataset.sup);
    await loadSupplies();
    return;
  }
  const del = e.target.closest("button[data-sup-del]");
  if (del) {
    if (!confirm("Remove this supply item?")) return;
    await supabase.from("supply_requests").delete().eq("id", del.dataset.supDel);
    await loadSupplies();
  }
});

// ---------- checklists ----------

let checklistItems = [];
let checklistChecks = [];

function weekPeriod() {
  // Monday of the current week, as YYYY-MM-DD
  const d = new Date();
  const day = d.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  return dateToStr(new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff));
}

function periodFor(cadence) {
  return cadence === "daily" ? todayStr() : weekPeriod();
}

async function loadChecklists() {
  const [items, checks] = await Promise.all([
    supabase.from("checklist_items").select("*").order("cadence").order("sort_order").order("created_at"),
    supabase.from("checklist_checks").select("*").in("period", [todayStr(), weekPeriod()]),
  ]);
  if (items.error) {
    els.clDaily.innerHTML = `<li class="empty">Couldn't load: ${esc(items.error.message)}</li>`;
    return;
  }
  checklistItems = items.data;
  checklistChecks = checks.data || [];
  renderChecklists();
}

function renderChecklists() {
  const render = (cadence, el) => {
    const list = checklistItems.filter((i) => i.cadence === cadence && (i.team || "warehouse") === curHub);
    if (!list.length) {
      el.innerHTML = `<li class="empty">No ${cadence} items yet.</li>`;
      return;
    }
    const period = periodFor(cadence);
    el.innerHTML = list
      .map((i) => {
        const check = checklistChecks.find((c) => c.item_id === i.id && c.period === period);
        return `<li class="cl-item ${check ? "done" : ""}">
          <label>
            <input type="checkbox" data-item="${i.id}" data-cadence="${i.cadence}" ${check ? "checked" : ""}>
            <span class="cl-label">${esc(i.label)}${photoThumb(i.photo, true)}</span>
            ${i.team === "support" ? '<span class="role-badge role-part-time">CS</span>' : ""}
          </label>
          ${check ? `<span class="cl-by">✓ ${esc(check.checked_by)}</span>` : ""}
          ${myProfile.is_admin ? `<button class="note-delete" data-del-item="${i.id}" title="Delete item">✕</button>` : ""}
        </li>`;
      })
      .join("");
  };
  render("daily", els.clDaily);
  render("weekly", els.clWeekly);
}

$("checklists").addEventListener("click", async (e) => {
  const del = e.target.closest("button[data-del-item]");
  if (del) {
    if (!confirm("Delete this checklist item? It will stop appearing every day/week.")) return;
    await supabase.from("checklist_items").delete().eq("id", del.dataset.delItem);
    await loadChecklists();
    return;
  }
  const box = e.target.closest("input[type=checkbox][data-item]");
  if (!box) return;
  const period = periodFor(box.dataset.cadence);
  if (box.checked) {
    await supabase.from("checklist_checks").insert({
      item_id: box.dataset.item,
      period,
      checked_by: myProfile.name,
    });
  } else {
    await supabase
      .from("checklist_checks")
      .delete()
      .eq("item_id", box.dataset.item)
      .eq("period", period);
  }
  await loadChecklists();
});

els.clAdd.addEventListener("click", async () => {
  const label = els.clLabel.value.trim();
  if (!label) return;
  setStatus(els.clStatus, "");
  const { error } = await supabase.from("checklist_items").insert({
    label,
    cadence: els.clCadence.value,
    team: els.clTeam.value,
    photo: clPhoto.uri,
  });
  if (error) {
    setStatus(els.clStatus, `Couldn't add: ${error.message}`, true);
    return;
  }
  els.clLabel.value = "";
  clPhoto.clear();
  await loadChecklists();
});

// ---------- time clock ----------

const PUNCH_ORDER = ["in", "lunch-out", "lunch-in", "out"];
const PUNCH_LABELS = {
  in: "Clock In",
  "lunch-out": "Out to Lunch",
  "lunch-in": "Back from Lunch",
  out: "Clock Out",
};
const STATUS_AFTER = {
  none: { label: "Not in Yet", cls: "st-out" },
  in: { label: "In", cls: "st-in" },
  "lunch-out": { label: "At lunch", cls: "st-lunch" },
  "lunch-in": { label: "In", cls: "st-in" },
  out: { label: "Left for the day", cls: "st-out" },
};

function dayRange(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(y, m - 1, d + 1);
  return [start.toISOString(), end.toISOString()];
}

async function loadPunches() {
  const day = els.punchDate.value || todayStr();
  const [start, end] = dayRange(day);
  const { data, error } = await supabase
    .from("time_punches")
    .select("*")
    .gte("punched_at", start)
    .lt("punched_at", end)
    .order("punched_at");
  if (error) {
    els.myPunches.textContent = `Couldn't load punches: ${error.message}`;
    return;
  }
  punches = data;
  renderMyClock();
  renderPunchTable();
  renderRoster();
}

function myPunchesToday() {
  const today = todayStr();
  const [start, end] = dayRange(today);
  // punches state only holds the selected admin day; refetch not needed when it's today
  return punches.filter(
    (p) => p.profile_id === myProfile.id && p.punched_at >= start && p.punched_at < end
  );
}

function renderMyClock() {
  // Only meaningful for today
  const viewingToday = (els.punchDate.value || todayStr()) === todayStr();
  const mine = viewingToday ? myPunchesToday() : [];
  const last = mine.length ? mine[mine.length - 1].punch_type : "none";
  const status = STATUS_AFTER[last];
  els.clockState.textContent = status.label;
  els.clockState.className = `clock-state ${status.cls}`;

  const punched = new Set(mine.map((p) => p.punch_type));
  const nextIdx = PUNCH_ORDER.findIndex((t) => !punched.has(t));
  els.punchButtons.forEach((btn) => {
    const idx = PUNCH_ORDER.indexOf(btn.dataset.punch);
    btn.disabled = !viewingToday || idx !== nextIdx;
  });
  els.undoPunch.disabled = !viewingToday || !mine.length;

  els.myPunches.textContent = mine.length
    ? "You today: " + mine.map((p) => `${PUNCH_LABELS[p.punch_type]} ${fmtTime(p.punched_at)}`).join(" · ")
    : "You haven't clocked in yet today.";
}

const PUNCH_ROW_LABELS = { in: "Clock In", "lunch-out": "Lunch Out", "lunch-in": "Lunch In", out: "Clock Out" };

function renderPunchTable() {
  const byMember = {};
  punches.forEach((p) => {
    (byMember[p.profile_id] = byMember[p.profile_id] || {})[p.punch_type] = p.punched_at;
  });
  const day = els.punchDate.value || todayStr();
  const pendingFor = (memberId, ptype) =>
    punchRequests.find((r) => r.status === "pending" && r.profile_id === memberId && r.day === day && r.punch_type === ptype);
  const dow = new Date(day + "T12:00:00").getDay(); // 1–5 = Mon–Fri
  const dayKey = dow >= 1 && dow <= 5 ? DAYS[dow - 1] : null;

  const people = myProfile.is_admin
    ? hubMembers()
    : [...hubMembers()].sort((a, b) => (b.id === myProfile.id) - (a.id === myProfile.id)); // self first
  els.punchList.innerHTML = people
    .map((s) => {
      const mine = byMember[s.id] || {};
      const lastType = [...PUNCH_ORDER].reverse().find((t) => mine[t]) || "none";

      // Off that day? (no scheduled hours, or time-off on the calendar)
      const scheduled = dayKey ? ((hoursById[s.id] || {})[dayKey] || "").trim() : "";
      const timeOff = notes.some(
        (n) => n.note_type === "out" && n.staff_name === s.name && noteOnDay(n, day)
      );
      const isOff = lastType === "none" && (timeOff || !scheduled);
      const self = s.id === myProfile.id;

      // Members see simple presence bubbles for teammates; admin sees full statuses.
      if (!myProfile.is_admin) {
        const inOffice = lastType === "in" || lastType === "lunch-in";
        const bubble = `<span class="clock-state ${inOffice ? "st-in" : "st-out"}">${inOffice ? "In Office" : "Out of Office"}</span>`;
        if (!self) {
          return `<div class="punch-person punch-person-flat ${isOff ? "row-off" : ""}">
            <span class="staff-name">${nameWithAvatar(s.name)}</span>${bubble}
          </div>`;
        }
        const rows = PUNCH_ORDER.map((t) => {
          const pend = pendingFor(s.id, t);
          const shown = mine[t]
            ? fmtTime(mine[t]) + (pend ? ` <span class="pend" title="Change to ${fmtTime(pend.requested_time)} awaiting approval">⏳</span>` : "")
            : pend
              ? `<span class="pend" title="Awaiting Karley's approval">⏳ ${fmtTime(pend.requested_time)}</span>`
              : '<span class="cell-off">—</span>';
          return `<div class="punch-row"><span class="punch-row-label">${PUNCH_ROW_LABELS[t]}</span><button class="punch-cell" data-member="${s.id}" data-mname="${esc(s.name)}" data-ptype="${t}" title="Tap to request a fix">${shown}</button></div>`;
        }).join("");
        return `<div class="punch-person ${isOff ? "row-off" : ""}">
          <div class="punch-person-head"><span class="staff-name">${nameWithAvatar(s.name)}</span>${bubble}</div>
          <div class="punch-rows">${rows}</div>
        </div>`;
      }

      // Admin: collapsible per person — status on the summary, punches inside.
      const status = isOff
        ? { label: timeOff ? "Time off" : "Off today", cls: "st-offday" }
        : STATUS_AFTER[lastType];
      const rows = PUNCH_ORDER.map((t) => {
        const pend = pendingFor(s.id, t);
        const shown = mine[t]
          ? fmtTime(mine[t]) + (pend ? ` <span class="pend" title="Change to ${fmtTime(pend.requested_time)} awaiting approval">⏳</span>` : "")
          : pend
            ? `<span class="pend" title="Awaiting Karley's approval">⏳ ${fmtTime(pend.requested_time)}</span>`
            : '<span class="cell-off">—</span>';
        return `<div class="punch-row"><span class="punch-row-label">${PUNCH_ROW_LABELS[t]}</span><button class="punch-cell" data-member="${s.id}" data-mname="${esc(s.name)}" data-ptype="${t}" title="Tap to set or fix this punch">${shown}</button></div>`;
      }).join("");
      const wasOpen = els.punchList.querySelector(`details[data-person="${s.id}"]`)?.open;
      return `<details class="punch-acc ${isOff ? "row-off" : ""}" data-person="${s.id}" ${wasOpen ? "open" : ""}>
        <summary><span class="staff-name">${nameWithAvatar(s.name)}</span><span class="clock-state ${status.cls}">${status.label}</span></summary>
        <div class="punch-rows">${rows}</div>
      </details>`;
    })
    .join("");
}

els.punchButtons.forEach((btn) =>
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    const { error } = await supabase.from("time_punches").insert({
      profile_id: myProfile.id,
      punch_type: btn.dataset.punch,
    });
    if (error) alert(`Couldn't punch: ${error.message}`);
    else if (btn.dataset.punch === "out") showGoodbye();
    await loadPunches();
    loadWeekPunches();
  })
);

// Full-screen send-off when someone clocks out for the day.
function showGoodbye() {
  document.querySelector(".goodbye")?.remove();
  const div = document.createElement("div");
  div.className = "goodbye";
  const colors = ["#e5007d", "#ff4fa5", "#ffe9a8", "#7ec8e3", "#9be89b", "#c9a0ff", "#fff"];
  const confetti = Array.from({ length: 100 }, (_, i) => {
    const left = Math.random() * 100;
    const delay = Math.random() * 1.2;
    const dur = 2.4 + Math.random() * 2;
    const size = 6 + Math.random() * 7;
    const drift = (Math.random() * 16 - 8).toFixed(1);
    return `<span class="confetti" style="left:${left}%;width:${size}px;height:${(size * 0.45).toFixed(1)}px;background:${colors[i % colors.length]};animation-delay:${delay.toFixed(2)}s;animation-duration:${dur.toFixed(2)}s;--drift:${drift}vw"></span>`;
  }).join("");
  div.innerHTML = `${confetti}<div class="goodbye-inner">Great Work Today, ${esc(myProfile.name)}!</div>`;
  document.body.appendChild(div);
  div.addEventListener("click", () => div.remove());
  setTimeout(() => div.remove(), 4500);
}

els.undoPunch.addEventListener("click", async () => {
  const mine = myPunchesToday();
  if (!mine.length) return;
  const last = mine[mine.length - 1];
  if (!confirm(`Undo "${PUNCH_LABELS[last.punch_type]}" at ${fmtTime(last.punched_at)}?`)) return;
  const { error } = await supabase.from("time_punches").delete().eq("id", last.id);
  if (error) alert(`Couldn't undo: ${error.message}`);
  await loadPunches();
});

els.punchDate.addEventListener("change", loadPunches);

// ---------- admin punch corrections ----------

// "8:00 AM" / "4:30 pm" / "16:30" → minutes since midnight, or null.
function parseClockTime(str) {
  const m = /^\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*$/i.exec(str || "");
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const mins = m[2] ? parseInt(m[2], 10) : 0;
  const mer = (m[3] || "").toLowerCase();
  if (mer === "pm" && h < 12) h += 12;
  if (mer === "am" && h === 12) h = 0;
  if (!mer && h < 7) h += 12; // bare "4:30" on a day shift almost surely means PM
  if (h > 23 || mins > 59) return null;
  return h * 60 + mins;
}

document.querySelector("#punch-list").addEventListener("click", async (e) => {
  const cell = e.target.closest("button.punch-cell");
  if (!cell || !myProfile) return;
  const day = els.punchDate.value || todayStr();
  const [s, eEnd] = dayRange(day);
  const existing = punches.find(
    (p) => p.profile_id === cell.dataset.member && p.punch_type === cell.dataset.ptype &&
           p.punched_at >= s && p.punched_at < eEnd
  );
  const label = PUNCH_LABELS[cell.dataset.ptype];

  // Members: propose a fix on their own row — pending until Karley approves.
  if (!myProfile.is_admin) {
    if (cell.dataset.member !== myProfile.id) return;
    const answer = prompt(
      `Request a fix — "${label}" on ${fmtDate(day)}.\n` +
      `Enter the time it should be, like "8:00 AM". Karley will approve it:`,
      existing ? fmtTime(existing.punched_at) : ""
    );
    if (answer === null || answer.trim() === "") return;
    const mins = parseClockTime(answer);
    if (mins === null) {
      alert('Couldn\'t read that time — use a format like "8:00 AM".');
      return;
    }
    const [y, mo, d] = day.split("-").map(Number);
    const ts = new Date(y, mo - 1, d, Math.floor(mins / 60), mins % 60).toISOString();
    const { error } = await supabase.from("punch_requests").insert({
      profile_id: myProfile.id,
      day,
      punch_type: cell.dataset.ptype,
      requested_time: ts,
    });
    if (error) alert(`Couldn't send the request: ${error.message}`);
    else showToast("Sent to Karley for approval ⏳");
    await loadPunchRequests();
    return;
  }

  const answer = prompt(
    `${cell.dataset.mname} — "${label}" on ${fmtDate(day)}.\n` +
    `Enter a time like "8:00 AM" (leave empty and press OK to remove this punch):`,
    existing ? fmtTime(existing.punched_at) : ""
  );
  if (answer === null) return; // cancelled
  if (answer.trim() === "") {
    if (existing && confirm(`Remove the "${label}" punch for ${cell.dataset.mname}?`)) {
      await supabase.from("time_punches").delete().eq("id", existing.id);
    }
  } else {
    const mins = parseClockTime(answer);
    if (mins === null) {
      alert('Couldn\'t read that time — use a format like "8:00 AM".');
      return;
    }
    const [y, mo, d] = day.split("-").map(Number);
    const ts = new Date(y, mo - 1, d, Math.floor(mins / 60), mins % 60).toISOString();
    if (existing) {
      await supabase.from("time_punches").update({ punched_at: ts }).eq("id", existing.id);
    } else {
      await supabase.from("time_punches").insert({
        profile_id: cell.dataset.member,
        punch_type: cell.dataset.ptype,
        punched_at: ts,
      });
    }
  }
  await loadPunches();
  loadWeekPunches();
});

// ---------- punch-fix requests (member proposes, admin approves) ----------

async function loadPunchRequests() {
  const { data, error } = await supabase
    .from("punch_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return;
  punchRequests = data || [];
  renderPunchRequests();
  renderPunchTable();
}

const REQ_STATUS = { pending: "⏳ waiting for approval", approved: "✅ approved", denied: "✖ denied" };

function renderPunchRequests() {
  if (!myProfile) return;
  if (myProfile.is_admin) {
    const pending = punchRequests.filter((r) => r.status === "pending");
    els.punchReqs.classList.toggle("hidden", !pending.length);
    els.punchReqList.innerHTML = pending
      .map((r) => {
        const who = staff.find((p) => p.id === r.profile_id);
        return `<div class="punch-req">
          <span class="req-text"><b>${esc(who ? who.name : "?")}</b> — ${PUNCH_LABELS[r.punch_type]} at <b>${fmtTime(r.requested_time)}</b> on ${fmtDate(r.day)}</span>
          <button class="btn btn-primary btn-sm" data-req="${r.id}" data-act="approve" type="button">Approve</button>
          <button class="btn btn-ghost btn-sm" data-req="${r.id}" data-act="deny" type="button">Deny</button>
        </div>`;
      })
      .join("");
    return;
  }
  // Member: show my requests from the last 7 days with their status.
  const cutoff = new Date(Date.now() - 7 * 864e5).toISOString();
  const mine = punchRequests.filter((r) => r.profile_id === myProfile.id && r.created_at >= cutoff);
  els.myPunchReqs.classList.toggle("hidden", !mine.length);
  els.myPunchReqs.innerHTML = mine
    .map((r) => `<p class="punch-req-mine req-${r.status}">${PUNCH_LABELS[r.punch_type]} at <b>${fmtTime(r.requested_time)}</b> on ${fmtDate(r.day)} — ${REQ_STATUS[r.status]}</p>`)
    .join("");
}

els.punchReqList.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-req]");
  if (!btn || !myProfile?.is_admin) return;
  const req = punchRequests.find((r) => r.id === btn.dataset.req);
  if (!req) return;
  btn.disabled = true;
  if (btn.dataset.act === "approve") {
    const [s, eEnd] = dayRange(req.day);
    const { data: ex } = await supabase
      .from("time_punches")
      .select("id")
      .eq("profile_id", req.profile_id)
      .eq("punch_type", req.punch_type)
      .gte("punched_at", s)
      .lt("punched_at", eEnd)
      .limit(1);
    const write = ex && ex.length
      ? await supabase.from("time_punches").update({ punched_at: req.requested_time }).eq("id", ex[0].id)
      : await supabase.from("time_punches").insert({ profile_id: req.profile_id, punch_type: req.punch_type, punched_at: req.requested_time });
    if (write.error) {
      alert(`Couldn't apply the punch: ${write.error.message}`);
      btn.disabled = false;
      return;
    }
    await supabase.from("punch_requests").update({ status: "approved" }).eq("id", req.id);
  } else {
    await supabase.from("punch_requests").update({ status: "denied" }).eq("id", req.id);
  }
  await Promise.all([loadPunches(), loadPunchRequests()]);
  loadWeekPunches();
});

// ---------- weekly worked-hours summary (admin) ----------

let weekPunches = [];

async function loadWeekPunches() {
  if (!myProfile?.is_admin) return;
  const [monStart] = dayRange(weekPeriod());
  const { data, error } = await supabase
    .from("time_punches")
    .select("*")
    .gte("punched_at", monStart)
    .order("punched_at");
  if (error) return;
  weekPunches = data;
  renderHoursTable();
}

// Worked minutes for one person's punches on one day: in→out minus the lunch
// gap. A missing clock-out counts up to "now" and is flagged as still open.
function workedMinutes(dayPunches) {
  const t = {};
  dayPunches.forEach((p) => (t[p.punch_type] = new Date(p.punched_at)));
  if (!t.in) return { mins: 0, open: false, any: dayPunches.length > 0 };
  const now = new Date();
  const end = t.out || now;
  let mins = (end - t.in) / 60000;
  if (t["lunch-out"]) {
    const backIn = t["lunch-in"] || t.out || now;
    mins -= (backIn - t["lunch-out"]) / 60000;
  }
  return { mins: Math.max(0, Math.round(mins)), open: !t.out, any: true };
}

function fmtHM(mins) {
  return `${Math.floor(mins / 60)}:${String(Math.round(mins) % 60).padStart(2, "0")}`;
}

function renderHoursTable() {
  const box = $("hours-acc");
  if (!box || !myProfile?.is_admin) return;
  const monday = weekPeriod();
  const [my, mm, md] = monday.split("-").map(Number);
  const today = todayStr();
  const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const members = hubMembers();
  if (!members.length) {
    box.innerHTML = `<p class="empty-hint">No members yet.</p>`;
    return;
  }
  // remember which panels were open across re-renders
  const open = new Set([...box.querySelectorAll("details[open]")].map((d) => d.dataset.id));

  box.innerHTML = members
    .map((p) => {
      let total = 0;
      const rows = DAYS.map((day, i) => {
        const date = dateToStr(new Date(my, mm - 1, md + i));
        let cell = '<span class="cell-off">—</span>';
        if (date <= today) {
          const [s, e] = dayRange(date);
          const dayPunches = weekPunches.filter(
            (x) => x.profile_id === p.id && x.punched_at >= s && x.punched_at < e
          );
          const w = workedMinutes(dayPunches);
          total += w.mins;
          if (w.any) cell = `${fmtHM(w.mins)}${w.open ? '<span class="hrs-open" title="Still clocked in">…</span>' : ""}`;
        }
        const sh = parseShift((hoursById[p.id] || {})[day]);
        return `<div class="hrs-row"><span>${DAY_LABELS[i]}</span><span>${cell}</span><span class="cell-off">${sh ? fmtHM(sh.end - sh.start) : "—"}</span></div>`;
      }).join("");

      const hours = hoursById[p.id] || {};
      const schedMins = DAYS.reduce((sum, day) => {
        const sh = parseShift(hours[day]);
        return sum + (sh ? sh.end - sh.start : 0);
      }, 0);
      const short = schedMins > 0 && total < schedMins;
      return `<details class="hrs-acc" data-id="${p.id}" ${open.has(p.id) ? "open" : ""}>
        <summary>
          <span class="roster-name">${nameWithAvatar(p.name)}</span>
          <b class="${short ? "hrs-short" : "hrs-ok"}">${fmtHM(total)}</b>
          <span class="cell-off">/ ${schedMins ? fmtHM(schedMins) : "—"}</span>
        </summary>
        <div class="hrs-body">
          <div class="hrs-row hrs-head"><span></span><span>Worked</span><span>Sched.</span></div>
          ${rows}
        </div>
      </details>`;
    })
    .join("");
}

// ---------- photo attachments ----------

// Resize an image to a reasonable size and return a data URI (same approach as avatars).
async function resizePhoto(file) {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("That file doesn't look like an image.");
  const MAX = 640;
  const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.75);
}

function readFileAsDataUri(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

// Photos get resized/compressed and stored inline (small either way). PDFs
// are saved to the `attachments` table instead, and only a lightweight
// "pdf-ref:<id>" pointer rides along on the entry itself — this keeps every
// list fast to load, since the heavy bytes are only fetched when someone
// actually taps "View PDF".
async function processAttachment(file) {
  if (file.type === "application/pdf") {
    if (file.size > 20 * 1024 * 1024) throw new Error("PDF is over 20 MB — pick a smaller one.");
    const dataUri = await readFileAsDataUri(file);
    const { data, error } = await supabase.from("attachments").insert({ data_uri: dataUri }).select("id").single();
    if (error) throw new Error(`Couldn't save the PDF: ${error.message}`);
    return `pdf-ref:${data.id}`;
  }
  if (file.size > 20 * 1024 * 1024) throw new Error("Image is over 20 MB — pick a smaller one.");
  return resizePhoto(file);
}

// Wire a 📷 button to its hidden file input — a single, direct input.click()
// call opens the picker (the standard, most reliable technique).
function photoPicker(btnId, inputId, statusId) {
  const btn = $(btnId), input = $(inputId), statusEl = statusId ? $(statusId) : null;
  const state = {
    uri: null,
    clear() {
      state.uri = null;
      input.value = "";
      btn.classList.remove("has-photo");
      btn.title = "Attach a photo";
    },
  };
  // A real <button> with a single, direct input.click() call — the standard,
  // most reliable way to open a file picker across browsers (no dependency
  // on a <label for> element's native default-action forwarding, which some
  // desktop/PWA setups don't fire consistently).
  btn.addEventListener("click", () => {
    if (statusEl) setStatus(statusEl, "Opening photo picker…");
    input.click();
  });
  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      state.uri = await processAttachment(file);
      const isPdf = file.type === "application/pdf";
      btn.classList.add("has-photo");
      btn.title = `${isPdf ? "PDF" : "Photo"} attached — tap to change`;
      if (statusEl) setStatus(statusEl, `${isPdf ? "PDF" : "Photo"} attached ✔ — it'll post with this entry.`);
    } catch (err) {
      alert(err.message);
      state.clear();
    }
  });
  return state;
}

const annPhoto = photoPicker("ann-photo-btn", "ann-photo", "ann-status");
const pnPhoto = photoPicker("pn-photo-btn", "pn-photo", "pn-status");
const tfPhoto = photoPicker("tf-photo-btn", "tf-photo", "task-status");
const rsPhoto = photoPicker("rs-photo-btn", "rs-photo", "rs-status");
const clPhoto = photoPicker("cl-photo-btn", "cl-photo", "cl-status");
const supPhoto = photoPicker("sup-photo-btn", "sup-photo", "sup-status");

const photoThumb = (src, small) => {
  if (!src) return "";
  // PDFs are stored out-of-line in the `attachments` table (see pdf-ref: below)
  // so the heavy bytes aren't re-downloaded on every list load — only fetched
  // when someone actually taps to view it.
  if (src.startsWith("pdf-ref:")) {
    const id = src.slice("pdf-ref:".length);
    return `<button type="button" class="entry-pdf${small ? " entry-pdf-sm" : ""}" data-pdf-ref="${esc(id)}">📄 View PDF</button>`;
  }
  if (src.startsWith("data:application/pdf")) {
    // Older PDFs saved before the attachments table existed — still inline.
    return `<button type="button" class="entry-pdf${small ? " entry-pdf-sm" : ""}" data-pdf-src="${esc(src)}">📄 View PDF</button>`;
  }
  return `<img class="entry-photo${small ? " entry-photo-sm" : ""}" src="${esc(src)}" alt="Attached photo" title="Tap to view">`;
};

function dataUriToBlob(dataUri) {
  const [header, base64] = dataUri.split(",");
  const mime = /data:(.*?);base64/.exec(header)?.[1] || "application/octet-stream";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// Tap any thumbnail to view it full-screen.
function showPhoto(src) {
  document.querySelector(".photo-view")?.remove();
  const div = document.createElement("div");
  div.className = "photo-view";
  const img = document.createElement("img");
  img.src = src;
  div.appendChild(img);
  div.addEventListener("click", () => div.remove());
  document.body.appendChild(div);
}
document.addEventListener("click", (e) => {
  const img = e.target.closest("img.entry-photo");
  if (img) showPhoto(img.src);
});

function openPdfBlob(dataUri) {
  const url = URL.createObjectURL(dataUriToBlob(dataUri));
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".entry-pdf");
  if (!btn) return;
  try {
    if (btn.dataset.pdfSrc) {
      openPdfBlob(btn.dataset.pdfSrc);
      return;
    }
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Loading…";
    const { data, error } = await supabase
      .from("attachments")
      .select("data_uri")
      .eq("id", btn.dataset.pdfRef)
      .single();
    btn.disabled = false;
    btn.textContent = original;
    if (error || !data) {
      alert("Couldn't load that PDF.");
      return;
    }
    openPdfBlob(data.data_uri);
  } catch {
    alert("Couldn't open that PDF.");
  }
});

// ---------- personal notes (private to each person) ----------

let personalNotes = [];

async function loadPersonalNotes() {
  const { data, error } = await supabase
    .from("personal_notes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    $("pn-list").innerHTML = `<li class="empty">Couldn't load: ${esc(error.message)}</li>`;
    return;
  }
  personalNotes = data;
  renderPersonalNotes();
}

function renderPersonalNotes() {
  $("pn-list").innerHTML = personalNotes.length
    ? personalNotes
        .map(
          (n) => `<li class="cl-item">
            <span class="cl-label" style="flex:1">
              ${n.body ? `<span class="pn-text">${esc(n.body)}</span>` : ""}
              ${photoThumb(n.photo, true)}
              <span class="cl-by" style="color:var(--ink-soft)">· ${fmtDate(n.created_at.slice(0, 10))}</span>
            </span>
            <button class="note-delete" data-pn-del="${n.id}" title="Delete note">✕</button>
          </li>`
        )
        .join("")
    : `<li class="empty">No notes yet — jot anything down, it's just for you.</li>`;
}

$("pn-add").addEventListener("click", async () => {
  const body = $("pn-body").value.trim();
  if (!body && !pnPhoto.uri) return;
  const { error } = await supabase.from("personal_notes").insert({
    profile_id: myProfile.id,
    body: body || null,
    photo: pnPhoto.uri,
  });
  if (error) {
    setStatus($("pn-status"), `Couldn't save: ${error.message}`, true);
    return;
  }
  $("pn-body").value = "";
  $("pn-body").style.height = "";
  pnPhoto.clear();
  setStatus($("pn-status"), "Saved ✔ — only you can see it.");
  await loadPersonalNotes();
});

$("pn-list").addEventListener("click", async (e) => {
  const del = e.target.closest("button[data-pn-del]");
  if (!del) return;
  if (!confirm("Delete this note?")) return;
  await supabase.from("personal_notes").delete().eq("id", del.dataset.pnDel);
  await loadPersonalNotes();
});

// ---------- announcements ----------

async function loadAnnouncements() {
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) {
    els.annList.innerHTML = `<li class="empty">Couldn't load: ${esc(error.message)}</li>`;
    return;
  }
  els.annList.innerHTML = data.length
    ? data
        .map((a) => {
          const canDelete = a.author_id === myProfile.id || myProfile.is_admin;
          const when = new Date(a.created_at).toLocaleDateString("en-US", {
            weekday: "short", month: "short", day: "numeric",
          });
          return `<li>
            <div class="ann-meta"><span class="note-name">${nameWithAvatar(a.author_name)}</span>
              <span class="ann-when">${when} ${fmtTime(a.created_at)}</span>
              ${canDelete ? `<button class="note-delete" data-ann="${a.id}" title="Delete announcement">✕</button>` : ""}
            </div>
            <div class="ann-body">${esc(a.body)}</div>
            ${photoThumb(a.photo)}
          </li>`;
        })
        .join("")
    : `<li class="empty">No announcements yet.</li>`;
}

els.annForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setStatus(els.annStatus, "");
  const { error } = await supabase.from("announcements").insert({
    author_id: myProfile.id,
    author_name: myProfile.name,
    body: els.annBody.value.trim(),
    photo: annPhoto.uri,
  });
  if (error) {
    setStatus(els.annStatus, `Couldn't post: ${error.message}`, true);
    return;
  }
  els.annForm.reset();
  annPhoto.clear();
  await loadAnnouncements();
});

els.annList.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-ann]");
  if (!btn) return;
  if (!confirm("Delete this announcement?")) return;
  await supabase.from("announcements").delete().eq("id", btn.dataset.ann);
  await loadAnnouncements();
});

// ---------- schedules ----------

async function loadStaff() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("role")     // full-time sorts before part-time
    .order("name");
  if (error) {
    els.tableBody.innerHTML = `<tr><td colspan="6">Couldn't load schedules: ${esc(error.message)}</td></tr>`;
    return;
  }
  staff = data;
  renderNameOptions();
}

async function loadHours() {
  // RLS returns only my row (or all rows for admins).
  const { data, error } = await supabase.from("member_hours").select("*");
  if (error) return;
  hoursById = Object.fromEntries(data.map((h) => [h.profile_id, h.hours || {}]));
  renderSchedules();
}

function scheduleRows() {
  // members flagged off-schedule (e.g. Justin & Jerad) don't get a row
  return hubMembers().filter((p) => p.on_schedule !== false);
}

function canEditRow(p) {
  return myProfile.is_admin || p.id === myProfile.id;
}

function renderSchedules() {
  const rows = scheduleRows();
  if (!rows.length) {
    els.tableBody.innerHTML = `<tr><td colspan="6" class="cell-off">No profiles yet — team members appear here as they join.</td></tr>`;
    return;
  }
  els.tableBody.innerHTML = rows
    .map((p) => {
      const hours = hoursById[p.id] || {};
      const editable = editing && canEditRow(p);
      const cells = DAYS.map((day) => {
        const val = hours[day] || "";
        if (editable) {
          return `<td><input type="text" list="shift-options" data-id="${p.id}" data-day="${day}" value="${esc(val)}"></td>`;
        }
        return val ? `<td>${esc(val)}</td>` : `<td class="cell-off">—</td>`;
      }).join("");
      const name = `<span class="staff-name">${nameWithAvatar(p.name)}</span><span class="role-badge role-${p.role}">${p.role === "full-time" ? "FT" : "PT"}</span>`;
      return `<tr><td class="name-col">${name}</td>${cells}</tr>`;
    })
    .join("");
}

function setEditing(on) {
  editing = on;
  els.editActions.classList.toggle("hidden", !on);
  els.editToggle.classList.toggle("hidden", on);
  renderSchedules();
}

els.editToggle.addEventListener("click", () => setEditing(true));
els.cancelEdit.addEventListener("click", () => setEditing(false));

els.saveSchedules.addEventListener("click", async () => {
  els.saveSchedules.disabled = true;
  let failed = false;
  for (const p of scheduleRows().filter(canEditRow)) {
    const hours = { ...(hoursById[p.id] || {}) };
    let touched = false;
    DAYS.forEach((day) => {
      const input = els.tableBody.querySelector(`input[data-id="${p.id}"][data-day="${day}"]`);
      if (input) {
        hours[day] = input.value.trim();
        touched = true;
      }
    });
    if (!touched) continue;
    const { error } = await supabase
      .from("member_hours")
      .upsert({ profile_id: p.id, hours });
    if (error) failed = true;
  }
  els.saveSchedules.disabled = false;
  if (failed) alert("Some changes didn't save — try again.");
  setEditing(false);
  await loadHours();
});

function renderNameOptions() {
  const opts = staff
    .map((p) => `<option value="${esc(p.name)}">${esc(p.avatar || "🙂")} ${esc(p.name)}</option>`)
    .join("");
  els.tfAssign.innerHTML = `<option value="" selected>Leave open for anyone</option>` + opts;
}

// ---------- calendar + out/meetings board ----------

const TYPE_LABELS = {
  out: "Time off",
  "different-hours": "Different hours",
  meeting: "Meeting",
  other: "Note",
};

function noteEnd(n) {
  return n.end_date || n.start_date;
}

function noteDateLabel(n) {
  if (n.end_date && n.end_date !== n.start_date) {
    return `${fmtDate(n.start_date)} – ${fmtDate(n.end_date)}`;
  }
  return fmtDate(n.start_date);
}

// Each person gets their own calendar color (assigned alphabetically, so it's
// stable unless the roster changes).
const PERSON_COLORS = [
  { bg: "#fde2ec", fg: "#b3005f" },
  { bg: "#e3ecfd", fg: "#2b4bab" },
  { bg: "#e2f6e5", fg: "#157347" },
  { bg: "#fdf3d8", fg: "#8a6d0a" },
  { bg: "#f0e4fb", fg: "#6d28a8" },
  { bg: "#fde8dd", fg: "#b5490f" },
  { bg: "#ddf4f6", fg: "#0f6f7a" },
  { bg: "#f6e0e0", fg: "#a02929" },
  { bg: "#e8e8f0", fg: "#4a4a6a" },
  { bg: "#e6f0dc", fg: "#4a7016" },
];
function personColor(name) {
  const names = [...new Set(staff.map((s) => s.name))].sort();
  let idx = names.indexOf(name);
  if (idx === -1) {
    let h = 0;
    for (const c of String(name || "")) h = (h * 31 + c.charCodeAt(0)) | 0;
    idx = Math.abs(h);
  }
  return PERSON_COLORS[idx % PERSON_COLORS.length];
}

// Calendar entries belong to the hub their author is on — the Customer Support
// view doesn't show warehouse people's entries (and vice versa). Admins and
// unmatched names show in both.
function noteInHub(n) {
  const p = staff.find((s) => s.name === n.staff_name);
  if (!p || p.is_admin) return true;
  return curHub === "support" ? !!p.support_access : p.warehouse_access !== false;
}

// Does a note apply on the given day? Directly, or via its recurrence
// (weekly = same weekday, biweekly = every 14 days, monthly = same day-of-month).
const NOTE_RECUR_LABELS = { weekly: "weekly", biweekly: "every 2 weeks", monthly: "monthly" };
function noteOnDay(n, iso) {
  if (n.start_date <= iso && noteEnd(n) >= iso) return true;
  if (!n.recurrence || n.recurrence === "none" || iso <= n.start_date) return false;
  const d0 = new Date(n.start_date + "T12:00:00");
  const d1 = new Date(iso + "T12:00:00");
  const days = Math.round((d1 - d0) / 864e5);
  if (n.recurrence === "weekly") return days % 7 === 0;
  if (n.recurrence === "biweekly") return days % 14 === 0;
  if (n.recurrence === "monthly") return d0.getDate() === d1.getDate();
  return false;
}

async function loadNotes() {
  const { data, error } = await supabase
    .from("schedule_notes")
    .select("*")
    .order("start_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    els.notesList.innerHTML = `<li class="empty">Couldn't load entries: ${esc(error.message)}</li>`;
    return;
  }
  notes = data;
  renderNotes();
  renderTodayCallout();
  renderCalendar();
  renderReminders();
}

function renderNotes() {
  const today = todayStr();
  const showPast = els.showPast.checked;
  // Upcoming shows only the next 2 weeks (tick "show past entries" to see everything)
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 14);
  const twoWeeksOut = dateToStr(horizon);
  const inWindow = (n) => {
    if (n.start_date <= twoWeeksOut && noteEnd(n) >= today) return true;
    if (n.recurrence && n.recurrence !== "none") {
      for (let i = 0; i <= 14; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        if (noteOnDay(n, dateToStr(d))) return true;
      }
    }
    return false;
  };
  const visible = notes.filter((n) => noteInHub(n) && (showPast || inWindow(n)));

  if (!visible.length) {
    els.notesList.innerHTML = `<li class="empty">Nothing coming up — everyone's on their normal schedule. 🎉</li>`;
    return;
  }

  els.notesList.innerHTML = visible
    .map((n) => {
      const isPast = noteEnd(n) < today;
      return `<li class="${isPast ? "past" : ""}">
        <span class="note-date">${noteDateLabel(n)}</span>
        <span class="note-type type-${n.note_type}">${TYPE_LABELS[n.note_type] || n.note_type}</span>
        <span class="note-name" style="background:${personColor(n.staff_name).bg};color:${personColor(n.staff_name).fg}">${esc(n.staff_name)}${n.visibility === "admin" ? ' <span title="Only visible to you">🔒</span>' : ""}</span>
        ${n.event_time ? `<span class="note-details">${esc(n.event_time)}</span>` : ""}
        ${n.recurrence && n.recurrence !== "none" ? `<span class="note-details">↻ ${NOTE_RECUR_LABELS[n.recurrence]}</span>` : ""}
        ${n.details ? `<span class="note-details">${esc(n.details)}</span>` : ""}
        <button class="note-edit" data-edit="${n.id}" title="Edit this entry" aria-label="Edit entry">✎</button>
        <button class="note-delete" data-id="${n.id}" title="Remove this entry${n.recurrence && n.recurrence !== "none" ? " (removes every repeat)" : ""}" aria-label="Remove entry">✕</button>
      </li>`;
    })
    .join("");
}

function renderTodayCallout() {
  const today = todayStr();
  const todays = notes.filter((n) => noteInHub(n) && noteOnDay(n, today));
  if (!todays.length) {
    els.todayCallout.classList.add("hidden");
    return;
  }
  els.todayCallout.classList.remove("hidden");
  els.todayCallout.innerHTML =
    `<strong>Today:</strong><ul>` +
    todays
      .map(
        (n) =>
          `<li><b>${esc(n.staff_name)}</b> — ${TYPE_LABELS[n.note_type] || n.note_type}${n.event_time ? ` ${esc(n.event_time)}` : ""}${n.details ? `: ${esc(n.details)}` : ""}</li>`
      )
      .join("") +
    `</ul>`;
}

function renderCalendar() {
  if (!calMonth) {
    const now = new Date();
    calMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  const y = calMonth.getFullYear();
  const m = calMonth.getMonth();
  els.calTitle.textContent = calMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const firstDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = todayStr();

  let html = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    .map((d) => `<div class="cal-dow">${d}</div>`)
    .join("");

  for (let i = 0; i < firstDow; i++) html += `<div class="cal-cell cal-blank"></div>`;

  for (let day = 1; day <= daysInMonth; day++) {
    const iso = dateToStr(new Date(y, m, day));
    const dayNotes = notes.filter((n) => noteInHub(n) && noteOnDay(n, iso));
    const chips = dayNotes
      .slice(0, 4)
      .map(
        (n) =>
          `<div class="cal-chip" style="background:${personColor(n.staff_name).bg};color:${personColor(n.staff_name).fg}" title="${esc(n.staff_name)} — ${TYPE_LABELS[n.note_type]}${n.event_time ? " " + esc(n.event_time) : ""}${n.details ? ": " + esc(n.details) : ""}${n.visibility === "admin" ? " (only visible to you)" : ""}">${n.visibility === "admin" ? "🔒 " : ""}${esc(n.staff_name)}${n.note_type === "meeting" && n.event_time ? " · " + esc(n.event_time) : ""}</div>`
      )
      .join("");
    const more = dayNotes.length > 4 ? `<div class="cal-more">+${dayNotes.length - 4} more</div>` : "";
    html += `<div class="cal-cell ${iso === today ? "cal-today" : ""}" data-date="${iso}">
      <div class="cal-daynum">${day}</div>${chips}${more}
    </div>`;
  }

  els.calGrid.innerHTML = html;

  // color legend: who's who on the calendar
  const legend = $("cal-legend");
  if (legend) {
    legend.innerHTML = hubMembers()
      .map((p) => {
        const c = personColor(p.name);
        return `<span><i class="cal-dot" style="background:${c.fg}"></i>${esc(p.name)}</span>`;
      })
      .join("");
  }
}

els.calPrev.addEventListener("click", () => {
  calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1);
  renderCalendar();
});
els.calNext.addEventListener("click", () => {
  calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1);
  renderCalendar();
});

els.calGrid.addEventListener("click", (e) => {
  const cell = e.target.closest(".cal-cell[data-date]");
  if (!cell) return;
  els.nfStart.value = cell.dataset.date;
  els.nfStart.scrollIntoView({ behavior: "smooth", block: "center" });
  els.nfType.focus();
});

els.showPast.addEventListener("change", renderNotes);

// Editing state: which entry the form is currently updating (null = new entry)
let editingNoteId = null;

function startNoteEdit(n) {
  editingNoteId = n.id;
  els.nfType.value = n.note_type;
  els.nfStart.value = n.start_date;
  els.nfEnd.value = n.end_date || "";
  els.nfTime.value = n.event_time || "";
  els.nfDetails.value = n.details || "";
  $("nf-recur").value = n.recurrence || "none";
  if (myProfile.is_admin) els.nfVis.value = n.visibility || "team";
  $("nf-submit").textContent = "Save Changes";
  $("nf-cancel").classList.remove("hidden");
  setStatus(els.formStatus, `Editing "${TYPE_LABELS[n.note_type] || n.note_type}" for ${n.staff_name} — make your changes above and hit Save.`);
  els.nfStart.scrollIntoView({ behavior: "smooth", block: "center" });
}

function cancelNoteEdit() {
  editingNoteId = null;
  els.form.reset();
  $("nf-submit").textContent = "Post it";
  $("nf-cancel").classList.add("hidden");
  setStatus(els.formStatus, "");
}

$("nf-cancel").addEventListener("click", cancelNoteEdit);

els.notesList.addEventListener("click", async (e) => {
  const editBtn = e.target.closest("button[data-edit]");
  if (editBtn) {
    const n = notes.find((x) => x.id === editBtn.dataset.edit);
    if (n) startNoteEdit(n);
    return;
  }
  const btn = e.target.closest(".note-delete");
  if (!btn) return;
  if (!confirm("Remove this entry?")) return;
  if (btn.dataset.id === editingNoteId) cancelNoteEdit();
  const { error } = await supabase.from("schedule_notes").delete().eq("id", btn.dataset.id);
  if (error) alert(`Couldn't remove it: ${error.message}`);
  await loadNotes();
});

els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setStatus(els.formStatus, "");

  const start = els.nfStart.value;
  const end = els.nfEnd.value || null;
  if (end && end < start) {
    setStatus(els.formStatus, "\"Through\" date can't be before the start date.", true);
    return;
  }

  const row = {
    note_type: els.nfType.value,
    start_date: start,
    end_date: end,
    event_time: els.nfTime.value.trim() || null,
    details: els.nfDetails.value.trim() || null,
    visibility: myProfile.is_admin ? els.nfVis.value : "team",
    recurrence: $("nf-recur").value,
  };

  const { error } = editingNoteId
    ? await supabase.from("schedule_notes").update(row).eq("id", editingNoteId)
    : await supabase.from("schedule_notes").insert({ ...row, staff_name: myProfile.name });

  if (error) {
    setStatus(els.formStatus, `Couldn't ${editingNoteId ? "save" : "post"}: ${error.message}`, true);
    return;
  }
  const wasEditing = !!editingNoteId;
  cancelNoteEdit();
  setStatus(els.formStatus, wasEditing ? "Changes saved! ✔" : "Posted! ✔");
  await loadNotes();
});

// ---------- task board ----------

const RECUR_LABELS = {
  daily: "daily",
  weekdays: "weekdays",
  weekly: "weekly",
  monthly: "monthly",
};

// Next occurrence for a completed recurring task. Advances from the task's due
// date (or today if it had none / was overdue), always landing today or later.
function nextDueDate(task) {
  const today = todayStr();
  const base = task.due_date && task.due_date > today ? task.due_date : today;
  const [y, m, d] = base.split("-").map(Number);
  let next = new Date(y, m - 1, d);

  const addDays = (n) => next.setDate(next.getDate() + n);
  switch (task.recurrence) {
    case "daily":
      addDays(1);
      break;
    case "weekdays":
      addDays(1);
      while (next.getDay() === 0 || next.getDay() === 6) addDays(1);
      break;
    case "weekly":
      addDays(7);
      break;
    case "monthly": {
      const day = next.getDate();
      const lastOfNext = new Date(next.getFullYear(), next.getMonth() + 2, 0).getDate();
      next = new Date(next.getFullYear(), next.getMonth() + 1, Math.min(day, lastOfNext));
      break;
    }
  }
  return dateToStr(next);
}

async function loadTasks() {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) {
    els.colOpen.innerHTML = `<li class="empty">Couldn't load tasks: ${esc(error.message)}</li>`;
    els.colClaimed.innerHTML = "";
    els.colDone.innerHTML = "";
    return;
  }
  tasks = data;
  renderTasks();
  renderReminders();
}

// Opt-in banner: my open tasks + my schedule notes for today
function renderReminders() {
  if (!myProfile?.reminders) {
    els.remindersBanner.classList.add("hidden");
    return;
  }
  const today = todayStr();
  const myTasks = tasks.filter((t) => t.status === "open" && t.assigned_to === myProfile.name);
  const myNotes = notes.filter(
    (n) => n.staff_name === myProfile.name && noteOnDay(n, today)
  );
  if (!myTasks.length && !myNotes.length) {
    els.remindersBanner.classList.add("hidden");
    return;
  }
  const taskLines = myTasks.map((t) => {
    const overdue = t.due_date && t.due_date < today;
    return `<li>${overdue ? "⚠ Overdue: " : ""}<b>${esc(t.title)}</b>${t.due_date ? ` — due ${fmtDate(t.due_date)}` : ""}</li>`;
  });
  const noteLines = myNotes.map(
    (n) => `<li>${TYPE_LABELS[n.note_type] || n.note_type} today${n.event_time ? ` ${esc(n.event_time)}` : ""}${n.details ? `: ${esc(n.details)}` : ""}</li>`
  );
  els.remindersBanner.classList.remove("hidden");
  els.remindersBanner.innerHTML =
    `<strong>🔔 Your reminders:</strong><ul>` + taskLines.join("") + noteLines.join("") + `</ul>`;
}

function taskCard(t) {
  const today = todayStr();
  const overdue = t.status === "open" && t.due_date && t.due_date < today;
  const meta = [
    t.due_date
      ? `<span class="task-due ${overdue ? "overdue" : ""}">${overdue ? "⚠ " : ""}Due ${fmtDate(t.due_date)}</span>`
      : "",
    t.recurrence !== "none" ? `<span class="task-recur">↻ ${RECUR_LABELS[t.recurrence]}</span>` : "",
    t.assigned_to ? `<span class="task-owner">${nameWithAvatar(t.assigned_to)}</span>` : "",
  ]
    .filter(Boolean)
    .join("");

  let actions = "";
  if (t.status === "open") {
    const mine = t.assigned_to && t.assigned_to === myProfile.name;
    // anyone can hand an open task to a teammate on this board's team
    const assignSel = `<select class="team-select" data-assign="${t.id}" title="Assign this task">
          <option value="">Assign to…</option>
          ${staff
            .filter((p) => (curTeam === "support" ? p.support_access || p.is_admin : p.warehouse_access !== false || p.is_admin))
            .map((p) => `<option value="${esc(p.name)}" ${t.assigned_to === p.name ? "selected" : ""}>${esc(p.name)}</option>`)
            .join("")}
        </select>`;
    actions = [
      !t.assigned_to ? `<button class="btn-mini primary" data-act="claim" data-id="${t.id}">Claim</button>` : "",
      `<button class="btn-mini ${t.assigned_to ? "primary" : ""}" data-act="done" data-id="${t.id}">Done ✓</button>`,
      mine ? `<button class="btn-mini" data-act="unclaim" data-id="${t.id}">Unclaim</button>` : "",
      assignSel,
      `<button class="btn-mini danger" data-act="delete" data-id="${t.id}">Remove</button>`,
    ]
      .filter(Boolean)
      .join("");
  } else {
    actions = [
      `<button class="btn-mini" data-act="reopen" data-id="${t.id}">Reopen</button>`,
      `<button class="btn-mini danger" data-act="delete" data-id="${t.id}">Remove</button>`,
    ].join("");
  }

  return `<li class="task-card ${t.status}">
    <div class="task-title">${esc(t.title)}</div>
    ${t.details ? `<div class="task-details">${esc(t.details)}</div>` : ""}
    ${photoThumb(t.photo, true)}
    ${meta ? `<div class="task-meta">${meta}</div>` : ""}
    <div class="task-actions">${actions}</div>
  </li>`;
}

function setTeam(team) {
  curTeam = team;
  document.querySelectorAll(".team-tab").forEach((b) =>
    b.classList.toggle("active", b.dataset.team === team)
  );
  renderTasks();
}

$("team-tabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".team-tab");
  if (btn) setTeam(btn.dataset.team);
});

function renderTasks() {
  const board = tasks.filter((t) => (t.team || "warehouse") === curTeam);
  const open = board.filter((t) => t.status === "open" && !t.assigned_to);
  const claimed = board.filter((t) => t.status === "open" && t.assigned_to);
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const done = board
    .filter((t) => t.status === "done" && (t.completed_at || "") >= weekAgo)
    .sort((a, b) => (b.completed_at || "").localeCompare(a.completed_at || ""));

  els.colOpen.innerHTML = open.length
    ? open.map(taskCard).join("")
    : `<li class="empty">Nothing waiting — nice.</li>`;
  els.colClaimed.innerHTML = claimed.length
    ? claimed.map(taskCard).join("")
    : `<li class="empty">Nothing claimed right now.</li>`;
  els.colDone.innerHTML = done.length
    ? done.map(taskCard).join("")
    : `<li class="empty">Nothing finished this week yet.</li>`;
  els.countOpen.textContent = open.length ? `(${open.length})` : "";
  els.countClaimed.textContent = claimed.length ? `(${claimed.length})` : "";
}

async function taskAction(act, id) {
  const t = tasks.find((x) => x.id === id);
  if (!t) return;

  if (act === "claim") {
    await supabase.from("tasks").update({ assigned_to: myProfile.name }).eq("id", id);
  } else if (act === "unclaim") {
    await supabase.from("tasks").update({ assigned_to: null }).eq("id", id);
  } else if (act === "done") {
    await supabase
      .from("tasks")
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("id", id);
    if (t.recurrence !== "none") {
      await supabase.from("tasks").insert({
        team: t.team || "warehouse",
        title: t.title,
        details: t.details,
        due_date: nextDueDate(t),
        recurrence: t.recurrence,
        assigned_to: null,
      });
    }
  } else if (act === "reopen") {
    await supabase.from("tasks").update({ status: "open", completed_at: null }).eq("id", id);
  } else if (act === "delete") {
    const extra = t.recurrence !== "none" ? " This is a recurring task — removing it stops it from coming back." : "";
    if (!confirm(`Remove "${t.title}"?${extra}`)) return;
    await supabase.from("tasks").delete().eq("id", id);
  }
  await loadTasks();
}

$("tasks").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (btn) taskAction(btn.dataset.act, btn.dataset.id);
});

// anyone reassigns an open task to a teammate from the card's dropdown
$("tasks").addEventListener("change", async (e) => {
  const sel = e.target.closest("select[data-assign]");
  if (!sel) return;
  const { error } = await supabase
    .from("tasks")
    .update({ assigned_to: sel.value || null })
    .eq("id", sel.dataset.assign);
  if (error) alert(`Couldn't assign: ${error.message}`);
  await loadTasks();
});

els.taskForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setStatus(els.taskStatus, "");

  const { error } = await supabase.from("tasks").insert({
    team: curTeam,
    title: els.tfTitle.value.trim(),
    due_date: els.tfDue.value || null,
    recurrence: els.tfRecurrence.value,
    assigned_to: els.tfAssign.value || null,
    details: els.tfDetails.value.trim() || null,
    photo: tfPhoto.uri,
    created_by: myProfile.name,
  });

  if (error) {
    setStatus(els.taskStatus, `Couldn't add it: ${error.message}`, true);
    return;
  }
  setStatus(els.taskStatus, "Task added! ✔");
  els.taskForm.reset();
  tfPhoto.clear();
  await loadTasks();
});

// ---------- presence (from today's punches) ----------

function presenceOf(profileId) {
  const today = todayStr();
  const [start, end] = dayRange(today);
  const mine = punches.filter(
    (p) => p.profile_id === profileId && p.punched_at >= start && p.punched_at < end
  );
  const last = mine.length ? mine[mine.length - 1].punch_type : "none";
  if (last === "in" || last === "lunch-in") return "in";
  if (last === "lunch-out") return "lunch";
  return "out";
}

// ---------- messages (team roster + chats) ----------

let currentThreadId = null;

function threadSeenKey(memberId) {
  return `jfk-msg-seen-${myProfile.id}-${memberId}`;
}

function threadUnread(memberId) {
  const lastSeen = localStorage.getItem(threadSeenKey(memberId)) || "";
  return messages.some(
    (m) =>
      m.member_id === memberId &&
      m.created_at > lastSeen &&
      (myProfile.is_admin ? !m.from_admin : m.from_admin)
  );
}

function currentThreadMemberId() {
  return myProfile.is_admin ? currentThreadId : myProfile.id;
}

function threadHtml(memberId) {
  const thread = messages.filter((m) => m.member_id === memberId);
  if (!thread.length) return `<li class="empty">No messages yet.</li>`;
  return thread
    .map((m) => {
      const mine = myProfile.is_admin ? m.from_admin : !m.from_admin;
      return `<li class="msg ${mine ? "msg-mine" : "msg-theirs"}">
        <div class="msg-meta">${nameWithAvatar(m.sender_name)} · ${fmtTime(m.created_at)} ${new Date(m.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
        <div class="msg-bubble">${esc(m.body)}</div>
      </li>`;
    })
    .join("");
}

function renderRoster() {
  if (!myProfile?.is_admin) return;
  const members = staff.filter((p) => p.id !== myProfile.id);
  if (!members.length) {
    els.roster.innerHTML = `<li class="empty">No team members yet — invite them in the Admin section below.</li>`;
    return;
  }
  // preserve which chats are open across re-renders
  const open = new Set([...els.roster.querySelectorAll("details[open]")].map((d) => d.dataset.id));
  // ...and preserve any message you're in the middle of typing (incl. cursor)
  const drafts = {};
  let focusDraft = null;
  els.roster.querySelectorAll("form[data-member] textarea").forEach((ta) => {
    const id = ta.closest("form").dataset.member;
    if (ta.value) drafts[id] = ta.value;
    if (document.activeElement === ta) {
      focusDraft = { id, start: ta.selectionStart, end: ta.selectionEnd };
    }
  });

  const item = (p) => {
    return `<li><details class="chat-acc" data-id="${p.id}" ${open.has(p.id) ? "open" : ""}>
      <summary>
        <span class="roster-avatar">${avatarHtml(p)}</span>
        <span class="roster-name">${esc(p.name)}</span>
        ${threadUnread(p.id) ? '<span class="new-chat-pill">New Chat</span>' : ""}
      </summary>
      <div class="chat-body">
        <ul class="msg-thread chat-thread">${threadHtml(p.id)}</ul>
        <form class="msg-form" data-member="${p.id}">
          <textarea rows="1" maxlength="4000" required placeholder="Type a message…"></textarea>
          <button class="btn btn-primary" type="submit">Send</button>
        </form>
      </div>
    </details></li>`;
  };
  els.roster.innerHTML = members.map(item).join("");
  els.roster.querySelectorAll(".chat-thread").forEach((ul) => (ul.scrollTop = ul.scrollHeight));
  // restore in-progress drafts after the re-render
  Object.entries(drafts).forEach(([id, val]) => {
    const ta = els.roster.querySelector(`form[data-member="${id}"] textarea`);
    if (!ta) return;
    ta.value = val;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  });
  if (focusDraft) {
    const ta = els.roster.querySelector(`form[data-member="${focusDraft.id}"] textarea`);
    if (ta) {
      ta.focus();
      ta.setSelectionRange(focusDraft.start, focusDraft.end);
    }
  }
}

// Opening a chat marks it read; sending goes to that member's thread.
els.roster.addEventListener(
  "toggle",
  (e) => {
    const d = e.target;
    if (!d.matches?.("details.chat-acc") || !d.open) return;
    localStorage.setItem(threadSeenKey(d.dataset.id), new Date().toISOString());
    d.querySelector(".new-chat-pill")?.remove();
    const ul = d.querySelector(".chat-thread");
    if (ul) ul.scrollTop = ul.scrollHeight;
    const anyUnread = staff.some((p) => p.id !== myProfile.id && threadUnread(p.id));
    els.msgBadge.classList.toggle("hidden", !anyUnread);
    $("chip-msg-dot").classList.toggle("hidden", !anyUnread);
    updateAppBadge();
  },
  true
);

els.roster.addEventListener("submit", async (e) => {
  const form = e.target.closest("form[data-member]");
  if (!form) return;
  e.preventDefault();
  const input = form.querySelector("textarea");
  const body = input.value.trim();
  if (!body) return;
  const { error } = await supabase.from("messages").insert({
    member_id: form.dataset.member,
    from_admin: true,
    sender_name: myProfile.name,
    body,
  });
  if (error) {
    alert(`Couldn't send: ${error.message}`);
    return;
  }
  input.value = "";
  input.style.height = "";
  localStorage.setItem(threadSeenKey(form.dataset.member), new Date().toISOString());
  await loadMessages();
});

// Message boxes grow as you type (up to ~5 lines) and Enter sends —
// Shift+Enter makes a new line.
document.addEventListener("input", (e) => {
  if (!e.target.matches(".msg-form textarea, #pn-body")) return;
  e.target.style.height = "auto";
  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
});
document.addEventListener("keydown", (e) => {
  if (!e.target.matches(".msg-form textarea")) return;
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    e.target.closest("form").requestSubmit();
  }
});

// Desktop notifications + app-icon badge for new incoming messages.
let lastInboundAt = null; // newest inbound message we've already seen this session

function myInbound() {
  return messages.filter((m) =>
    myProfile.is_admin ? !m.from_admin : m.from_admin && m.member_id === myProfile.id
  );
}

function unreadThreadCount() {
  if (!myProfile) return 0;
  return myProfile.is_admin
    ? staff.filter((p) => p.id !== myProfile.id && threadUnread(p.id)).length
    : threadUnread(myProfile.id) ? 1 : 0;
}

function updateAppBadge() {
  if (!("setAppBadge" in navigator)) return; // installed-app icon bubble (Chrome PWA)
  const n = unreadThreadCount();
  if (n > 0) navigator.setAppBadge(n).catch(() => {});
  else navigator.clearAppBadge?.().catch(() => {});
}

function notifyNewMessages(fresh) {
  if (pushActive) return; // real push notifications already cover these devices
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  fresh.slice(-3).forEach((m) => {
    // skip if she's clearly looking at that conversation right now
    const viewing =
      document.visibilityState === "visible" &&
      (myProfile.is_admin
        ? !!els.roster.querySelector(`details[data-id="${m.member_id}"][open]`)
        : currentPage() === "messages");
    if (viewing) return;
    try {
      const n = new Notification(`💬 New message from ${m.sender_name}`, {
        body: m.body.slice(0, 140),
        icon: "icons/icon-192.png",
        tag: `jfk-msg-${m.member_id}`, // one banner per conversation
      });
      n.onclick = () => {
        window.focus();
        location.hash = "#messages";
        n.close();
      };
    } catch {}
  });
}

async function loadMessages() {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .order("created_at");
  if (error) {
    els.msgThread.innerHTML = `<li class="empty">Couldn't load messages: ${esc(error.message)}</li>`;
    return;
  }
  messages = data;
  renderRoster();
  renderThread();

  // banner for anything that arrived since the last check (not on first load)
  const inbound = myInbound();
  const newest = inbound.length ? inbound[inbound.length - 1].created_at : "";
  if (lastInboundAt !== null && newest > lastInboundAt) {
    notifyNewMessages(inbound.filter((m) => m.created_at > lastInboundAt));
  }
  lastInboundAt = newest;

  const anyUnread = unreadThreadCount() > 0;
  els.msgBadge.classList.toggle("hidden", !anyUnread);
  $("chip-msg-dot").classList.toggle("hidden", !anyUnread);
  updateAppBadge();
}

// Check for new messages on a timer so banners arrive without a refresh.
// Skipped while the tab is backgrounded — push notifications already cover
// that case, so there's no need to keep polling underneath a hidden tab.
setInterval(() => {
  if (myProfile && document.visibilityState === "visible") loadMessages();
}, 45_000);

function renderThread() {
  if (myProfile.is_admin) return; // admin uses the per-contact accordions
  const memberId = currentThreadMemberId();
  const thread = messages.filter((m) => m.member_id === memberId);
  if (!memberId || !thread.length) {
    els.msgThread.innerHTML = `<li class="empty">No messages yet${myProfile.is_admin ? "" : " — say hi!"}</li>`;
  } else {
    const iAmAdmin = myProfile.is_admin;
    els.msgThread.innerHTML = thread
      .map((m) => {
        const mine = iAmAdmin ? m.from_admin : !m.from_admin;
        return `<li class="msg ${mine ? "msg-mine" : "msg-theirs"}">
          <div class="msg-meta">${nameWithAvatar(m.sender_name)} · ${fmtTime(m.created_at)} ${new Date(m.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
          <div class="msg-bubble">${esc(m.body)}</div>
        </li>`;
      })
      .join("");
    els.msgThread.scrollTop = els.msgThread.scrollHeight;
  }
  if (memberId) {
    localStorage.setItem(threadSeenKey(memberId), new Date().toISOString());
  }
}

els.msgRefresh.addEventListener("click", () => {
  loadPunches();
  loadMessages();
});

els.msgForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setStatus(els.msgStatus, "");
  const memberId = currentThreadMemberId();
  if (!memberId) {
    setStatus(els.msgStatus, "No conversation selected.", true);
    return;
  }
  const { error } = await supabase.from("messages").insert({
    member_id: memberId,
    from_admin: myProfile.is_admin,
    sender_name: myProfile.name,
    body: els.msgBody.value.trim(),
  });
  if (error) {
    setStatus(els.msgStatus, `Couldn't send: ${error.message}`, true);
    return;
  }
  els.msgForm.reset();
  els.msgBody.style.height = "";
  await loadMessages();
});

// ---------- admin ----------

async function loadAdmin() {
  if (!myProfile.is_admin) return;
  const { data, error } = await supabase
    .from("invited_emails")
    .select("*")
    .order("invited_at");
  if (error) {
    els.inviteList.innerHTML = `<li class="empty">Couldn't load: ${esc(error.message)}</li>`;
    return;
  }
  invites = data;
  renderAdmin();
}

function renderAdmin() {
  const memberEmails = new Set(staff.map((p) => p.email));
  const pending = invites.filter((i) => !memberEmails.has(i.email));

  const teamBadge = (sup, wh) => {
    if (sup && wh !== false) return '<span class="role-badge role-full-time">WH</span><span class="role-badge role-part-time">CS</span>';
    if (sup) return '<span class="role-badge role-part-time">CS</span>';
    return '<span class="role-badge role-full-time">WH</span>';
  };
  const teamValue = (p) =>
    p.support_access && p.warehouse_access !== false ? "both" : p.support_access ? "support" : "warehouse";

  els.inviteList.innerHTML = pending.length
    ? pending
        .map(
          (i) => `<li>
            <span>${esc(i.email)}
              ${i.is_admin ? '<span class="role-badge badge-admin">ADMIN</span>' : teamBadge(i.support_access)}</span>
            <button class="btn-mini danger" data-uninvite="${esc(i.email)}">Remove</button>
          </li>`
        )
        .join("")
    : `<li class="empty">No pending invites.</li>`;

  // tap a name to open their team setting + Remove button
  const openMembers = new Set([...els.memberList.querySelectorAll("details[open]")].map((d) => d.dataset.id));
  const memberOrder = [...staff].sort((a, b) => (b.is_admin ? 1 : 0) - (a.is_admin ? 1 : 0));
  els.memberList.innerHTML = memberOrder.length
    ? memberOrder
        .map((p) => {
          const summary = `${nameWithAvatar(p.name)}
              <span class="role-badge role-${p.role}">${p.role === "full-time" ? "FT" : "PT"}</span>
              ${p.is_admin ? '<span class="role-badge badge-admin">ADMIN</span>' : teamBadge(p.support_access, p.warehouse_access)}`;
          if (p.is_admin) return `<li><span class="member-plain">${summary}</span></li>`;
          return `<li><details class="member-acc" data-id="${p.id}" ${openMembers.has(p.id) ? "open" : ""}>
            <summary>${summary}</summary>
            <div class="member-body">
              <select class="team-select" data-teamsel="${p.id}">
                <option value="warehouse" ${teamValue(p) === "warehouse" ? "selected" : ""}>Warehouse</option>
                <option value="support" ${teamValue(p) === "support" ? "selected" : ""}>Cust. Support</option>
                <option value="both" ${teamValue(p) === "both" ? "selected" : ""}>Both</option>
              </select>
              <button class="btn-mini danger" data-unmember="${p.id}" data-email="${esc(p.email)}" data-name="${esc(p.name)}">Remove</button>
            </div>
          </details></li>`;
        })
        .join("")
    : `<li class="empty">No members yet.</li>`;
}

els.inviteForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = els.invEmail.value.trim().toLowerCase();
  setStatus(els.inviteStatus, "");
  const team = $("inv-team").value;
  const { error } = await supabase.from("invited_emails").insert({
    email,
    is_admin: false,
    support_access: team === "support" || team === "both",
    warehouse_access: team === "warehouse" || team === "both",
  });
  if (error) {
    const msg = error.code === "23505" ? "That email is already on the list." : error.message;
    setStatus(els.inviteStatus, `Couldn't add: ${msg}`, true);
    return;
  }
  setStatus(els.inviteStatus, `${email} added — they can now create their account on this site. ✔`);
  els.inviteForm.reset();
  await loadAdmin();
});

els.adminSection.addEventListener("change", async (e) => {
  const sel = e.target.closest("select[data-teamsel]");
  if (!sel) return;
  const v = sel.value;
  const { error } = await supabase
    .from("profiles")
    .update({
      support_access: v === "support" || v === "both",
      warehouse_access: v === "warehouse" || v === "both",
    })
    .eq("id", sel.dataset.teamsel);
  if (error) alert(`Couldn't update: ${error.message}`);
  await loadStaff();
  renderAdmin();
  renderRoster();
  renderSchedules();
  renderPunchTable();
  renderHoursTable();
});

els.adminSection.addEventListener("click", async (e) => {
  const uninvite = e.target.closest("button[data-uninvite]");
  if (uninvite) {
    if (!confirm(`Remove the invite for ${uninvite.dataset.uninvite}?`)) return;
    await supabase.from("invited_emails").delete().eq("email", uninvite.dataset.uninvite);
    await loadAdmin();
    return;
  }
  const unmember = e.target.closest("button[data-unmember]");
  if (unmember) {
    if (!confirm(`Remove ${unmember.dataset.name} from the hub? Their profile, schedule, punches, and messages are deleted and they can't sign in to it anymore.`)) return;
    await supabase.from("profiles").delete().eq("id", unmember.dataset.unmember);
    await supabase.from("invited_emails").delete().eq("email", unmember.dataset.email);
    await loadStaff();
    await Promise.all([loadHours(), loadAdmin(), loadMessages(), loadPunches()]);
  }
});

// ---------- shift clock-in / clock-out reminders ----------

// Parses freeform hours like "8:00 AM – 4:30 PM", "8:00-4:30", "9–1", "12:30 PM-4:30 PM".
function parseShift(str) {
  const m = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–—]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i.exec(str || "");
  if (!m) return null;
  let sh = parseInt(m[1], 10) % 12;
  if ((m[3] || "").toLowerCase() === "pm") sh += 12;
  let eh = parseInt(m[4], 10) % 12;
  if ((m[6] || "").toLowerCase() === "pm") eh += 12;
  let start = sh * 60 + (m[2] ? parseInt(m[2], 10) : 0);
  let end = eh * 60 + (m[5] ? parseInt(m[5], 10) : 0);
  if (!m[6] && end <= start) end += 12 * 60; // "8:00-4:30" with no meridiem → 4:30 PM
  if (end <= start) return null;
  return { start, end };
}

function fmtMinutes(mins) {
  const h24 = Math.floor(mins / 60) % 24;
  const mm = String(mins % 60).padStart(2, "0");
  const h12 = h24 % 12 || 12;
  return `${h12}:${mm} ${h24 < 12 ? "AM" : "PM"}`;
}

function showToast(text) {
  document.querySelector(".toast")?.remove();
  const div = document.createElement("div");
  div.className = "toast";
  div.innerHTML = `<span>${esc(text)}</span><button aria-label="Dismiss">✕</button>`;
  div.querySelector("button").addEventListener("click", () => div.remove());
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 90_000);
  if ("Notification" in window && Notification.permission === "granted") {
    try { new Notification("JFK Warehouse Hub", { body: text }); } catch {}
  }
}

function checkShiftReminders() {
  if (!FEATURE_TIME_CLOCK) return;
  if (!myProfile) return;
  const dayIdx = new Date().getDay(); // 1–5 = Mon–Fri
  if (dayIdx < 1 || dayIdx > 5) return;
  const hoursStr = (hoursById[myProfile.id] || {})[DAYS[dayIdx - 1]];
  const shift = parseShift(hoursStr);
  if (!shift) return;

  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const today = todayStr();
  const mine = punches.filter((p) => {
    const [s, e] = dayRange(today);
    return p.profile_id === myProfile.id && p.punched_at >= s && p.punched_at < e;
  });
  const hasIn = mine.some((p) => p.punch_type === "in");
  const hasOut = mine.some((p) => p.punch_type === "out");

  const inKey = `jfk-rem-in-${today}-${myProfile.id}`;
  const outKey = `jfk-rem-out-${today}-${myProfile.id}`;

  if (!hasIn && nowMins >= shift.start - 5 && nowMins < shift.start + 10 && !localStorage.getItem(inKey)) {
    localStorage.setItem(inKey, "1");
    showToast(`⏰ Your shift starts at ${fmtMinutes(shift.start)} — remember to clock in!`);
  }
  if (hasIn && !hasOut && nowMins >= shift.end - 5 && nowMins < shift.end + 10 && !localStorage.getItem(outKey)) {
    localStorage.setItem(outKey, "1");
    showToast(`🏁 Your shift ends at ${fmtMinutes(shift.end)} — remember to clock out!`);
  }
}

setInterval(() => {
  checkShiftReminders();
}, 30_000);

// Ask for notification permission once, after login, so reminders can pop
// even when the tab is in the background.
function maybeAskNotifications() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().then((p) => {
      if (p === "granted") enablePush();
    }).catch(() => {});
  }
}

// ---------- push notifications (arrive even when the app is closed) ----------

const VAPID_PUBLIC_KEY = "BDi981JGUQQj-XjQ61ONOw7Mq2T2m3KIJKJN2G_tgtwBYyAyF57sPxTvC_OwWZrWOzmszV5tJPXATI5zGDNFHd0";

function urlB64ToUint8Array(s) {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...b].map((c) => c.charCodeAt(0)));
}

// Register this device for pushes and save its subscription under my profile.
let pushActive = false; // when true, real push handles banners — skip in-app ones
async function enablePush() {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (!myProfile || Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker.register("sw.js");
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    const { error } = await supabase.from("push_subscriptions").upsert(
      { profile_id: myProfile.id, endpoint: sub.endpoint, subscription: sub.toJSON() },
      { onConflict: "endpoint" }
    );
    if (error) {
      showToast(`Couldn't save notification setup: ${error.message}`);
      return;
    }
    pushActive = true;
  } catch (err) {
    // push isn't supported everywhere (e.g. iPhone browser tab) — usually fine,
    // but surface real failures so they're not invisible
    if (Notification.permission === "granted" && err?.message) {
      showToast(`Notification setup problem: ${String(err.message).slice(0, 90)}`);
    }
  }
}

// Show the "Turn On Notifications" banner when this device isn't registered yet.
async function updateNotifBanner() {
  const el = $("notif-banner");
  if (!el) return;
  let show = false;
  if (
    myProfile &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    Notification.permission !== "denied"
  ) {
    if (Notification.permission === "default") {
      show = true;
    } else {
      const reg = await navigator.serviceWorker.getRegistration().catch(() => null);
      const sub = reg ? await reg.pushManager.getSubscription().catch(() => null) : null;
      if (!sub) {
        show = true;
      } else {
        // browser thinks it's subscribed — make sure the hub actually has it on file
        const { data } = await supabase
          .from("push_subscriptions")
          .select("id")
          .eq("endpoint", sub.endpoint)
          .maybeSingle();
        show = !data;
      }
    }
  }
  el.classList.toggle("hidden", !show);
}

// Hidden self-test: click the version number in the footer to make THIS device
// show a banner locally (no push involved) — separates display problems from
// delivery problems.
document.querySelector(".site-footer .wrap").addEventListener("click", async () => {
  if (!myProfile || !("Notification" in window)) return;
  if (Notification.permission !== "granted") {
    showToast("Notifications aren't allowed in this browser yet.");
    return;
  }
  const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration().catch(() => null) : null;
  if (reg) {
    reg.showNotification("Local test from this device", {
      body: "If you can see this banner, your computer can display them.",
      icon: "icons/icon-192.png",
    });
  } else {
    try { new Notification("Local test from this device", { body: "If you can see this banner, your computer can display them." }); } catch {}
  }
  showToast("Local test banner sent — did it appear?");
});

$("notif-enable").addEventListener("click", async () => {
  try {
    const p = await Notification.requestPermission();
    if (p === "granted") {
      await enablePush();
      showToast("Notifications are on for this device 🔔");
    } else if (p === "denied") {
      alert("Notifications are blocked for this site in your browser settings — allow them there, then tap this again.");
    }
  } catch {}
  updateNotifBanner();
});

// ---------- page routing (nav buttons = pages; logo = homepage) ----------

const PAGE_ROUTES = ["home", "clock", "calendar", "schedules", "announcements", "tasks", "restocking", "checklists", "supplies", "mynotes", "messages", "admin"];
if (!FEATURE_TIME_CLOCK) PAGE_ROUTES.splice(PAGE_ROUTES.indexOf("clock"), 1); // #clock falls back to home
const HOME_ONLY = ["today-callout", "reminders"];
const MAIN_SECTIONS = ["today-callout", "reminders", "sick-note", "clock", "calendar", "schedules", "announcements", "tasks", "restocking", "checklists", "supplies", "mynotes"];

function currentPage() {
  const h = (location.hash || "#home").slice(1);
  return PAGE_ROUTES.includes(h) ? h : "home";
}

function applyPage() {
  const page = currentPage();
  const isHome = page === "home";
  const sidebarOnly = page === "messages" || page === "admin";

  MAIN_SECTIONS.forEach((id) => {
    const el = $(id);
    if (!el) return;
    const show = isHome
      ? true
      : !sidebarOnly && !HOME_ONLY.includes(id) && (page === id || (page === "calendar" && id === "sick-note"));
    el.classList.toggle("route-hidden", !show);
  });
  document.querySelector(".layout").classList.toggle("sidebar-only", sidebarOnly);
  // In sidebar-only mode, show just the requested card(s):
  // Admin Messages → chats only; Admin → invitations + hours.
  ["messages", "admin", "hours-card", "warnings-card"].forEach((id) => {
    const el = $(id);
    if (!el) return;
    const show = !sidebarOnly || (page === "messages" ? id === "messages" : id !== "messages");
    el.classList.toggle("route-hidden", !show);
    // On a dedicated page, always arrive with the card(s) open;
    // back home, restore each card's remembered collapsed state.
    if (sidebarOnly && show) el.classList.remove("collapsed");
    else if (!sidebarOnly) el.classList.toggle("collapsed", localStorage.getItem(`jfk-collapse-${id}`) === "1");
  });
  document.querySelectorAll(".site-nav a").forEach((a) =>
    a.classList.toggle("active", a.getAttribute("href") === "#" + page)
  );
  if (page === "admin") $("admin").scrollIntoView?.();
  else window.scrollTo({ top: 0 });
}

window.addEventListener("hashchange", applyPage);

// ---------- collapsible sidebar cards ----------

["messages", "admin", "hours-card", "warnings-card"].forEach((id) => {
  const card = $(id);
  const head = card?.querySelector(".card-head");
  if (!head) return;
  const key = `jfk-collapse-${id}`;
  if (localStorage.getItem(key) === "1") card.classList.add("collapsed");
  head.addEventListener("click", (e) => {
    if (e.target.closest("button, a, select, input")) return; // don't hijack real controls
    card.classList.toggle("collapsed");
    localStorage.setItem(key, card.classList.contains("collapsed") ? "1" : "0");
  });
});

// ---------- init ----------

route();
applyPage();
