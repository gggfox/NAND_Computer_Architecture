/*
 * Writes `showcase.json`: the project that the promo video imports for its simulation shots.
 * The project is a 4-bit adder made only from NAND gates, in five levels:
 * The inner chips are tall, not wide, so that they fit a phone screen.
 * NAND -> XOR / AND / OR -> half adder -> full adder -> 4-bit adder -> calculator.
 * Run: node tooling/promo/gen-project.mjs
 */
import { writeFileSync } from "node:fs";
import path from "node:path";

let counter = 0x9000;
const id = () => `00000000-0000-4000-8000-${(counter++).toString(16).padStart(12, "0")}`;

const folders = [
  { id: id(), name: "Lógica" },
  { id: id(), name: "Aritmética" },
];
const [LOGIC, ARITHMETIC] = folders.map((folder) => folder.id);

const chips = [];

/** Makes one saved chip. `build` gets helpers that add pins, parts and wires. */
const chip = (name, color, folderId, build) => {
  const pins = [];
  const instances = [];
  const wires = [];
  const place = (kind, x, y) => {
    const instance = { id: id(), kind, position: { x, y } };
    instances.push(instance);
    return instance;
  };
  const pinPiece =
    (direction) =>
    (pinName, x, y, width = 1) => {
      const pin = { id: id(), name: pinName, width, direction };
      pins.push(pin);
      const piece = place({ type: "pin", pinId: pin.id }, x, y);
      const ref = { instanceId: piece.id, pin: 0 };
      return { ...ref, bit: (bit) => ({ ...ref, bit }) };
    };
  const helpers = {
    input: pinPiece("input"),
    output: pinPiece("output"),
    nand: (x, y) => {
      const instance = place({ type: "nand" }, x, y);
      const ref = (pin) => ({ instanceId: instance.id, pin });
      return { a: ref(0), b: ref(1), out: ref(2) };
    },
    use: (definition, x, y) => {
      const instance = place({ type: "custom", chipId: definition.id }, x, y);
      return Object.fromEntries(
        definition.saved.pins.map((pin) => [pin.name, { instanceId: instance.id, pin: pin.id }]),
      );
    },
    wire: (from, to, bitWidth = 1) => {
      const end = ({ instanceId, pin, bit }) =>
        typeof bit === "number" ? { instanceId, pin, bit } : { instanceId, pin };
      wires.push({
        id: id(),
        from: end(from),
        to: end(to),
        bitWidth,
        waypoints: [],
        manualWaypoints: false,
      });
    },
  };
  build(helpers);
  const circuit = { pins, instances, wires };
  const definition = {
    id: id(),
    name,
    color,
    saved: circuit,
    draft: structuredClone(circuit),
    ...(folderId === undefined ? {} : { folderId }),
    tags: [],
    starred: false,
  };
  chips.push(definition);
  return definition;
};

const TEAL = "#0d9488";
const AMBER = "#d97706";
const RED = "#dc2626";

const and = chip("AND", TEAL, LOGIC, ({ input, output, nand, wire }) => {
  const a = input("A", 0, 0);
  const b = input("B", 0, 80);
  const first = nand(160, 20);
  const second = nand(360, 20);
  const out = output("OUT", 560, 40);
  wire(a, first.a);
  wire(b, first.b);
  wire(first.out, second.a);
  wire(first.out, second.b);
  wire(second.out, out);
});

const or = chip("OR", TEAL, LOGIC, ({ input, output, nand, wire }) => {
  const a = input("A", 0, 20);
  const b = input("B", 0, 180);
  const notA = nand(160, 0);
  const notB = nand(160, 160);
  const last = nand(360, 80);
  const out = output("OUT", 560, 100);
  wire(a, notA.a);
  wire(a, notA.b);
  wire(b, notB.a);
  wire(b, notB.b);
  wire(notA.out, last.a);
  wire(notB.out, last.b);
  wire(last.out, out);
});

const xor = chip("XOR", TEAL, LOGIC, ({ input, output, nand, wire }) => {
  const a = input("A", 0, 20);
  const b = input("B", 0, 340);
  const both = nand(160, 160);
  const top = nand(160, 0);
  const bottom = nand(160, 320);
  const last = nand(360, 160);
  const out = output("OUT", 560, 180);
  wire(a, both.a);
  wire(b, both.b);
  wire(a, top.a);
  wire(both.out, top.b);
  wire(both.out, bottom.a);
  wire(b, bottom.b);
  wire(top.out, last.a);
  wire(bottom.out, last.b);
  wire(last.out, out);
});

const halfAdder = chip("Semisumador", AMBER, ARITHMETIC, ({ input, output, use, wire }) => {
  const a = input("A", 0, 40);
  const b = input("B", 0, 240);
  const sumGate = use(xor, 160, 20);
  const carryGate = use(and, 160, 220);
  const sum = output("S", 360, 40);
  const carry = output("C", 360, 240);
  wire(a, sumGate.A);
  wire(b, sumGate.B);
  wire(a, carryGate.A);
  wire(b, carryGate.B);
  wire(sumGate.OUT, sum);
  wire(carryGate.OUT, carry);
});

const fullAdder = chip("Sumador completo", AMBER, ARITHMETIC, ({ input, output, use, wire }) => {
  const a = input("A", 0, 0);
  const b = input("B", 0, 80);
  const carryIn = input("Cin", 0, 300);
  const first = use(halfAdder, 160, 20);
  const second = use(halfAdder, 160, 220);
  const either = use(or, 160, 420);
  const sum = output("S", 440, 240);
  const carryOut = output("Cout", 440, 440);
  wire(a, first.A);
  wire(b, first.B);
  wire(first.S, second.A);
  wire(carryIn, second.B);
  wire(first.C, either.A);
  wire(second.C, either.B);
  wire(second.S, sum);
  wire(either.OUT, carryOut);
});

const BITS = 4;
const STAGE_GAP = 200;

const adder = chip("Sumador 4 bits", RED, ARITHMETIC, ({ input, output, use, wire }) => {
  const a = input("A", 0, 80, BITS);
  const b = input("B", 0, 400, BITS);
  const carryIn = input("Cin", 0, 680);
  const sum = output("SUMA", 640, 320, BITS);
  const carryOut = output("ACARREO", 640, 680);
  let carry = carryIn;
  for (let bit = 0; bit < BITS; bit += 1) {
    const stage = use(fullAdder, 280, bit * STAGE_GAP);
    wire(a.bit(bit), stage.A);
    wire(b.bit(bit), stage.B);
    wire(carry, stage.Cin);
    wire(stage.S, sum.bit(bit));
    carry = stage.Cout;
  }
  wire(carry, carryOut);
});

chip("Calculadora", RED, undefined, ({ input, output, use, wire }) => {
  const a = input("A", 0, 0, BITS);
  const b = input("B", 0, 160, BITS);
  const carryIn = input("Cin", 0, 320);
  const add = use(adder, 320, 80);
  const sum = output("SUMA", 680, 80, BITS);
  const carryOut = output("ACARREO", 680, 240);
  wire(a, add.A, BITS);
  wire(b, add.B, BITS);
  wire(carryIn, add.Cin);
  wire(add.SUMA, sum, BITS);
  wire(add.ACARREO, carryOut);
});

const file = {
  format: "nand-project",
  version: 1,
  project: {
    id: id(),
    name: "Calculadora NAND",
    seed: 7,
    chips,
    lastOpenedChipId: adder.id,
    folders,
  },
};

const target = path.join(import.meta.dirname, "showcase.json");
writeFileSync(target, `${JSON.stringify(file, undefined, 2)}\n`);
console.log(`Wrote ${target}: ${String(chips.length)} chips`);
