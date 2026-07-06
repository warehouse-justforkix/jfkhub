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
  punchTableBody: document.querySelector("#punch-table tbody"),
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
  tfDetails: $("tf-details"),
  tfRecurrence: $("tf-recurrence"),
  tfAssign: $("tf-assign"),
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

let session = null;
let myProfile = null;
let staff = [];        // all profiles (names/roles — no hours)
let hoursById = {};    // member_hours visible to me (mine, or everyone's if admin)
let notes = [];
let tasks = [];
let invites = [];
let punches = [];      // punches visible to me for the selected day
let messages = [];
let editing = false;
let calMonth = null;   // Date, first of displayed month
let curTeam = "warehouse";
let curHub = localStorage.getItem("jfk-hub") === "support" ? "support" : "warehouse";

// Members belonging to the currently selected hub.
function hubMembers() {
  return curHub === "support" ? staff.filter((p) => p.support_access || p.is_admin) : staff;
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
  setTeam(hub);          // task board follows the hub
  renderSchedules();
  renderPunchTable();
  renderHoursTable();
  renderChecklists();
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
    els.punchAdmin.classList.toggle("hidden", !admin);
    els.msgTitle.textContent = admin ? "Team & Chats" : "Message Karley";
    els.msgHint.textContent = admin
      ? "Your team — tap a person to open their private chat."
      : "Private line to the admins — only you and they can see this thread.";
    els.roster.classList.toggle("hidden", !admin);
    $("msg-admin-badge").classList.toggle("hidden", !admin);
    els.clAdminForm.classList.toggle("hidden", !admin);
    $("hub-toggle").classList.toggle("hidden", !admin);
    $("hours-card").classList.toggle("hidden", !admin);
    if (!admin) curHub = prof.support_access ? "support" : "warehouse";
    showView(els.appView);
    await loadEverything();
    setHub(curHub);
    maybeAskNotifications();
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
  const hours = hoursById[myProfile.id] || {};
  DAYS.forEach((d) => ($(`pf-${d}`).value = hours[d] || ""));
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
    name: els.pfName.value.trim(),
    role: els.pfRole.value,
    avatar: els.pfAvatar.value.trim() || "🙂",
    avatar_options: avatarOptions,
    reminders: els.pfReminders.checked,
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
    loadPunches(),
    loadWeekPunches(),
    loadAnnouncements(),
    loadMessages(),
    loadChecklists(),
    loadSupplies(),
    loadWarnings(),
    loadAdmin(),
  ]);
}

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
      <span class="cl-by" style="color:var(--ink-soft)">· ${esc(s.requested_by)}</span></span>
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
}

$("sup-add").addEventListener("click", async () => {
  const item = $("sup-item").value.trim();
  if (!item) return;
  const { error } = await supabase.from("supply_requests").insert({
    item,
    note: $("sup-note").value.trim() || null,
    requested_by: myProfile.name,
  });
  if (error) {
    setStatus($("sup-status"), `Couldn't add: ${error.message}`, true);
    return;
  }
  $("sup-item").value = "";
  $("sup-note").value = "";
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
            <span class="cl-label">${esc(i.label)}</span>
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
  });
  if (error) {
    setStatus(els.clStatus, `Couldn't add: ${error.message}`, true);
    return;
  }
  els.clLabel.value = "";
  await loadChecklists();
});

// ---------- time clock ----------

const PUNCH_ORDER = ["in", "lunch-out", "lunch-in", "out"];
const PUNCH_LABELS = {
  in: "Clock in",
  "lunch-out": "Out to lunch",
  "lunch-in": "Back from lunch",
  out: "Clock out",
};
const STATUS_AFTER = {
  none: { label: "Not in yet", cls: "st-out" },
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

function renderPunchTable() {
  if (!myProfile.is_admin) return;
  const byMember = {};
  punches.forEach((p) => {
    (byMember[p.profile_id] = byMember[p.profile_id] || {})[p.punch_type] = p.punched_at;
  });
  els.punchTableBody.innerHTML = hubMembers()
    .map((s) => {
      const mine = byMember[s.id] || {};
      const lastType = [...PUNCH_ORDER].reverse().find((t) => mine[t]) || "none";
      const status = STATUS_AFTER[lastType];
      const cells = PUNCH_ORDER.map(
        (t) => `<td>${mine[t] ? fmtTime(mine[t]) : '<span class="cell-off">—</span>'}</td>`
      ).join("");
      return `<tr>
        <td class="name-col"><span class="staff-name">${nameWithAvatar(s.name)}</span></td>
        <td><span class="clock-state ${status.cls}">${status.label}</span></td>
        ${cells}
      </tr>`;
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
    await loadPunches();
    loadWeekPunches();
  })
);

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
  const tbody = document.querySelector("#hours-table tbody");
  if (!tbody || !myProfile?.is_admin) return;
  const monday = weekPeriod();
  const [my, mm, md] = monday.split("-").map(Number);
  const today = todayStr();

  tbody.innerHTML = hubMembers()
    .map((p) => {
      let total = 0;
      const cells = DAYS.map((day, i) => {
        const date = dateToStr(new Date(my, mm - 1, md + i));
        if (date > today) return `<td class="cell-off">—</td>`;
        const [s, e] = dayRange(date);
        const dayPunches = weekPunches.filter(
          (x) => x.profile_id === p.id && x.punched_at >= s && x.punched_at < e
        );
        const w = workedMinutes(dayPunches);
        total += w.mins;
        if (!w.any) return `<td class="cell-off">—</td>`;
        return `<td>${fmtHM(w.mins)}${w.open ? '<span class="hrs-open" title="Still clocked in">…</span>' : ""}</td>`;
      }).join("");

      const hours = hoursById[p.id] || {};
      const schedMins = DAYS.reduce((sum, day) => {
        const sh = parseShift(hours[day]);
        return sum + (sh ? sh.end - sh.start : 0);
      }, 0);
      const short = schedMins > 0 && total < schedMins;
      return `<tr>
        <td class="name-col"><span class="staff-name">${nameWithAvatar(p.name)}</span></td>
        ${cells}
        <td><b class="${short ? "hrs-short" : "hrs-ok"}">${fmtHM(total)}</b></td>
        <td>${schedMins ? fmtHM(schedMins) : '<span class="cell-off">—</span>'}</td>
      </tr>`;
    })
    .join("");
}

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
  });
  if (error) {
    setStatus(els.annStatus, `Couldn't post: ${error.message}`, true);
    return;
  }
  els.annForm.reset();
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
  return hubMembers();
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
  const visible = notes.filter((n) => showPast || noteEnd(n) >= today);

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
        <span class="note-name">${esc(n.staff_name)}</span>
        ${n.event_time ? `<span class="note-details">${esc(n.event_time)}</span>` : ""}
        ${n.details ? `<span class="note-details">${esc(n.details)}</span>` : ""}
        <button class="note-delete" data-id="${n.id}" title="Remove this entry" aria-label="Remove entry">✕</button>
      </li>`;
    })
    .join("");
}

function renderTodayCallout() {
  const today = todayStr();
  const todays = notes.filter((n) => n.start_date <= today && noteEnd(n) >= today);
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
    const dayNotes = notes.filter((n) => n.start_date <= iso && noteEnd(n) >= iso);
    const chips = dayNotes
      .slice(0, 4)
      .map(
        (n) =>
          `<div class="cal-chip type-${n.note_type}" title="${esc(n.staff_name)} — ${TYPE_LABELS[n.note_type]}${n.event_time ? " " + esc(n.event_time) : ""}${n.details ? ": " + esc(n.details) : ""}">${esc(n.staff_name)}${n.note_type === "meeting" && n.event_time ? " · " + esc(n.event_time) : ""}</div>`
      )
      .join("");
    const more = dayNotes.length > 4 ? `<div class="cal-more">+${dayNotes.length - 4} more</div>` : "";
    html += `<div class="cal-cell ${iso === today ? "cal-today" : ""}" data-date="${iso}">
      <div class="cal-daynum">${day}</div>${chips}${more}
    </div>`;
  }

  els.calGrid.innerHTML = html;
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

els.notesList.addEventListener("click", async (e) => {
  const btn = e.target.closest(".note-delete");
  if (!btn) return;
  if (!confirm("Remove this entry?")) return;
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

  const { error } = await supabase.from("schedule_notes").insert({
    staff_name: myProfile.name,
    note_type: els.nfType.value,
    start_date: start,
    end_date: end,
    event_time: els.nfTime.value.trim() || null,
    details: els.nfDetails.value.trim() || null,
  });

  if (error) {
    setStatus(els.formStatus, `Couldn't post: ${error.message}`, true);
    return;
  }
  setStatus(els.formStatus, "Posted! ✔");
  els.form.reset();
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
    (n) => n.staff_name === myProfile.name && n.start_date <= today && noteEnd(n) >= today
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
    actions = [
      !t.assigned_to ? `<button class="btn-mini primary" data-act="claim" data-id="${t.id}">Claim</button>` : "",
      `<button class="btn-mini ${t.assigned_to ? "primary" : ""}" data-act="done" data-id="${t.id}">Done ✓</button>`,
      mine ? `<button class="btn-mini" data-act="unclaim" data-id="${t.id}">Unclaim</button>` : "",
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

els.taskForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setStatus(els.taskStatus, "");

  const { error } = await supabase.from("tasks").insert({
    team: curTeam,
    title: els.tfTitle.value.trim(),
    details: els.tfDetails.value.trim() || null,
    due_date: els.tfDue.value || null,
    recurrence: els.tfRecurrence.value,
    assigned_to: els.tfAssign.value || null,
  });

  if (error) {
    setStatus(els.taskStatus, `Couldn't add it: ${error.message}`, true);
    return;
  }
  setStatus(els.taskStatus, "Task added! ✔");
  els.taskForm.reset();
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

function renderRoster() {
  if (!myProfile?.is_admin) return;
  const members = staff.filter((p) => p.id !== myProfile.id);
  if (!members.length) {
    els.roster.innerHTML = `<li class="empty">No team members yet — invite them in the Admin section below.</li>`;
    return;
  }
  if (!currentThreadId || !members.some((m) => m.id === currentThreadId)) {
    currentThreadId = members[0].id;
  }
  const item = (p) => {
    const presence = presenceOf(p.id);
    return `<li class="roster-item ${p.id === currentThreadId ? "active" : ""}" data-id="${p.id}">
      <span class="roster-avatar presence-${presence}">${avatarHtml(p)}</span>
      <span class="roster-name">${esc(p.name)}</span>
      ${threadUnread(p.id) ? '<span class="unread-dot">●</span>' : ""}
    </li>`;
  };
  const warehouse = members.filter((p) => !p.support_access);
  const support = members.filter((p) => p.support_access);
  els.roster.innerHTML =
    (warehouse.length
      ? `<li class="roster-group">Warehouse Team</li>` + warehouse.map(item).join("")
      : "") +
    (support.length
      ? `<li class="roster-group">Customer Support Team</li>` + support.map(item).join("")
      : "");
}

els.roster.addEventListener("click", (e) => {
  const item = e.target.closest(".roster-item");
  if (!item) return;
  currentThreadId = item.dataset.id;
  renderThread();
  renderRoster();
});

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

  const anyUnread = myProfile.is_admin
    ? staff.some((p) => p.id !== myProfile.id && threadUnread(p.id))
    : threadUnread(myProfile.id);
  els.msgBadge.classList.toggle("hidden", !anyUnread);
}

function renderThread() {
  const memberId = currentThreadMemberId();
  if (myProfile.is_admin) {
    const person = staff.find((p) => p.id === memberId);
    els.threadWith.classList.toggle("hidden", !person);
    if (person) els.threadWith.innerHTML = `Chat with ${nameWithAvatar(person.name)}`;
  }
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

  const teamBadge = (isSupport) =>
    isSupport
      ? '<span class="role-badge role-part-time">CS</span>'
      : '<span class="role-badge role-full-time">WH</span>';

  els.inviteList.innerHTML = pending.length
    ? pending
        .map(
          (i) => `<li>
            <span>${esc(i.email)}
              ${i.is_admin ? '<span class="role-badge role-full-time">ADMIN</span>' : teamBadge(i.support_access)}</span>
            <button class="btn-mini danger" data-uninvite="${esc(i.email)}">Remove</button>
          </li>`
        )
        .join("")
    : `<li class="empty">No pending invites.</li>`;

  els.memberList.innerHTML = staff.length
    ? staff
        .map(
          (p) => `<li>
            <span>${nameWithAvatar(p.name)}
              <span class="role-badge role-${p.role}">${p.role === "full-time" ? "FT" : "PT"}</span>
              ${p.is_admin ? '<span class="role-badge role-full-time">ADMIN</span>' : teamBadge(p.support_access)}
            </span>
            <span class="admin-actions">
              ${p.is_admin ? "" : `<button class="btn-mini" data-supacc="${p.id}" data-current="${p.support_access}">${p.support_access ? "Move to WH" : "Move to CS"}</button>`}
              ${p.id !== myProfile.id ? `<button class="btn-mini danger" data-unmember="${p.id}" data-email="${esc(p.email)}" data-name="${esc(p.name)}">Remove</button>` : ""}
            </span>
          </li>`
        )
        .join("")
    : `<li class="empty">No members yet.</li>`;
}

els.inviteForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = els.invEmail.value.trim().toLowerCase();
  setStatus(els.inviteStatus, "");
  const { error } = await supabase.from("invited_emails").insert({
    email,
    is_admin: false,
    support_access: $("inv-team").value === "support",
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

els.adminSection.addEventListener("click", async (e) => {
  const supacc = e.target.closest("button[data-supacc]");
  if (supacc) {
    const grant = supacc.dataset.current !== "true";
    const { error } = await supabase
      .from("profiles")
      .update({ support_access: grant })
      .eq("id", supacc.dataset.supacc);
    if (error) alert(`Couldn't update: ${error.message}`);
    await loadStaff();
    renderAdmin();
    if (supacc.dataset.supacc === myProfile.id) route();
    return;
  }
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
    Notification.requestPermission().catch(() => {});
  }
}

// ---------- page routing (nav buttons = pages; logo = homepage) ----------

const PAGE_ROUTES = ["home", "clock", "calendar", "schedules", "announcements", "tasks", "checklists", "supplies", "messages", "admin"];
const HOME_ONLY = ["today-callout", "reminders", "warnings-card"];
const MAIN_SECTIONS = ["today-callout", "reminders", "clock", "calendar", "schedules", "announcements", "tasks", "checklists", "supplies", "warnings-card"];

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
    const show = isHome ? true : !sidebarOnly && page === id && !HOME_ONLY.includes(id);
    el.classList.toggle("route-hidden", !show);
  });
  document.querySelector(".layout").classList.toggle("sidebar-only", sidebarOnly);
  document.querySelectorAll(".site-nav a").forEach((a) =>
    a.classList.toggle("active", a.getAttribute("href") === "#" + page)
  );
  if (page === "admin") $("admin").scrollIntoView?.();
  else window.scrollTo({ top: 0 });
}

window.addEventListener("hashchange", applyPage);

// ---------- init ----------

route();
applyPage();
