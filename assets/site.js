document.querySelectorAll("[data-flower]").forEach((button) => {
  button.addEventListener("click", () => {
    const count = button.querySelector("[data-flower-count]");
    const hasGiven = button.classList.toggle("is-given");
    const nextCount = Number(count.textContent) + (hasGiven ? 1 : -1);

    count.textContent = String(nextCount);
    button.querySelector("[data-flower-label]").textContent = hasGiven
      ? "这朵花已送达"
      : "送一朵花";
  });
});

document.querySelectorAll("[data-comment-form]").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const note = form.querySelector("[data-form-note]");
    note.textContent = "谢谢你留下这句话。正式上线后，它会在审核通过后出现。";
    form.reset();
  });
});

document.querySelectorAll("[data-page-transition]").forEach((link) => {
  link.addEventListener("click", (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    link.classList.add("is-opening");
    document.body.classList.add(
      "is-leaving",
      `is-leaving-${link.dataset.pageTransition}`
    );
    window.setTimeout(() => {
      window.location.href = link.href;
    }, 430);
  });
});

const portalLinks = document.querySelectorAll(".portal[data-page-transition]");

portalLinks.forEach((portal) => {
  const colorClass = `portal-hover-${portal.dataset.pageTransition}`;
  const showColor = () => document.body.classList.add(colorClass);
  const hideColor = () => document.body.classList.remove(colorClass);

  portal.addEventListener("mouseenter", showColor);
  portal.addEventListener("mouseleave", hideColor);
  portal.addEventListener("focus", showColor);
  portal.addEventListener("blur", hideColor);
});

const bloomTitle = document.querySelector(".bloom-title");

function brushBloomTitle() {
  if (!bloomTitle || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  bloomTitle.classList.add("is-wind");
  window.setTimeout(() => bloomTitle.classList.remove("is-wind"), 1500);
}

if (bloomTitle) {
  window.setTimeout(brushBloomTitle, 850);
  window.setInterval(brushBloomTitle, 9000);
}

const brandMarks = document.querySelectorAll(".brand");
let petalRainActive = false;

const petalColors = ["#f2b8c4", "#f7ccd4", "#f4d9df", "#e9c2cb"];

function startPetalRain() {
  if (petalRainActive || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  petalRainActive = true;
  document.body.classList.add("petal-rain-active");

  const rain = document.createElement("div");
  rain.className = "petal-rain";
  rain.setAttribute("aria-hidden", "true");
  document.body.append(rain);

  const startTime = performance.now();
  const duration = 5000;
  const interval = window.setInterval(() => {
    const elapsed = performance.now() - startTime;
    if (elapsed >= 4200) {
      window.clearInterval(interval);
      return;
    }

    const petal = document.createElement("span");
    petal.className = "falling-petal";
    petal.style.setProperty("--petal-left", `${Math.random() * 100}vw`);
    petal.style.setProperty("--petal-size", `${5 + Math.random() * 5}px`);
    petal.style.setProperty("--petal-color", petalColors[Math.floor(Math.random() * petalColors.length)]);
    petal.style.setProperty("--petal-drift", `${-42 + Math.random() * 84}px`);
    petal.style.setProperty("--petal-turn", `${120 + Math.random() * 260}deg`);
    petal.style.setProperty("--petal-delay", `${Math.random() * 0.42}s`);
    petal.style.setProperty("--petal-fall", `${4.4 + Math.random() * 1.4}s`);
    rain.append(petal);
  }, 150);

  window.setTimeout(() => {
    window.clearInterval(interval);
    rain.remove();
    document.body.classList.remove("petal-rain-active");
    petalRainActive = false;
  }, duration);
}

brandMarks.forEach((brand) => {
  brand.addEventListener("mouseenter", startPetalRain);
  brand.addEventListener("click", (event) => {
    event.preventDefault();
    const destination = new URL(brand.href, window.location.href);
    const alreadyThere =
      destination.pathname === window.location.pathname ||
      (destination.pathname.endsWith("/index.html") &&
        destination.pathname.replace(/index\.html$/, "") === window.location.pathname);

    if (alreadyThere) {
      startPetalRain();
      return;
    }

    window.sessionStorage.setItem("flower-language-petal-rain", "true");
    window.location.href = brand.href;
  });
});

if (window.sessionStorage.getItem("flower-language-petal-rain") === "true") {
  window.sessionStorage.removeItem("flower-language-petal-rain");
  window.setTimeout(startPetalRain, 160);
}

const lightboxTriggers = document.querySelectorAll("[data-lightbox-trigger]");

if (lightboxTriggers.length || document.querySelector(".media-gallery")) {
  const lightbox = document.createElement("div");
  lightbox.className = "lightbox";
  lightbox.setAttribute("aria-hidden", "true");
  lightbox.innerHTML = `
    <button class="lightbox-close" type="button" aria-label="关闭照片">×</button>
    <div class="lightbox-inner">
      <img class="lightbox-image" alt="">
      <p class="lightbox-caption"></p>
    </div>
  `;
  document.body.append(lightbox);

  const closeLightbox = () => {
    lightbox.classList.remove("is-visible");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lightbox-open");
  };

  const openLightbox = (trigger) => {
    const source = trigger.querySelector("[data-lightbox-image]");
    if (!source) return;
    const caption = trigger.closest(".media-card")?.querySelector(".caption");
    const inner = lightbox.querySelector(".lightbox-inner");
    const image = lightbox.querySelector(".lightbox-image");
    image.src = source.src;
    image.alt = source.alt;
    lightbox.querySelector(".lightbox-caption").textContent = caption?.textContent || "";
    image.addEventListener(
      "load",
      () => {
        inner.style.width = `${Math.min(image.clientWidth + 20, window.innerWidth * 0.86)}px`;
      },
      { once: true }
    );
    lightbox.classList.add("is-visible");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("lightbox-open");
  };

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-lightbox-trigger]");
    if (trigger) openLightbox(trigger);
  });

  document.addEventListener("keydown", (event) => {
    const trigger = event.target.closest?.("[data-lightbox-trigger]");
    if (trigger && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openLightbox(trigger);
    }
  });

  lightbox.querySelector(".lightbox-close").addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) closeLightbox();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeLightbox();
  });
}
