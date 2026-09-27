import type { Swap } from "@retrofit/core";

/**
 * Where a test image comes from. The first that exists wins:
 * a local file (drop your own in scripts/fixtures/), then a public URL, then an AI-generated stand-in.
 */
export type ImageSource = {
  key: string;
  file?: string;
  url?: string;
  generate: { prompt: string; aspect: "3:4" | "4:3" | "1:1" | "9:16" | "16:9" };
};

export type SmokeCase = {
  id: string;
  pack: "clothing" | "car" | "room";
  title: string;
  subject: string;
  scene: ImageSource;
  /** One entry per swap. `product` is null for text-only swaps like paint colour. */
  swaps: Array<Swap & { image: ImageSource | null }>;
  locks: string[];
};

const PRODUCT_STYLE = "e-commerce product photo, isolated on a plain white background, studio lighting, no people";

const person: ImageSource = {
  key: "person",
  file: "scripts/fixtures/person.jpg",
  generate: {
    aspect: "3:4",
    prompt:
      "Full-body phone photo of a young man standing in a bright apartment hallway, facing the camera, " +
      "wearing a plain grey hoodie, blue jeans and white sneakers, arms relaxed, natural daylight, realistic, candid",
  },
};

const car: ImageSource = {
  key: "car",
  file: "scripts/fixtures/car.jpg",
  generate: {
    aspect: "4:3",
    prompt:
      "Phone photo of a white 2019 Honda Civic sedan parked in a suburban driveway, front three-quarter view, " +
      "stock silver wheels, daylight, realistic, slightly imperfect amateur photo",
  },
};

const room: ImageSource = {
  key: "room",
  file: "scripts/fixtures/room.jpg",
  generate: {
    aspect: "4:3",
    prompt:
      "Phone photo of a modest real living room: a beige fabric three-seat sofa against a white wall, light wooden floor, " +
      "a window with daylight, a small coffee table, a floor lamp, realistic, not staged",
  },
};

const jacket: ImageSource = {
  key: "jacket",
  generate: { aspect: "1:1", prompt: `Black leather bomber jacket with ribbed cuffs and silver zip, ${PRODUCT_STYLE}` },
};
const cargo: ImageSource = {
  key: "cargo",
  generate: { aspect: "1:1", prompt: `Olive green relaxed-fit cargo pants with side pockets, ${PRODUCT_STYLE}` },
};
const sneakers: ImageSource = {
  key: "sneakers",
  generate: { aspect: "1:1", prompt: `Pair of chunky white and forest-green retro running sneakers, ${PRODUCT_STYLE}` },
};
const wheel: ImageSource = {
  key: "wheel",
  generate: { aspect: "1:1", prompt: `Single gloss black 10-spoke 19-inch alloy car wheel with tyre, front view, ${PRODUCT_STYLE}` },
};
const sofa: ImageSource = {
  key: "sofa",
  generate: { aspect: "1:1", prompt: `Emerald green velvet three-seat sofa with thin brass legs, three-quarter view, ${PRODUCT_STYLE}` },
};

/** Home-page hero scenes: ordinary on purpose, so the change is big. Wide, for a full-width frame. */
const heroCar: ImageSource = {
  key: "hero-car",
  generate: {
    aspect: "16:9",
    prompt:
      "Phone photo of a plain silver 2015 Toyota Camry sedan, full side profile, parked alone on an empty concrete rooftop car park " +
      "at golden hour, warm low sun, long shadows, city skyline behind, stock plastic hubcaps, slightly dusty, realistic, not staged",
  },
};
const heroRoom: ImageSource = {
  key: "hero-room",
  generate: {
    aspect: "16:9",
    prompt:
      "Phone photo of a dated, dull rented living room: a worn brown faux-leather sofa against a bare off-white wall, beige carpet, " +
      "a plain boxy side table, one window with flat overcast daylight, realistic, slightly messy, not staged",
  },
};

const heroBareRoom: ImageSource = {
  key: "hero-basic-room",
  generate: {
    aspect: "16:9",
    prompt:
      "Phone photo of a plain, basic living room in an ordinary house: bare white walls with nothing on them, " +
      "a simple grey fabric three-seat sofa, a plain rectangular coffee table, a basic low TV stand, beige carpet, " +
      "one window with daylight, no plants, no art, no rugs, no decorations, realistic, not staged, wide angle",
  },
};
const heroHouse: ImageSource = {
  key: "hero-house",
  generate: {
    aspect: "16:9",
    prompt:
      "Phone photo of a plain, tired suburban two-storey house from the street: faded beige siding, white window frames, " +
      "a patchy lawn, a bare concrete path, plain garage door, overcast daylight, realistic, not staged",
  },
};

/** Step 2 of the hardwood room: the step-1 result, saved locally by hand (see HANDOFF). */
const heroHardwoodRoom: ImageSource = {
  key: "hero-hardwood-room",
  file: "scripts/fixtures/hero-hardwood-room.png",
  generate: { aspect: "16:9", prompt: "unused: made from the hero-room-hardwood-base render" },
};

const PERSON_LOCKS = ["face", "hair", "body shape and proportions", "skin tone", "pose", "hands", "background"];

export const SMOKE_CASES: SmokeCase[] = [
  {
    id: "clothing-jacket",
    pack: "clothing",
    title: "Clothing: one item (hoodie → leather jacket)",
    subject: "a person standing in a hallway",
    scene: person,
    swaps: [{ part: "grey hoodie", product: "black leather bomber jacket", image: jacket }],
    locks: [...PERSON_LOCKS, "jeans", "sneakers"],
  },
  {
    id: "clothing-outfit",
    pack: "clothing",
    title: "Clothing: full outfit, 3 items in one render",
    subject: "a person standing in a hallway",
    scene: person,
    swaps: [
      { part: "grey hoodie", product: "black leather bomber jacket", image: jacket },
      { part: "blue jeans", product: "olive green cargo pants", image: cargo },
      { part: "white sneakers", product: "white and forest-green retro sneakers", image: sneakers },
    ],
    locks: PERSON_LOCKS,
  },
  {
    id: "car-wheels",
    pack: "car",
    title: "Car: stock wheels → gloss black wheels",
    subject: "a white sedan parked in a driveway",
    scene: car,
    swaps: [{ part: "wheels (all visible wheels)", product: "gloss black 10-spoke alloy wheels", image: wheel }],
    locks: ["car body shape", "paint colour", "windows", "lights", "tyres", "background", "license plate"],
  },
  {
    id: "room-sofa",
    pack: "room",
    title: "Room: beige sofa → green velvet sofa",
    subject: "a living room",
    scene: room,
    swaps: [{ part: "beige sofa", product: "emerald green velvet sofa with brass legs", image: sofa }],
    locks: ["walls", "floor", "window", "coffee table", "floor lamp", "room layout"],
  },
  {
    id: "room-paint",
    pack: "room",
    title: "Room: wall colour, words only (no product image)",
    subject: "a living room",
    scene: room,
    swaps: [{ part: "wall colour", product: "sage green matte paint", hasImage: false, image: null }],
    locks: ["sofa", "floor", "window", "coffee table", "floor lamp", "room layout", "lighting"],
  },
  {
    id: "hero-car",
    pack: "car",
    title: "Hero: full car makeover, words only",
    subject: "a silver sedan on a rooftop car park at golden hour",
    scene: heroCar,
    swaps: [
      { part: "silver paint", product: "satin matte black wrap", hasImage: false, image: null },
      { part: "plastic hubcaps and wheels", product: "bronze 19-inch multi-spoke alloy wheels", hasImage: false, image: null },
      { part: "window glass", product: "dark limo window tint", hasImage: false, image: null },
      { part: "ride height", product: "lowered sport suspension, wheels filling the arches", hasImage: false, image: null },
    ],
    locks: ["car body shape and model", "camera angle", "background", "sky", "lighting", "ground", "shadows"],
  },
  {
    id: "hero-room",
    pack: "room",
    title: "Hero: full room makeover, words only",
    subject: "a living room",
    scene: heroRoom,
    swaps: [
      { part: "wall colour", product: "deep forest green matte paint", hasImage: false, image: null },
      { part: "brown sofa", product: "cream boucle curved three-seat sofa", hasImage: false, image: null },
      { part: "beige carpet", product: "large vintage Persian rug in rust and navy over light oak floorboards", hasImage: false, image: null },
      { part: "side table", product: "round travertine side table with a brass arc floor lamp beside it", hasImage: false, image: null },
    ],
    locks: ["room shape", "window position and size", "camera angle", "ceiling"],
  },
  {
    id: "hero-person",
    pack: "clothing",
    title: "Hero: full outfit change, words only",
    subject: "a person standing in a hallway",
    scene: person,
    swaps: [
      { part: "grey hoodie", product: "long camel wool overcoat over a black roll-neck jumper", hasImage: false, image: null },
      { part: "blue jeans", product: "charcoal tailored wool trousers", hasImage: false, image: null },
      { part: "white sneakers", product: "black leather Chelsea boots", hasImage: false, image: null },
    ],
    locks: PERSON_LOCKS,
  },
  {
    id: "hero-bare-room",
    pack: "room",
    title: "Hero: basic room → luxury styled room, words only",
    subject: "a living room",
    scene: heroBareRoom,
    swaps: [
      { part: "plain grey sofa", product: "a luxury curved cream boucle sofa with silk cushions", hasImage: false, image: null },
      { part: "plain coffee table and TV stand", product: "a sculptural travertine coffee table and a fluted walnut media console", hasImage: false, image: null },
      { part: "bare white walls", product: "warm greige limewash walls with a large framed abstract painting and brass wall sconces", hasImage: false, image: null },
      { part: "beige carpet", product: "wide herringbone oak floor with a large vintage wool rug", hasImage: false, image: null },
      { part: "empty corners and surfaces", product: "a tall olive tree in a stone planter, a brass arc floor lamp, coffee-table books, a ceramic vase and a marble tray", hasImage: false, image: null },
    ],
    locks: ["room shape", "window position and size", "camera angle", "ceiling height", "daylight direction"],
  },
  {
    id: "hero-house",
    pack: "room",
    title: "Hero: plain house front → stylish exterior, words only",
    subject: "the front of a suburban house",
    scene: heroHouse,
    swaps: [
      { part: "faded beige siding", product: "charcoal board-and-batten cladding", hasImage: false, image: null },
      { part: "white window frames and garage door", product: "black window frames and a warm cedar wood garage door", hasImage: false, image: null },
      { part: "patchy lawn and bare path", product: "a lush green lawn, a stone paver path and ornamental grasses", hasImage: false, image: null },
      { part: "front entrance", product: "a cedar front door with two black wall lanterns", hasImage: false, image: null },
    ],
    locks: ["house shape and roofline", "window positions", "camera angle", "sky", "street", "neighbouring houses"],
  },
  {
    id: "hero-room-inplace",
    pack: "room",
    title: "Hero: every piece upgraded in the same spot (for a clean slider wipe)",
    subject: "a plain living room",
    scene: heroBareRoom,
    swaps: [
      {
        part: "grey fabric sofa",
        product: "a luxury cream boucle sofa with silk cushions, the same size, in exactly the same position and at the same angle as the grey sofa",
        hasImage: false,
        image: null,
      },
      {
        part: "plain coffee table",
        product: "a sculptural travertine coffee table with coffee-table books and a ceramic vase, in exactly the same spot",
        hasImage: false,
        image: null,
      },
      {
        part: "basic TV stand",
        product: "a fluted walnut media console in exactly the same spot, with the same TV standing on it",
        hasImage: false,
        image: null,
      },
      { part: "bare white wall above the sofa", product: "a large framed abstract painting with two brass wall sconces", hasImage: false, image: null },
      { part: "beige carpet", product: "a warm oak floor with a large cream wool rug under the coffee table", hasImage: false, image: null },
      { part: "empty corner beside the sofa", product: "a tall olive tree in a stone planter and a brass arc floor lamp", hasImage: false, image: null },
    ],
    locks: [
      "the position, size and angle of the sofa, the coffee table and the TV stand",
      "the TV",
      "room shape",
      "window position, size and blinds",
      "camera angle and framing",
      "daylight direction",
    ],
  },
  {
    id: "hero-room-hardwood-base",
    pack: "room",
    title: "Hero step 1: the plain room, carpet → hardwood (nothing else)",
    subject: "a plain living room",
    scene: heroBareRoom,
    swaps: [{ part: "beige carpet", product: "a plain natural light oak hardwood floor", hasImage: false, image: null }],
    locks: ["walls", "sofa", "coffee table", "TV stand", "TV", "window and blinds", "room shape", "camera angle and framing", "lighting"],
  },
  {
    id: "hero-room-hardwood-luxe",
    pack: "room",
    title: "Hero step 2: same hardwood room, every piece upgraded in the same spot, floor unchanged",
    subject: "a plain living room with a light oak hardwood floor",
    scene: heroHardwoodRoom,
    swaps: [
      {
        part: "grey fabric sofa",
        product: "a luxury cream boucle sofa with silk cushions, the same size, in exactly the same position and at the same angle as the grey sofa",
        hasImage: false,
        image: null,
      },
      {
        part: "plain coffee table",
        product: "a sculptural travertine coffee table with coffee-table books and a ceramic vase, in exactly the same spot",
        hasImage: false,
        image: null,
      },
      {
        part: "basic TV stand",
        product: "a fluted walnut media console in exactly the same spot, with the same TV standing on it",
        hasImage: false,
        image: null,
      },
      { part: "bare white wall above the sofa", product: "a large framed abstract painting with two brass wall sconces", hasImage: false, image: null },
      { part: "open floor under the coffee table", product: "a large cream wool rug laid on top of the same oak floor", hasImage: false, image: null },
      { part: "empty corner beside the sofa", product: "a tall olive tree in a stone planter and a brass arc floor lamp", hasImage: false, image: null },
    ],
    locks: [
      "the oak hardwood floor (same boards, same colour)",
      "the position, size and angle of the sofa, the coffee table and the TV stand",
      "the TV",
      "room shape",
      "window position, size and blinds",
      "camera angle and framing",
      "daylight direction",
    ],
  },
];
