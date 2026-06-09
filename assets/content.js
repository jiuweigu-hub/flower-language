import { supabase, supabaseConfigured } from "./supabase-client.js";

const typeLabels = {
  book: "书角",
  thought: "随想",
  love: "物",
  imprint: "印记",
};

function text(value) {
  return document.createTextNode(value || "");
}

function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.append(text(content));
  return node;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInlineFormat(value) {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
}

function renderFormattedBody(value) {
  const fragment = document.createDocumentFragment();
  String(value || "")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .forEach((block) => {
      const lines = block.split(/\n/);
      const firstLine = lines[0].trim();
      const marker = firstLine.match(/^(##|~)\s+(.+)/);
      const node = document.createElement(marker?.[1] === "##" ? "h3" : "p");
      if (marker?.[1] === "##") {
        node.className = "article-subhead";
        lines[0] = marker[2];
      } else if (marker?.[1] === "~") {
        node.className = "article-small";
        lines[0] = marker[2];
      }
      node.innerHTML = lines.map(renderInlineFormat).join("<br>");
      fragment.append(node);
    });
  return fragment;
}

function fileNameFromUrl(url) {
  try {
    return new URL(url, location.href).pathname.split("/").pop() || "";
  } catch {
    return "";
  }
}

function entryKeys(entry) {
  const keys = new Set();
  const legacyKey = entry.metadata?.legacy_key;
  if (legacyKey) keys.add(`${entry.type}:legacy:${legacyKey}`);
  if (entry.type === "imprint") {
    keys.add(`${entry.type}:body:${entry.body || ""}`);
  } else {
    keys.add(`${entry.type}:title:${entry.title || ""}`);
  }
  entry.image_urls?.forEach((url) => {
    const fileName = fileNameFromUrl(url);
    if (fileName) keys.add(`${entry.type}:image:${fileName}`);
  });
  return keys;
}

function staticEntryKeys(node, type) {
  const keys = new Set();
  if (type === "imprint") {
    const caption = node.querySelector(".caption")?.textContent?.trim() || "";
    keys.add(`${type}:body:${caption}`);
  } else {
    const title = node.querySelector("h2")?.textContent?.trim() || "";
    keys.add(`${type}:title:${title}`);
  }
  node.querySelectorAll("img").forEach((image) => {
    const fileName = fileNameFromUrl(image.getAttribute("src"));
    if (fileName) keys.add(`${type}:image:${fileName}`);
  });
  return keys;
}

function detailUrl(entry) {
  return `../entry.html?slug=${encodeURIComponent(entry.slug)}`;
}

function renderBook(entry) {
  const link = element("a", "book-card");
  link.href = detailUrl(entry);
  link.dataset.pageTransition = "book";

  const cover = element("div", "book-cover");
  if (entry.cover_url) {
    const image = document.createElement("img");
    image.src = entry.cover_url;
    image.alt = `${entry.title || "书籍"}封面`;
    cover.append(image);
  } else {
    cover.append(element("strong", "", entry.title || "无题"));
  }

  link.append(cover);
  link.append(element("h2", "", entry.title || "无题"));
  link.append(element("span", "author", entry.metadata?.author || ""));
  link.append(element("p", "recommendation", entry.excerpt || ""));

  const meta = element("div");
  meta.append(element("span", "rating", entry.metadata?.rating || ""));
  if (entry.metadata?.read_date) {
    meta.append(element("span", "meta", ` · ${entry.metadata.read_date}`));
  }
  link.append(meta);
  return link;
}

function renderThought(entry) {
  const article = element("article", "thought-row");
  const link = document.createElement("a");
  link.href = detailUrl(entry);
  const date = new Date(entry.published_at || entry.created_at).toLocaleDateString(
    "zh-CN"
  );
  link.append(element("span", "thought-date", date));
  link.append(element("h2", "", entry.title || "未命名随想"));
  link.append(element("p", "", entry.body));
  link.append(element("span", "read-entry", "阅读全文 →"));
  article.append(link);
  return article;
}

function paginateThoughts(container, entries) {
  const pageSize = 5;
  let currentPage = 1;
  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
  const list = element("div", "thought-page");
  const pager = element("nav", "thought-pagination");
  pager.setAttribute("aria-label", "随想分页");

  function renderPage() {
    const start = (currentPage - 1) * pageSize;
    list.replaceChildren(...entries.slice(start, start + pageSize));
    pager.replaceChildren();

    if (totalPages <= 1) return;

    const prev = element("button", "", "上一页");
    prev.type = "button";
    prev.disabled = currentPage === 1;
    prev.addEventListener("click", () => {
      currentPage -= 1;
      renderPage();
    });

    const label = element("span", "", `${currentPage} / ${totalPages}`);

    const next = element("button", "", "下一页");
    next.type = "button";
    next.disabled = currentPage === totalPages;
    next.addEventListener("click", () => {
      currentPage += 1;
      renderPage();
    });

    pager.append(prev, label, next);
  }

  container.replaceChildren(list, pager);
  renderPage();
}

function renderMedia(entry) {
  const isObject = entry.type === "love";
  const article = element("article", isObject ? "media-card object-card" : "media-card");
  if (!isObject && entry.metadata?.kind) {
    article.append(element("span", "entry-type", entry.metadata.kind));
  }

  const imageUrl = entry.image_urls?.[0];
  if (imageUrl) {
    const figure = element("figure", "photo-frame");
    figure.tabIndex = 0;
    figure.setAttribute("role", "button");
    figure.setAttribute(
      "aria-label",
      entry.image_urls.length > 1
        ? `打开全部 ${entry.image_urls.length} 张照片`
        : "放大查看照片"
    );
    figure.dataset.lightboxTrigger = "";
    figure.dataset.lightboxImages = JSON.stringify(entry.image_urls);
    const image = document.createElement("img");
    image.className = "photo-image";
    image.src = imageUrl;
    image.alt = entry.body || "花之语照片";
    image.dataset.lightboxImage = "";
    figure.append(image);
    article.append(figure);
  } else if (isObject) {
    const placeholder = element("div", "object-photo-empty");
    placeholder.append(element("span", "", "photo soon"));
    article.append(placeholder);
  }

  if (isObject) {
    const textBox = element("div", "object-text");
    if (entry.metadata?.date) {
      textBox.append(element("span", "entry-type", entry.metadata.date));
    }
    textBox.append(element("h2", "", entry.title || "未命名小物"));
    textBox.append(element("p", "caption", entry.body));
    article.append(textBox);
  } else {
    article.append(element("p", "caption", entry.body));
  }

  return article;
}

async function loadList(container) {
  if (!supabaseConfigured) return;
  const type = container.dataset.entryList;
  const staticEntries =
    ["thought", "love", "imprint"].includes(type)
      ? [...container.querySelectorAll("[data-static-entry]")].map((entry) =>
          entry.cloneNode(true)
        )
      : [];
  const { data, error } = await supabase
    .from("entries")
    .select("*")
    .eq("type", type)
    .eq("status", "public")
    .order("published_at", { ascending: false });

  if (error || !data?.length) return;
  const cloudKeys = new Set(data.flatMap((entry) => [...entryKeys(entry)]));
  const remainingStaticEntries = staticEntries.filter(
    (entry) => ![...staticEntryKeys(entry, type)].some((key) => cloudKeys.has(key))
  );

  if (type === "thought") {
    paginateThoughts(container, [
      ...data.map(renderThought),
      ...remainingStaticEntries,
    ]);
    return;
  }

  container.replaceChildren();
  data.forEach((entry) => {
    container.append(type === "book" ? renderBook(entry) : renderMedia(entry));
  });
  remainingStaticEntries.forEach((entry) => container.append(entry));
}

function renderImages(entry, wrapper) {
  if (!entry.image_urls?.length) return;
  const gallery = element("div", "entry-image-gallery");
  entry.image_urls.forEach((url) => {
    const image = document.createElement("img");
    image.src = url;
    image.alt = entry.body || entry.title || "花之语图片";
    gallery.append(image);
  });
  wrapper.append(gallery);
}

function visitorKey() {
  const keyName = "flower-language-visitor";
  let key = localStorage.getItem(keyName);
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem(keyName, key);
  }
  return key;
}

async function loadDetail(container) {
  if (!supabaseConfigured) {
    container.replaceChildren(
      element("p", "entry-loading", "云端尚未连接，暂时无法打开这篇内容。")
    );
    return;
  }

  const slug = new URLSearchParams(location.search).get("slug");
  const { data: entry, error } = await supabase
    .from("entries")
    .select("*")
    .eq("slug", slug)
    .eq("status", "public")
    .single();

  if (error || !entry) {
    container.replaceChildren(
      element("p", "entry-loading", "没有找到这份内容，或它暂时没有公开。")
    );
    return;
  }

  document.title = `${entry.title || typeLabels[entry.type]} · 花之语`;
  container.replaceChildren();
  const article = element("article", `cloud-entry cloud-entry-${entry.type}`);
  const header = element("header", "cloud-entry-header");
  header.append(element("p", "eyebrow", typeLabels[entry.type]));
  if (entry.title) header.append(element("h1", "", entry.title));
  if (entry.subtitle) header.append(element("h2", "", entry.subtitle));

  if (entry.type === "book") {
    const bookTop = element("div", "cloud-book-top");
    if (entry.cover_url) {
      const image = document.createElement("img");
      image.src = entry.cover_url;
      image.alt = `${entry.title}封面`;
      bookTop.append(image);
    } else {
      bookTop.classList.add("cloud-book-top-no-cover");
    }
    const info = element("div", "cloud-book-info");
    info.append(header);
    info.append(
      element(
        "p",
        "meta",
        [
          entry.metadata?.author,
          entry.metadata?.translator
            ? `${entry.metadata.translator} 译`
            : "",
          entry.metadata?.read_date,
          entry.metadata?.rating,
        ]
          .filter(Boolean)
          .join(" · ")
      )
    );
    if (entry.excerpt) info.append(element("p", "book-quote", entry.excerpt));
    bookTop.append(info);
    article.append(bookTop);
  } else if (entry.type === "love") {
    article.append(header);
    if (entry.metadata?.date) {
      article.append(element("p", "meta", entry.metadata.date));
    }
  } else {
    article.append(header);
  }

  renderImages(entry, article);
  const body = element("div", "article-body");
  body.append(renderFormattedBody(entry.body));
  article.append(body);

  const flower = element("button", "flower-button");
  flower.type = "button";
  flower.append(element("span", "", "送一朵花"));
  const count = element("span", "", String(entry.flower_count || 0));
  flower.append(count);
  flower.addEventListener("click", async () => {
    flower.disabled = true;
    const { data } = await supabase.rpc("send_flower", {
      target_entry: entry.id,
      visitor: visitorKey(),
    });
    count.textContent = String(data ?? entry.flower_count);
  });
  article.append(flower);

  if (entry.allow_comments) {
    const comments = element("section", "comments");
    comments.append(element("h2", "", "留下你的话"));
    const form = document.createElement("form");
    form.innerHTML = `
      <label class="field">昵称<input name="nickname" required maxlength="40"></label>
      <label class="field">评论<textarea name="body" rows="5" required maxlength="1000"></textarea></label>
      <button class="submit-button" type="submit">提交评论</button>
      <p class="form-note">审核通过后，你的话会出现在这里。</p>
    `;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const { error: commentError } = await supabase.from("comments").insert({
        entry_id: entry.id,
        nickname: String(formData.get("nickname")).trim(),
        body: String(formData.get("body")).trim(),
      });
      form.querySelector(".form-note").textContent = commentError
        ? `提交没有成功：${commentError.message}`
        : "谢谢你。审核通过后，这句话会出现在这里。";
      if (!commentError) form.reset();
    });
    comments.append(form);
    article.append(comments);
  }

  container.append(article);
}

document.querySelectorAll("[data-entry-list]").forEach(loadList);
const detail = document.querySelector("[data-entry-detail]");
if (detail) loadDetail(detail);
