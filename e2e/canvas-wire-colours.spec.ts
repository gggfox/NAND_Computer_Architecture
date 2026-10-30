import {
  canvasHost,
  createProject,
  DEMO_PART,
  expect,
  exportedProject,
  pinPoint,
  spoken,
  test,
} from "./support";
import type { ExportedFile } from "./support";
import {
  deleteDemoWire,
  inputBWire,
  NAND_B,
  pointerFor,
  press,
  saveColor,
  usesTouch,
  wireInto,
  wirePoint,
} from "./wiring-support";

test("the next wire colour paints a new wire Blue", async ({ isMobile, page }, testInfo) => {
  const pointer = pointerFor(page, usesTouch(isMobile, testInfo));
  await createProject(page);
  await deleteDemoWire(page, pointer, { part: DEMO_PART.nand, pin: NAND_B });
  await page.getByRole("button", { name: /Wire colour: Default/u }).click();
  await saveColor(page, "Colour for new wires", "Blue");
  await expect(page.getByRole("button", { name: /Wire colour: Blue/u })).toBeVisible();

  await pointer.tap(await pinPoint(page, DEMO_PART.inputB, 0));
  await pointer.tap(await pinPoint(page, DEMO_PART.nand, NAND_B));
  await expect(spoken(page)).toHaveText(/Wire added/u);
  expect(inputBWire(await exportedProject(page))?.color).toBe("blue");
});

/** The colours of the demo wires into the NAND's a and b. */
const colours = (exported: ExportedFile): readonly (string | undefined)[] =>
  [wireInto(exported, DEMO_PART.nand, 0), wireInto(exported, DEMO_PART.nand, NAND_B)].map(
    (item) => item?.color,
  );

test("Shift-clicked wires recolour together from the wire menu, and one Undo restores both", async ({
  isMobile,
  page,
}, testInfo) => {
  test.skip(usesTouch(isMobile, testInfo), "Shift-click needs a keyboard and a mouse");
  await createProject(page);
  const file = await exportedProject(page);
  const intoA = wireInto(file, DEMO_PART.nand, 0);
  const intoB = wireInto(file, DEMO_PART.nand, NAND_B);
  if (intoA === undefined || intoB === undefined) {
    throw new Error("The demo wires are missing");
  }
  const first = await wirePoint(page, file, intoA);
  const second = await wirePoint(page, file, intoB);
  await page.keyboard.down("Shift");
  await page.mouse.click(first.x, first.y);
  await page.mouse.click(second.x, second.y);
  await page.keyboard.up("Shift");
  await page.mouse.click(second.x, second.y, { button: "right" });
  const menu = page.getByRole("menu", { name: "Wire actions" });
  await expect(menu).toBeVisible();
  // Two wires selected: only Colour… and Delete apply to all of them.
  await expect(menu.getByRole("menuitem")).toHaveText(["Colour…", "Delete"]);
  await menu.getByRole("menuitem", { name: "Colour…" }).click();
  await saveColor(page, "Wire colour", "Orange");
  await expect(canvasHost(page)).toBeFocused();

  expect(colours(await exportedProject(page))).toEqual(["orange", "orange"]);
  await page.getByRole("button", { name: "Undo" }).click();
  expect(colours(await exportedProject(page))).toEqual([undefined, undefined]);
});

test("Tidy wires keeps a hand-bent wire's bends after a chip moves", async ({
  isMobile,
  page,
}, testInfo) => {
  const pointer = pointerFor(page, usesTouch(isMobile, testInfo));
  await createProject(page);
  const before = await exportedProject(page);
  const intoA = wireInto(before, DEMO_PART.nand, 0);
  if (intoA === undefined) {
    throw new Error("The demo has no wire into a");
  }
  // Bend the wire into a by hand: select it, open its menu with Enter, Move bends, an arrow.
  await pointer.tap(await wirePoint(page, before, intoA));
  await canvasHost(page).focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu", { name: "Wire actions" });
  await expect(menu.getByRole("menuitem").first()).toBeFocused();
  await menu.getByRole("menuitem", { name: "Move bends" }).click();
  await expect(spoken(page)).toHaveText(/Moving bends/u);
  await canvasHost(page).focus();
  // Its one interior segment is the vertical run at x = 140: one cell left.
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Escape");
  await expect(spoken(page)).toHaveText(/Bends done/u);
  const bent = wireInto(await exportedProject(page), DEMO_PART.nand, 0);
  expect(bent?.manualWaypoints).toBe(true);

  // Move the output, which the bent wire does not touch, then tidy every automatic wire.
  await canvasHost(page).focus();
  await press(page, "]", DEMO_PART.output + 1);
  await expect(spoken(page)).toHaveText(/^OUT selected\s*$/u);
  await page.keyboard.press("ArrowDown");
  await expect(spoken(page)).toHaveText(/Chips moved: 1/u);
  await page.getByRole("button", { name: "Tidy wires" }).click();

  const after = wireInto(await exportedProject(page), DEMO_PART.nand, 0);
  expect(after?.manualWaypoints).toBe(true);
  expect(after?.waypoints).toEqual(bent?.waypoints);
});

test("the wire and canvas menus give focus back to the canvas when they close", async ({
  isMobile,
  page,
}, testInfo) => {
  const pointer = pointerFor(page, usesTouch(isMobile, testInfo));
  await createProject(page);
  const host = canvasHost(page);
  const file = await exportedProject(page);
  const intoB = wireInto(file, DEMO_PART.nand, NAND_B);
  if (intoB === undefined) {
    throw new Error("The demo has no wire into b");
  }
  await pointer.tap(await wirePoint(page, file, intoB));
  await host.focus();
  await page.keyboard.press("Enter");
  const wireMenu = page.getByRole("menu", { name: "Wire actions" });
  await expect(wireMenu.getByRole("menuitem").first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(wireMenu).toHaveCount(0);
  await expect(host).toBeFocused();

  // Escape again clears the selection, so Enter opens the canvas menu.
  await page.keyboard.press("Escape");
  await page.keyboard.press("Enter");
  const canvasMenu = page.getByRole("menu", { name: "Canvas actions" });
  await expect(canvasMenu.getByRole("menuitem", { name: "Tidy wires" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(canvasMenu).toHaveCount(0);
  await expect(host).toBeFocused();

  await page.keyboard.press("Enter");
  await canvasMenu.getByRole("menuitem", { name: "Tidy wires" }).click();
  await expect(canvasMenu).toHaveCount(0);
  await expect(host).toBeFocused();
});
