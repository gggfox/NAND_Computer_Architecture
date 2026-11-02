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
  const canvasMenu = page.getByRole("dialog", { name: "Add to canvas" });
  await expect(canvasMenu.getByRole("searchbox", { name: "Search chips" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(canvasMenu).toHaveCount(0);
  await expect(host).toBeFocused();

  await page.keyboard.press("Enter");
  await canvasMenu.getByRole("option", { name: "Tidy wires" }).click();
  await expect(canvasMenu).toHaveCount(0);
  await expect(host).toBeFocused();
});
