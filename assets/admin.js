import {
  makeSlug,
  supabase,
  supabaseConfigured,
  uploadFiles,
} from "./supabase-client.js";

const setup = document.querySelector("[data-setup]");
const login = document.querySelector("[data-login]");
const workspace = document.querySelector("[data-workspace]");
const loginForm = document.querySelector("[data-login-form]");
const loginNote = document.querySelector("[data-login-note]");
const userEmail = document.querySelector("[data-user-email]");
const logout = document.querySelector("[data-logout]");
const typeButtons = document.querySelectorAll("[data-content-type]");
const sections = document.querySelectorAll("[data-section]");
const editor = document.querySelector("[data-editor]");
const note = document.querySelector("[data-admin-note]");
const submitLabel = document.querySelector("[data-submit-label]");
const cancelEdit = document.querySelector("[data-cancel-edit]");
const refreshEntries = document.querySelector("[data-refresh-entries]");
const exportBackup = document.querySelector("[data-export-backup]");
const entryList = document.querySelector("[data-entry-admin-list]");

const typeLabels = {
  book: "书角",
  thought: "随想",
  love: "物",
  imprint: "印记",
};

const legacyStoner = {
  type: "book",
  title: "史托纳",
  subtitle: "我无趣克制内敛却也坚持的一生",
  body:
    "只是一个对这个世界毫无还手之力的人，他没有被这个世界的任何人记得。但他仍然有自己的坚持、有自己所爱、有自己的对抗，即使这些在这个世界里逐渐趋于麻木。\n\n我们要记得，不是所有的叙事都轰轰烈烈，悲壮宏大，有许许多多在角落不起眼或说不必提起的人，仍在度过他的一生。",
  excerpt: "无需试图改变这个世界的无可救药。",
  cover_url: null,
  image_urls: [],
  metadata: {
    author: "[美] 约翰·威廉斯",
    translator: "马耀民",
    read_date: "2026-06-06",
    rating: "★★★★★",
  },
  allow_comments: false,
};

let currentUser = null;
let editingEntry = null;

function setView(view) {
  setup.hidden = view !== "setup";
  login.hidden = view !== "login";
  workspace.hidden = view !== "workspace";
}

function activeType() {
  return document.querySelector("[data-content-type].is-active")?.dataset
    .contentType;
}

function value(formData, name) {
  return String(formData.get(name) || "").trim();
}

function setActiveType(type) {
  typeButtons.forEach((item) => {
    item.classList.toggle("is-active", item.dataset.contentType === type);
  });
  sections.forEach((section) => {
    section.classList.toggle("is-visible", section.dataset.section === type);
  });
}

function setField(name, fieldValue = "") {
  const field = editor.elements[name];
  if (!field || field.type === "file") return;
  if (field.type === "checkbox") {
    field.checked = Boolean(fieldValue);
    return;
  }
  field.value = fieldValue || "";
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

function resetEditor() {
  editingEntry = null;
  editor.reset();
  editor.querySelectorAll("[data-count-text]").forEach(updateCount);
  submitLabel.textContent = "确认发布";
  cancelEdit.hidden = true;
  note.textContent = "写完后点击确认，会直接公开到花之语。";
}

function updateCount(textarea) {
  const count = textarea.closest(".field")?.querySelector(".char-count");
  if (count) count.textContent = `${textarea.value.length} 字`;
}

function installCounters() {
  editor.querySelectorAll("[data-count-text]").forEach((textarea) => {
    const count = document.createElement("span");
    count.className = "char-count";
    textarea.closest(".field").append(count);
    textarea.addEventListener("input", () => updateCount(textarea));
    updateCount(textarea);
  });
}

function dateText(entry) {
  return new Date(entry.published_at || entry.updated_at || entry.created_at)
    .toLocaleDateString("zh-CN");
}

function entryTitle(entry) {
  if (entry.title) return entry.title;
  if (entry.type === "imprint") return entry.metadata?.kind || "一段印记";
  return "未命名内容";
}

function entryExcerpt(entry) {
  return entry.excerpt || entry.body || "没有正文。";
}

function renderEntryRow(entry) {
  const row = document.createElement("article");
  row.className = "entry-admin-row";

  const info = document.createElement("div");
  const meta = document.createElement("span");
  meta.className = "entry-admin-meta";
  meta.textContent = `${typeLabels[entry.type] || entry.type} · ${dateText(entry)}`;
  const title = document.createElement("h3");
  title.textContent = entryTitle(entry);
  const excerpt = document.createElement("p");
  excerpt.textContent = entryExcerpt(entry);
  info.append(meta, title, excerpt);

  const actions = document.createElement("div");
  actions.className = "entry-admin-actions";
  const edit = document.createElement("button");
  edit.type = "button";
  edit.textContent = "修改";
  edit.addEventListener("click", () => startEdit(entry));

  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "删除";
  remove.dataset.deleteEntry = "";
  remove.addEventListener("click", () => deleteEntry(entry));

  actions.append(edit, remove);
  row.append(info, actions);
  return row;
}

function renderLegacyStonerRow() {
  const row = document.createElement("article");
  row.className = "entry-admin-row entry-admin-row-legacy";

  const info = document.createElement("div");
  const meta = document.createElement("span");
  meta.className = "entry-admin-meta";
  meta.textContent = "书角 · 初版固定内容";
  const title = document.createElement("h3");
  title.textContent = "史托纳";
  const excerpt = document.createElement("p");
  excerpt.textContent = "先转为可编辑内容，之后就能随时修改或删除。";
  info.append(meta, title, excerpt);

  const actions = document.createElement("div");
  actions.className = "entry-admin-actions";
  const migrate = document.createElement("button");
  migrate.type = "button";
  migrate.textContent = "转为可编辑";
  migrate.addEventListener("click", () => migrateLegacyStoner(migrate));
  actions.append(migrate);

  row.append(info, actions);
  return row;
}

async function migrateLegacyStoner(button) {
  button.disabled = true;
  button.textContent = "正在转移……";
  note.textContent = "正在把《史托纳》放进可编辑的内容库。";

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("entries")
    .insert({
      ...legacyStoner,
      author_id: currentUser.id,
      slug: makeSlug(legacyStoner.title),
      status: "public",
      published_at: now,
    })
    .select()
    .single();

  if (error) {
    button.disabled = false;
    button.textContent = "转为可编辑";
    note.textContent = `转移没有成功：${error.message}`;
    return;
  }

  note.textContent = "《史托纳》已经可以编辑，表单中已装入原来的内容。";
  await loadEntries();
  startEdit(data);
}

async function loadEntries() {
  if (!currentUser) return;
  entryList.innerHTML = '<p class="admin-note">正在整理已经发布的内容……</p>';
  const { data, error } = await supabase
    .from("entries")
    .select("*")
    .eq("author_id", currentUser.id)
    .order("updated_at", { ascending: false });

  if (error) {
    entryList.innerHTML = `<p class="admin-note">列表读取失败：${error.message}</p>`;
    return;
  }

  const hasStoner = data?.some(
    (entry) =>
      entry.type === "book" &&
      ["史托纳", "史托納"].includes(entry.title?.trim())
  );
  const rows = data?.map(renderEntryRow) || [];
  if (!hasStoner) rows.push(renderLegacyStonerRow());
  entryList.replaceChildren(...rows);
}

async function exportEntries() {
  if (!currentUser) return;

  exportBackup.disabled = true;
  exportBackup.textContent = "正在导出……";
  note.textContent = "正在整理备份文件。";

  try {
    const { data, error } = await supabase
      .from("entries")
      .select("*")
      .eq("author_id", currentUser.id)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const backup = {
      site: "花之语",
      exported_at: new Date().toISOString(),
      owner_email: currentUser.email,
      entry_count: data?.length || 0,
      entries: data || [],
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `flower-language-backup-${date}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    note.textContent = "备份已经导出到你的电脑。";
  } catch (error) {
    note.textContent = `导出没有成功：${error.message}`;
  } finally {
    exportBackup.disabled = false;
    exportBackup.textContent = "导出备份";
  }
}

async function createEntryFromForm(formData, previous = null) {
  const type = activeType();
  let entry;

  if (type === "book") {
    const coverFiles = formData.getAll("book_cover").filter((file) => file.size);
    const [coverUrl] = await uploadFiles(coverFiles, currentUser.id, "books");
    entry = {
      type,
      title: value(formData, "book_title"),
      subtitle: value(formData, "book_heading"),
      body: value(formData, "book_body"),
      excerpt: value(formData, "book_recommendation"),
      cover_url: coverUrl || previous?.cover_url || null,
      image_urls: previous?.image_urls || [],
      metadata: {
        author: value(formData, "book_author"),
        translator: value(formData, "book_translator"),
        read_date: value(formData, "book_date"),
        rating: value(formData, "book_rating"),
      },
      allow_comments: false,
    };
  }

  if (type === "thought") {
    entry = {
      type,
      title: value(formData, "thought_title") || null,
      subtitle: null,
      body: value(formData, "thought_body"),
      excerpt: null,
      cover_url: null,
      image_urls: [],
      metadata: {},
      allow_comments: formData.get("thought_comments") === "on",
    };
  }

  if (type === "love") {
    const files = formData.getAll("love_images").filter((file) => file.size);
    const imageUrls = await uploadFiles(files, currentUser.id, "love");
    entry = {
      type,
      title: value(formData, "love_title"),
      subtitle: null,
      body: value(formData, "love_body"),
      excerpt: null,
      cover_url: null,
      image_urls: imageUrls.length ? imageUrls : previous?.image_urls || [],
      metadata: { date: value(formData, "love_date") },
      allow_comments: false,
    };
  }

  if (type === "imprint") {
    const files = formData
      .getAll("imprint_images")
      .filter((file) => file.size);
    const imageUrls = await uploadFiles(files, currentUser.id, "imprints");
    entry = {
      type,
      title: null,
      subtitle: null,
      body: value(formData, "imprint_body"),
      excerpt: null,
      cover_url: null,
      image_urls: imageUrls.length ? imageUrls : previous?.image_urls || [],
      metadata: { kind: value(formData, "imprint_kind") },
      allow_comments: false,
    };
  }

  return entry;
}

function startEdit(entry) {
  editingEntry = entry;
  setActiveType(entry.type);
  editor.reset();

  if (entry.type === "book") {
    setField("book_title", entry.title);
    setField("book_author", entry.metadata?.author);
    setField("book_translator", entry.metadata?.translator);
    setField("book_date", entry.metadata?.read_date);
    setField("book_recommendation", entry.excerpt);
    setField("book_rating", entry.metadata?.rating || "★★★★★");
    setField("book_heading", entry.subtitle);
    setField("book_body", entry.body);
  }

  if (entry.type === "thought") {
    setField("thought_title", entry.title);
    setField("thought_body", entry.body);
    setField("thought_comments", entry.allow_comments);
  }

  if (entry.type === "love") {
    setField("love_title", entry.title);
    setField("love_date", entry.metadata?.date);
    setField("love_body", entry.body);
  }

  if (entry.type === "imprint") {
    setField("imprint_kind", entry.metadata?.kind || "时光");
    setField("imprint_body", entry.body);
  }

  submitLabel.textContent = "保存修改";
  cancelEdit.hidden = false;
  note.textContent = "正在修改已发布内容。不上传新图片，就会保留原来的图片。";
  editor.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteEntry(entry) {
  const ok = window.confirm(`确定要删除「${entryTitle(entry)}」吗？删除后前台也会消失。`);
  if (!ok) return;

  const { error } = await supabase
    .from("entries")
    .delete()
    .eq("id", entry.id)
    .eq("author_id", currentUser.id);

  if (error) {
    note.textContent = `删除没有成功：${error.message}`;
    return;
  }

  if (editingEntry?.id === entry.id) resetEditor();
  note.textContent = "已经删除。";
  await loadEntries();
}

async function initialize() {
  if (!supabaseConfigured) {
    setView("setup");
    return;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.user) {
    currentUser = session.user;
    userEmail.textContent = currentUser.email;
    setView("workspace");
    await loadEntries();
  } else {
    setView("login");
  }
}

typeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveType(button.dataset.contentType);
    resetEditor();
  });
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginNote.textContent = "正在打开你的小空间……";
  const formData = new FormData(loginForm);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: value(formData, "email"),
    password: value(formData, "password"),
  });

  if (error) {
    loginNote.textContent = `登录没有成功：${error.message}`;
    return;
  }

  currentUser = data.user;
  userEmail.textContent = currentUser.email;
  loginForm.reset();
  setView("workspace");
  await loadEntries();
});

logout.addEventListener("click", async () => {
  await supabase.auth.signOut();
  currentUser = null;
  resetEditor();
  setView("login");
});

document.querySelector("[data-preview]").addEventListener("click", () => {
  note.textContent = "预览会在下一版做得更漂亮；现在可以先保存，前台会直接显示。";
});

cancelEdit.addEventListener("click", resetEditor);
refreshEntries.addEventListener("click", loadEntries);
exportBackup.addEventListener("click", exportEntries);

editor.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) return;

  const submitButton = editor.querySelector(".publish-button");
  submitButton.disabled = true;
  submitButton.textContent = editingEntry ? "正在修改……" : "正在发布……";
  note.textContent = editingEntry
    ? "正在更新这份内容。"
    : "正在把文字和图片送进花之语。";

  try {
    const formData = new FormData(editor);
    const entry = await createEntryFromForm(formData, editingEntry);

    if (editingEntry) {
      const { error } = await supabase
        .from("entries")
        .update({
          ...entry,
          status: "public",
          published_at: editingEntry.published_at || new Date().toISOString(),
        })
        .eq("id", editingEntry.id)
        .eq("author_id", currentUser.id);
      if (error) throw error;
      note.textContent = "已经保存修改，前台会显示新版。";
    } else {
      const slugSource = entry.title || entry.body.slice(0, 24) || entry.type;
      const { error } = await supabase.from("entries").insert({
        ...entry,
        author_id: currentUser.id,
        slug: makeSlug(slugSource),
        status: "public",
        published_at: new Date().toISOString(),
      });
      if (error) throw error;
      note.textContent = "已经公开发布。";
    }

    resetEditor();
    await loadEntries();
  } catch (error) {
    note.textContent = `保存没有成功：${error.message}`;
  } finally {
    submitButton.disabled = false;
    submitLabel.textContent = editingEntry ? "保存修改" : "确认发布";
  }
});

installCounters();
initialize();
