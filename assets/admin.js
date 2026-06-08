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

let currentUser = null;

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
  } else {
    setView("login");
  }
}

typeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    typeButtons.forEach((item) => item.classList.remove("is-active"));
    sections.forEach((section) => section.classList.remove("is-visible"));
    button.classList.add("is-active");
    document
      .querySelector(`[data-section="${button.dataset.contentType}"]`)
      .classList.add("is-visible");
    note.textContent = "写完后可以保存为草稿、私密或公开。";
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
});

logout.addEventListener("click", async () => {
  await supabase.auth.signOut();
  currentUser = null;
  setView("login");
});

document.querySelector("[data-preview]").addEventListener("click", () => {
  note.textContent = "下一小步会加入发布前的完整视觉预览；现在可以先保存草稿测试。";
});

editor.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) return;

  const submitButton = editor.querySelector(".publish-button");
  submitButton.disabled = true;
  submitButton.textContent = "正在保存……";
  note.textContent = "正在把文字和图片送进花之语。";

  try {
    const formData = new FormData(editor);
    const type = activeType();
    const status = value(formData, "visibility");
    let entry;

    if (type === "book") {
      const coverFiles = formData.getAll("book_cover").filter((file) => file.size);
      const [coverUrl] = await uploadFiles(
        coverFiles,
        currentUser.id,
        "books"
      );
      const title = value(formData, "book_title");
      entry = {
        type,
        title,
        subtitle: value(formData, "book_heading"),
        body: value(formData, "book_body"),
        excerpt: value(formData, "book_recommendation"),
        cover_url: coverUrl || null,
        image_urls: [],
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
        image_urls: imageUrls,
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
        image_urls: imageUrls,
        metadata: { kind: value(formData, "imprint_kind") },
        allow_comments: false,
      };
    }

    const slugSource = entry.title || entry.body.slice(0, 24) || type;
    const { error } = await supabase.from("entries").insert({
      ...entry,
      author_id: currentUser.id,
      slug: makeSlug(slugSource),
      status,
      published_at: status === "public" ? new Date().toISOString() : null,
    });

    if (error) throw error;

    const statusLabel = {
      draft: "草稿",
      private: "私密内容",
      public: "公开内容",
    }[status];
    note.textContent = `已经保存为“${statusLabel}”。`;
    editor.reset();
  } catch (error) {
    note.textContent = `保存没有成功：${error.message}`;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "确认";
  }
});

initialize();
