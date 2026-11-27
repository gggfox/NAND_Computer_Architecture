/*
 * Draws one frame of the promo video. `render.mjs` loads this page, calls `setup` once and then
 * `renderFrame(time)` for each frame. Nothing here uses a clock: a frame depends only on `time`,
 * so the same storyboard always gives the same video.
 */
(() => {
  /** Seconds a scene takes to come in and to go out. Scenes overlap by about this much. */
  const ENTER = 0.45;
  const EXIT = 0.3;
  /** When the caption parts start, in seconds from the scene start, and how long each takes. */
  const KICKER_AT = 0.12;
  const TITLE_AT = 0.24;
  const WORD_GAP = 0.07;
  const REVEAL = 0.4;
  /** The first scene starts with its picture and most of its text in place: it is the hook. */
  const HOOK_LEAD = 1;

  const clamp = (value) => Math.min(1, Math.max(0, value));
  const easeOut = (value) => 1 - (1 - clamp(value)) ** 3;
  const easeInOut = (value) => {
    const share = clamp(value);
    return share < 0.5 ? 4 * share ** 3 : 1 - (-2 * share + 2) ** 3 / 2;
  };
  const mix = (from, to, share) => from + (to - from) * share;

  const element = (tag, className, parent) => {
    const node = document.createElement(tag);
    node.className = className;
    parent.append(node);
    return node;
  };

  /** `Todo *en tu mano*` becomes words; the words between the stars get the accent colour. */
  const words = (text, parent) => {
    const made = [];
    for (const [index, part] of text.split("*").entries()) {
      for (const word of part.split(" ").filter((item) => item !== "")) {
        const outer = element("span", index % 2 === 1 ? "word accent" : "word", parent);
        const inner = element("span", "", outer);
        inner.textContent = word;
        made.push(inner);
        parent.append(" ");
      }
    }
    return made;
  };

  /**
   * Makes the lines of a text block about the same length: it finds the narrowest width that
   * keeps the same number of lines. The stage does this itself, because `text-wrap: balance` is
   * not yet a widely available CSS feature.
   */
  const balance = (node) => {
    const { width, height } = node.getBoundingClientRect();
    let low = 0;
    let high = Math.ceil(width);
    while (high - low > 1) {
      const middle = (low + high) / 2;
      node.style.maxWidth = `${String(middle)}px`;
      if (node.getBoundingClientRect().height > height + 1) {
        low = middle;
      } else {
        high = middle;
      }
    }
    node.style.maxWidth = `${String(high)}px`;
  };

  let state;

  const buildCaption = (scene, parent, brand) => {
    const caption = element("div", "caption", parent);
    element("div", "brand-tag", caption).textContent = brand.name;
    const kicker = element("div", "kicker", caption);
    kicker.textContent = scene.kicker;
    const title = element("h1", "title", caption);
    return { caption, kicker, words: words(scene.title, title) };
  };

  const buildCard = (parent, brand) => {
    const card = element("div", "card", parent);
    const parts = [element("div", "name", card), element("div", "tagline", card)];
    parts[0].textContent = brand.name;
    parts[1].textContent = brand.tagline;
    const cta = element("h1", "cta", card);
    words(brand.cta, cta);
    const contacts = element("div", "contacts", card);
    for (const contact of brand.contacts) {
      const row = element("div", "contact", contacts);
      element("b", "", row).textContent = contact.label;
      element("span", "", row).textContent = contact.value;
    }
    const badges = element("div", "badges", card);
    for (const badge of brand.badges) {
      element("span", "", badges).textContent = badge;
    }
    return [...parts, cta, contacts, badges];
  };

  /** A close view of one part of a device's screen, in its own frame. */
  const buildInset = (spec, parent) => {
    const node = element("div", "inset", parent);
    element("div", "inset-label", node).textContent = spec.label;
    const view = element("div", "inset-view", element("div", "inset-frame", node));
    return { node, image: element("img", "", view) };
  };

  const buildDevice = (spec, parent, clips, sceneNode) => {
    const clip = clips[spec.clip];
    const node = element("div", `device ${spec.device}`, parent);
    element("div", "body", node);
    if (spec.device === "desktop") {
      element("div", "base", node);
    }
    const image = element("img", "", node);
    element("div", "glare", node);
    return {
      spec,
      clip,
      node,
      image,
      shown: "",
      inset: spec.inset === undefined ? undefined : buildInset(spec.inset, sceneNode),
      aspect: clip.viewport.width / clip.viewport.height,
    };
  };

  globalThis.setup = async ({ format, formats, brand, scenes, clips }) => {
    const { width, height, safe } = formats[format];
    const root = document.documentElement;
    root.dataset.format = format;
    root.style.setProperty("--width", `${String(width)}px`);
    root.style.setProperty("--height", `${String(height)}px`);
    root.style.setProperty("--unit", `${String(Math.min(width, height) / 1080)}px`);
    root.style.setProperty("--safe-top", `${String(safe.top)}px`);
    root.style.setProperty("--safe-bottom", `${String(safe.bottom)}px`);
    root.style.setProperty("--safe-side", `${String(safe.side)}px`);
    const host = document.querySelector("#scenes");
    state = {
      format,
      width,
      height,
      scenes: scenes.map((scene) => {
        const node = element("section", "scene", host);
        const world = element("div", "world", node);
        const devices = scene.devices.map((spec) => buildDevice(spec, world, clips, node));
        const caption = scene.card ? undefined : buildCaption(scene, node, brand);
        const card = scene.card ? buildCard(node, brand) : undefined;
        return { scene, node, world, devices, caption, card };
      }),
    };
    await Promise.all([
      document.fonts.load('800 40px "Orbitron"'),
      document.fonts.load('600 40px "Chakra Petch"'),
      document.fonts.load('500 40px "Chakra Petch"'),
    ]);
    await document.fonts.ready;
    for (const node of document.querySelectorAll(".title, .cta, .name")) {
      balance(node);
    }
  };

  /** The clip time that plays at `local` seconds into the scene. */
  const clipTime = (play, local) => {
    let begins = 0;
    for (const part of play) {
      if (local < begins + part.dur) {
        return mix(part.from, part.to, (local - begins) / part.dur);
      }
      begins += part.dur;
    }
    return play.at(-1).to;
  };

  /** The last frame at or before `time`. */
  const frameAt = (frames, time) => {
    let low = 0;
    let high = frames.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (frames[middle].t <= time) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }
    return frames[low].file;
  };

  const showFrame = async (device, local) => {
    const file = frameAt(device.clip.frames, clipTime(device.spec.play, local));
    if (file !== device.shown) {
      device.shown = file;
      const source = `/out/clips/${device.clip.name}/${file}`;
      device.image.src = source;
      if (device.inset !== undefined) {
        device.inset.image.src = source;
        await device.inset.image.decode();
      }
      await device.image.decode();
    }
  };

  /** Places the close view and shows it from `at` seconds into the scene. */
  const placeInset = (device, local) => {
    const spec = device.spec.inset;
    const { crop } = spec;
    const place = spec[state.format];
    const { viewport } = device.clip;
    const width = place.w * state.width;
    const height = (width * crop.h * viewport.height) / (crop.w * viewport.width);
    const imageWidth = width / crop.w;
    const imageHeight = imageWidth / device.aspect;
    const share = easeOut((local - spec.at) / REVEAL);
    const frame = device.inset.node.style;
    frame.width = `${String(width)}px`;
    frame.height = `${String(height)}px`;
    frame.left = `${String(place.x * state.width - width / 2)}px`;
    frame.top = `${String(place.y * state.height - height / 2)}px`;
    frame.opacity = String(share);
    frame.transform = `scale(${String(mix(0.86, 1, share))})`;
    const image = device.inset.image.style;
    image.width = `${String(imageWidth)}px`;
    image.height = `${String(imageHeight)}px`;
    image.left = `${String(-crop.x * imageWidth)}px`;
    image.top = `${String(-crop.y * imageHeight)}px`;
  };

  const placeDevice = (device, share) => {
    const { from, to } = device.spec[state.format];
    const pose = Object.fromEntries(
      Object.keys(from).map((key) => [key, mix(from[key], to[key], share)]),
    );
    const screenWidth = pose.w * state.width;
    const screenHeight = screenWidth / device.aspect;
    const originX = pose.u * screenWidth;
    const originY = pose.v * screenHeight;
    const { style } = device.node;
    style.width = `${String(screenWidth)}px`;
    style.height = `${String(screenHeight)}px`;
    style.left = `${String(pose.x * state.width - originX)}px`;
    style.top = `${String(pose.y * state.height - originY)}px`;
    style.transformOrigin = `${String(originX)}px ${String(originY)}px`;
    style.transform = `rotateX(${String(pose.rx)}deg) rotateY(${String(pose.ry)}deg) rotateZ(${String(pose.rz)}deg)`;
  };

  /** Fades and lifts `node` in, from `begins` seconds into the scene. */
  const reveal = (node, local, begins, lift = 24) => {
    const share = easeOut((local - begins) / REVEAL);
    node.style.opacity = String(share);
    node.style.transform = `translateY(${String((1 - share) * lift)}px)`;
  };

  const drawCaption = (caption, local) => {
    reveal(caption.kicker, local, KICKER_AT, 14);
    for (const [index, word] of caption.words.entries()) {
      const share = easeOut((local - TITLE_AT - index * WORD_GAP) / REVEAL);
      word.style.transform = `translateY(${String((1 - share) * 110)}%)`;
    }
  };

  const drawScene = async (item, time) => {
    const { scene, node } = item;
    const local = time - scene.start;
    const visible = time >= scene.start && time < scene.end;
    node.style.visibility = visible ? "visible" : "hidden";
    if (!visible) {
      return;
    }
    const length = scene.end - scene.start;
    const first = scene.start === 0;
    const enter = first ? 1 : easeOut(local / ENTER);
    const exit = scene.end === state.last ? 0 : easeInOut((local - (length - EXIT)) / EXIT);
    node.style.opacity = String(enter * (1 - exit));
    item.world.style.transform = `scale(${String(mix(0.93, 1, enter) + exit * 0.05)})`;
    const share = easeInOut(local / length);
    await Promise.all(
      item.devices.map((device) => {
        placeDevice(device, share);
        if (device.inset !== undefined) {
          placeInset(device, local);
        }
        return showFrame(device, local);
      }),
    );
    if (item.caption !== undefined) {
      drawCaption(item.caption, first ? local + HOOK_LEAD : local);
    }
    if (item.card !== undefined) {
      for (const [index, part] of item.card.entries()) {
        reveal(part, local, 0.15 + index * 0.14, 30);
      }
    }
  };

  globalThis.renderFrame = async (time) => {
    state.last = Math.max(...state.scenes.map((item) => item.scene.end));
    await Promise.all(state.scenes.map((item) => drawScene(item, time)));
    // Two animation frames, so the picture is painted before the screenshot.
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  };
})();
