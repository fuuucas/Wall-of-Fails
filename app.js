const viewport = document.getElementById("mapViewport");
const world = document.getElementById("world");
const failLayer = document.getElementById("failLayer");
const connectButton = document.getElementById("connectButton");
const connectLabel = document.getElementById("connectLabel");
const postButton = document.getElementById("postButton");
const postDialog = document.getElementById("postDialog");
const closeDialog = document.getElementById("closeDialog");
const postForm = document.getElementById("postForm");
const pnlInput = document.getElementById("pnlInput");
const imageInput = document.getElementById("imageInput");
const explanationInput = document.getElementById("explanationInput");
const formError = document.getElementById("formError");
const successDialog = document.getElementById("successDialog");
const goToFailButton = document.getElementById("goToFailButton");
const searchInput = document.getElementById("searchInput");
const homeButton = document.getElementById("homeButton");
const logoutButton = document.getElementById("logoutButton");
const mapHint = document.getElementById("mapHint");
const hallButton = document.getElementById("hallButton");
const hallDialog = document.getElementById("hallDialog");
const closeHallDialog = document.getElementById("closeHallDialog");
const hallList = document.getElementById("hallList");
const infoButton = document.getElementById("infoButton");
const infoDialog = document.getElementById("infoDialog");
const closeInfoDialog = document.getElementById("closeInfoDialog");
const infoPostButton = document.getElementById("infoPostButton");
const totalFailsStat = document.getElementById("totalFailsStat");
const totalLossStat = document.getElementById("totalLossStat");
const biggestFailStat = document.getElementById("biggestFailStat");

const supabaseConfig = window.WALL_OF_FAILS_SUPABASE || {};
const hasSupabaseConfig = Boolean(supabaseConfig.url && supabaseConfig.anonKey && window.supabase);
const supabaseClient = hasSupabaseConfig
  ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey)
  : null;
const failImagesBucket = supabaseConfig.failImagesBucket || "fail-images";

const worldOrigin = { x: 50000, y: 50000 };
const state = {
  connected: false,
  handle: "",
  user: null,
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  dragging: false,
  dragPointerId: null,
  dragPointerType: "",
  dragMoved: false,
  dragStart: { x: 0, y: 0 },
  origin: { x: 0, y: 0 },
  activeId: null,
  lastPostedId: null,
};

const demoFails = [
  {
    id: "fail-1",
    handle: "rektmaxi",
    pnl: -12840,
    x: worldOrigin.x - 420,
    y: worldOrigin.y - 210,
    image: "",
    story: "Longed the breakout, forgot funding existed, then doubled down because the chart looked personally offensive.",
  },
  {
    id: "fail-2",
    handle: "ledgerless",
    pnl: -3200,
    x: worldOrigin.x + 20,
    y: worldOrigin.y - 30,
    image: "",
    story: "Sent funds to the wrong chain and spent the next afternoon learning the true shape of silence.",
  },
  {
    id: "fail-3",
    handle: "candlechef",
    pnl: -21950,
    x: worldOrigin.x + 390,
    y: worldOrigin.y - 250,
    image: "",
    story: "A clean stop loss was available. I selected spiritual growth instead.",
  },
  {
    id: "fail-4",
    handle: "altseasonpls",
    pnl: -7850,
    x: worldOrigin.x - 140,
    y: worldOrigin.y + 300,
    image: "",
    story: "Bought the coin because the ticker was funny. Sold it because the portfolio was not.",
  },
  {
    id: "fail-5",
    handle: "gaswarrior",
    pnl: -940,
    x: worldOrigin.x + 530,
    y: worldOrigin.y + 210,
    image: "",
    story: "Paid more in gas than the mint was worth, then watched the floor discover gravity.",
  },
  {
    id: "fail-6",
    handle: "marginpoet",
    pnl: -15400,
    x: worldOrigin.x - 560,
    y: worldOrigin.y + 380,
    image: "",
    story: "The liquidation email arrived before the coffee did. Efficient market, brutal morning.",
  },
];
let fails = [...demoFails];

function formatPnl(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function fallbackImage(handle) {
  const encodedHandle = encodeURIComponent(`@${handle}`);
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 720 420'%3E%3Crect width='720' height='420' fill='%23121418'/%3E%3Cpath d='M0 300 120 210l110 55 130-150 170 115 190-180v370H0z' fill='%23be1f34' opacity='.72'/%3E%3Cpath d='M0 330 160 255l120 75 120-98 130 62 190-115v241H0z' fill='%23f4c96b' opacity='.38'/%3E%3Ctext x='42' y='82' fill='%23f5f3ed' font-family='Inter,Arial' font-size='42' font-weight='800'%3E${encodedHandle}%3C/text%3E%3Ctext x='42' y='132' fill='%23ff4d5d' font-family='Inter,Arial' font-size='26' font-weight='800'%3Efailure receipt%3C/text%3E%3C/svg%3E`;
}

function setMapHint(message, duration = 2200) {
  mapHint.textContent = message;
  mapHint.classList.remove("hidden");
  window.clearTimeout(setMapHint.timeout);
  setMapHint.timeout = window.setTimeout(() => mapHint.classList.add("hidden"), duration);
}

function normalizeHandle(value) {
  return String(value || "unknown")
    .replace(/^@/, "")
    .replace(/[^\w]/g, "")
    .slice(0, 24)
    .toLowerCase() || "unknown";
}

function handleFromUser(user) {
  const metadata = user?.user_metadata || {};
  return normalizeHandle(
    metadata.user_name ||
      metadata.preferred_username ||
      metadata.screen_name ||
      metadata.full_name ||
      metadata.name ||
      user?.email?.split("@")[0],
  );
}

function normalizeFail(row) {
  return {
    id: row.id,
    handle: normalizeHandle(row.handle),
    pnl: Number(row.pnl),
    x: Number(row.x),
    y: Number(row.y),
    image: row.image_url || "",
    story: row.story || "",
  };
}

function setConnectedUser(user) {
  state.user = user;
  state.connected = Boolean(user);
  state.handle = user ? handleFromUser(user) : "";
  connectLabel.textContent = user ? `@${state.handle}` : "Connect X";
  postButton.disabled = !user;
  logoutButton.disabled = !user;
  connectButton.disabled = false;
}

function renderFails(list = fails) {
  failLayer.innerHTML = "";

  list.forEach((fail) => {
    const pin = document.createElement("article");
    pin.classList.add("fail-pin");
    if (state.activeId === fail.id) pin.classList.add("active");
    pin.id = fail.id;
    pin.tabIndex = 0;
    pin.setAttribute("role", "button");
    pin.setAttribute("aria-label", `Open fail from @${fail.handle}`);
    pin.style.left = `${fail.x}px`;
    pin.style.top = `${fail.y}px`;

    const handle = document.createElement("span");
    handle.className = "handle";
    handle.textContent = `@${fail.handle}`;

    const pnl = document.createElement("span");
    pnl.className = "pnl";
    pnl.textContent = formatPnl(fail.pnl);

    const image = document.createElement("img");
    image.className = "fail-image";
    image.src = fail.image || fallbackImage(fail.handle);
    image.alt = `Fail screenshot from @${fail.handle}`;

    const story = document.createElement("p");
    story.className = "fail-story";
    story.textContent = fail.story;

    const shareButton = document.createElement("button");
    shareButton.className = "share-fail-button";
    shareButton.type = "button";
    shareButton.textContent = "Share fail";
    shareButton.addEventListener("click", (event) => {
      event.stopPropagation();
      shareFail(fail);
    });

    pin.append(handle, pnl, image, story, shareButton);
    pin.addEventListener("click", (event) => {
      event.stopPropagation();
      state.activeId = state.activeId === fail.id ? null : fail.id;
      updateFailUrl(state.activeId);
      renderFails(getFilteredFails());
    });
    pin.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      state.activeId = state.activeId === fail.id ? null : fail.id;
      updateFailUrl(state.activeId);
      renderFails(getFilteredFails());
    });
    failLayer.appendChild(pin);
  });
}

function getFilteredFails() {
  const query = searchInput.value.trim().replace("@", "").toLowerCase();
  if (!query) return fails;
  return fails.filter((fail) => fail.handle.toLowerCase().includes(query));
}

function updateInfoStats() {
  const totalLoss = fails.reduce((sum, fail) => sum + Math.abs(fail.pnl), 0);
  const biggestFail = fails.reduce((biggest, fail) => Math.max(biggest, Math.abs(fail.pnl)), 0);

  totalFailsStat.textContent = String(fails.length);
  totalLossStat.textContent = formatPnl(-totalLoss);
  biggestFailStat.textContent = formatPnl(-biggestFail);
}

function getSortedFailsByPain() {
  return [...fails].sort((a, b) => a.pnl - b.pnl);
}

function getFailUrl(id) {
  const url = new URL(window.location.href);
  url.searchParams.set("fail", id);
  return url.toString();
}

function updateFailUrl(id) {
  const url = new URL(window.location.href);
  if (id) {
    url.searchParams.set("fail", id);
  } else {
    url.searchParams.delete("fail");
  }
  window.history.replaceState({}, "", url);
}

function renderHallOfShame() {
  hallList.innerHTML = "";

  getSortedFailsByPain().forEach((fail, index) => {
    const item = document.createElement("button");
    item.className = "hall-item";
    item.type = "button";

    const rank = document.createElement("span");
    rank.className = "hall-rank";
    rank.textContent = `#${index + 1}`;

    const details = document.createElement("span");
    details.className = "hall-details";

    const handle = document.createElement("strong");
    handle.textContent = `@${fail.handle}`;

    const story = document.createElement("small");
    story.textContent = fail.story;

    details.append(handle, story);

    const pnl = document.createElement("span");
    pnl.className = "hall-pnl";
    pnl.textContent = formatPnl(fail.pnl);

    item.append(rank, details, pnl);
    item.addEventListener("click", () => {
      hallDialog.close();
      goToFail(fail.id);
    });
    hallList.appendChild(item);
  });
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

async function shareFail(fail) {
  const url = getFailUrl(fail.id);
  const shareData = {
    title: `@${fail.handle} made the Hall of Shame`,
    text: `@${fail.handle} posted a ${formatPnl(fail.pnl)} fail on Wall of Fails.`,
    url,
  };

  try {
    await copyText(url);
    setMapHint("Fail URL copied to the clipboard.");

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (_error) {
        // If native share is cancelled or unavailable, still keep the clipboard copy.
      }
    }
  } catch (_error) {
    setMapHint("Could not copy fail URL.");
  }
}

async function copyWalletAddress(address) {
  try {
    await copyText(address);
    setMapHint("Wallet address copied.");
  } catch (_error) {
    setMapHint("Could not copy wallet address.");
  }
}

function applyTransform() {
  world.style.transform = `translate(${state.offsetX}px, ${state.offsetY}px) scale(${state.scale})`;
}

function centerOn(x, y) {
  state.offsetX = window.innerWidth / 2 - x * state.scale;
  state.offsetY = window.innerHeight / 2 - y * state.scale;
  applyTransform();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function endDrag(event) {
  if (!state.dragging) return;

  if (
    event?.pointerId !== undefined &&
    event.pointerId === state.dragPointerId &&
    viewport.hasPointerCapture(event.pointerId)
  ) {
    try {
      viewport.releasePointerCapture(event.pointerId);
    } catch (_error) {
      // The browser may already have released it.
    }
  }

  state.dragging = false;
  state.dragPointerId = null;
  state.dragPointerType = "";
  viewport.classList.remove("dragging");
}

function goToFail(id) {
  const fail = fails.find((item) => item.id === id);
  if (!fail) return;
  state.activeId = fail.id;
  searchInput.value = "";
  renderFails();
  centerOn(fail.x + 170, fail.y + 160);
  updateFailUrl(fail.id);
}

function openFailFromUrl() {
  const failId = new URLSearchParams(window.location.search).get("fail");
  if (failId && fails.some((fail) => fail.id === failId)) {
    goToFail(failId);
  }
}

function initPosition() {
  centerOn(worldOrigin.x, worldOrigin.y);
}

function nextFailPosition() {
  const index = fails.length;
  const angle = index * 2.399963229728653;
  const radius = 250 + Math.floor(index / 7) * 150;
  const wobbleX = ((index * 37) % 90) - 45;
  const wobbleY = ((index * 53) % 90) - 45;

  return {
    x: Math.round(worldOrigin.x + Math.cos(angle) * radius + wobbleX),
    y: Math.round(worldOrigin.y + Math.sin(angle) * radius + wobbleY),
  };
}

function readImageAsDataUrl(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve("");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

async function loadFailsFromSupabase() {
  if (!supabaseClient) return;

  const { data, error } = await supabaseClient
    .from("fails")
    .select("id, handle, pnl, image_url, story, x, y, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    setMapHint("Could not load Supabase posts. Showing demo map.");
    return;
  }

  fails = data.length ? data.map(normalizeFail) : [];
  renderFails(getFilteredFails());
  updateInfoStats();
  openFailFromUrl();
}

async function uploadFailImage(file) {
  if (!file) return "";
  if (!supabaseClient || !state.user) return readImageAsDataUrl(file);

  const extension = file.name.split(".").pop() || "png";
  const uniqueId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  const filePath = `${state.user.id}/${uniqueId}.${extension}`;
  const { error } = await supabaseClient.storage
    .from(failImagesBucket)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabaseClient.storage.from(failImagesBucket).getPublicUrl(filePath);
  return data.publicUrl;
}

async function createFail(fail) {
  if (!supabaseClient || !state.user) {
    fails.push(fail);
    return fail;
  }

  const { data, error } = await supabaseClient
    .from("fails")
    .insert({
      user_id: state.user.id,
      handle: fail.handle,
      pnl: fail.pnl,
      image_url: fail.image,
      story: fail.story,
      x: fail.x,
      y: fail.y,
    })
    .select("id, handle, pnl, image_url, story, x, y, created_at")
    .single();

  if (error) throw error;

  const savedFail = normalizeFail(data);
  fails.push(savedFail);
  return savedFail;
}

async function initSupabaseAuth() {
  if (!supabaseClient) {
    setMapHint("Add Supabase keys to enable X login.", 2600);
    return;
  }

  const { data } = await supabaseClient.auth.getSession();
  setConnectedUser(data.session?.user || null);

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    setConnectedUser(session?.user || null);
  });
}

viewport.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  if (event.target.closest("button, input, textarea, label, .fail-pin")) return;
  event.preventDefault();
  state.dragging = true;
  state.dragPointerId = event.pointerId;
  state.dragPointerType = event.pointerType;
  state.dragMoved = false;
  state.dragStart = { x: event.clientX, y: event.clientY };
  state.origin = { x: state.offsetX, y: state.offsetY };
  viewport.classList.add("dragging");
  viewport.setPointerCapture(event.pointerId);
  mapHint.classList.add("hidden");
});

window.addEventListener("pointermove", (event) => {
  if (!state.dragging) return;
  if (event.pointerId !== state.dragPointerId) return;
  if (state.dragPointerType === "mouse" && (event.buttons & 1) === 0) {
    endDrag(event);
    return;
  }

  const deltaX = event.clientX - state.dragStart.x;
  const deltaY = event.clientY - state.dragStart.y;
  state.dragMoved = state.dragMoved || Math.hypot(deltaX, deltaY) > 3;
  state.offsetX = state.origin.x + deltaX;
  state.offsetY = state.origin.y + deltaY;
  applyTransform();
});

viewport.addEventListener("pointerup", endDrag);
viewport.addEventListener("pointercancel", endDrag);
window.addEventListener("pointerup", endDrag);
window.addEventListener("pointercancel", endDrag);
window.addEventListener("blur", endDrag);

viewport.addEventListener("wheel", (event) => {
  if (event.target.closest("input, textarea")) return;
  event.preventDefault();

  const zoomIntensity = 0.0015;
  const nextScale = clamp(state.scale * Math.exp(-event.deltaY * zoomIntensity), 0.35, 2.25);
  const worldX = (event.clientX - state.offsetX) / state.scale;
  const worldY = (event.clientY - state.offsetY) / state.scale;

  state.scale = nextScale;
  state.offsetX = event.clientX - worldX * state.scale;
  state.offsetY = event.clientY - worldY * state.scale;
  applyTransform();
  mapHint.classList.add("hidden");
}, { passive: false });

viewport.addEventListener("click", () => {
  if (state.dragMoved) {
    state.dragMoved = false;
    return;
  }

  if (state.activeId) {
    state.activeId = null;
    updateFailUrl(null);
    renderFails(getFilteredFails());
  }
});

connectButton.addEventListener("click", async () => {
  if (state.connected) return;

  if (!supabaseClient) {
    const randomId = Math.floor(1000 + Math.random() * 9000);
    setConnectedUser({
      id: `demo-${randomId}`,
      user_metadata: { user_name: `anonfail${randomId}` },
    });
    setMapHint("Demo login active. Add Supabase keys for real X auth.");
    return;
  }

  connectButton.disabled = true;
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: "x",
    options: {
      redirectTo: `${window.location.origin}${window.location.pathname}`,
    },
  });

  if (error) {
    connectButton.disabled = false;
    setMapHint("X login failed. Check Supabase provider settings.");
  }
});

logoutButton.addEventListener("click", async () => {
  if (!state.connected) return;

  if (supabaseClient) {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      setMapHint("No se pudo cerrar sesión.");
      return;
    }
  }

  setConnectedUser(null);
  setMapHint("Sesión cerrada. Ahora puedes cambiar de cuenta.");
});

postButton.addEventListener("click", () => {
  if (!state.connected) return;
  formError.textContent = "";
  postDialog.showModal();
});

closeDialog.addEventListener("click", () => {
  postDialog.close();
});

postForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const pnl = Number(pnlInput.value);
  const story = explanationInput.value.trim();

  if (!Number.isFinite(pnl) || pnl >= 0) {
    formError.textContent = "PnL must be negative.";
    return;
  }

  if (!story) {
    formError.textContent = "Tell the fail. The wall demands lore.";
    return;
  }

  formError.textContent = "";
  const imageFile = imageInput.files[0];
  const position = nextFailPosition();
  const newFail = {
    id: `fail-${Date.now()}`,
    handle: state.handle,
    pnl,
    x: position.x,
    y: position.y,
    image: "",
    story,
  };

  try {
    newFail.image = await uploadFailImage(imageFile);
    const savedFail = await createFail(newFail);
    state.lastPostedId = savedFail.id;
    state.activeId = savedFail.id;
    postForm.reset();
    postDialog.close();
    renderFails();
    updateInfoStats();
    updateFailUrl(savedFail.id);
    successDialog.showModal();
  } catch (error) {
    formError.textContent = "Could not post fail. Check Supabase table/storage settings.";
  }
});

goToFailButton.addEventListener("click", () => {
  successDialog.close();
  goToFail(state.lastPostedId);
});

searchInput.addEventListener("input", () => {
  state.activeId = null;
  updateFailUrl(null);
  renderFails(getFilteredFails());
});

searchInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  const firstMatch = getFilteredFails()[0];
  if (firstMatch) goToFail(firstMatch.id);
});

homeButton.addEventListener("click", () => {
  state.activeId = null;
  searchInput.value = "";
  renderFails();
  initPosition();
  updateFailUrl(null);
});

hallButton.addEventListener("click", () => {
  renderHallOfShame();
  hallDialog.showModal();
});

closeHallDialog.addEventListener("click", () => {
  hallDialog.close();
});

infoButton.addEventListener("click", () => {
  updateInfoStats();
  infoPostButton.disabled = !state.connected;
  infoDialog.showModal();
});

closeInfoDialog.addEventListener("click", () => {
  infoDialog.close();
});

infoPostButton.addEventListener("click", () => {
  if (!state.connected) {
    infoDialog.close();
    setMapHint("Connect X first, then post the glorious disaster.");
    return;
  }

  infoDialog.close();
  formError.textContent = "";
  postDialog.showModal();
});

document.querySelectorAll("[data-wallet]").forEach((button) => {
  button.addEventListener("click", () => copyWalletAddress(button.dataset.wallet));
});

window.addEventListener("resize", applyTransform);

renderFails();
updateInfoStats();
initPosition();
initSupabaseAuth();
loadFailsFromSupabase();
openFailFromUrl();
