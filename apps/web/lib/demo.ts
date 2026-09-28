import type { Box } from "@retrofit/core";
import heroCarAfter from "@/public/demo/hero-car-after.jpg";
import heroCarBefore from "@/public/demo/hero-car-before.jpg";
import heroRoomAfter from "@/public/demo/hero-room-after.jpg";
import heroRoomBefore from "@/public/demo/hero-room-before.jpg";
import object from "@/public/demo/object.jpg";
import personAfter from "@/public/demo/person-after.jpg";
import personBefore from "@/public/demo/person-before.jpg";
import personOutfit from "@/public/demo/person-outfit.jpg";
import productJacket from "@/public/demo/product-jacket.jpg";
import productSofa from "@/public/demo/product-sofa.jpg";
import productWheel from "@/public/demo/product-wheel.jpg";
import roomAfter from "@/public/demo/room-after.jpg";
import roomBefore from "@/public/demo/room-before.jpg";
import tryOnBase from "@/public/demo/tryon-base.jpg";
import tryOnCosy from "@/public/demo/tryon-cosy.jpg";
import tryOnDate from "@/public/demo/tryon-date.jpg";
import tryOnOffice from "@/public/demo/tryon-office.jpg";
import tryOnSummer from "@/public/demo/tryon-summer.jpg";
import wheelAfter from "@/public/demo/wheel-after.jpg";
import wheelBefore from "@/public/demo/wheel-before.jpg";

/**
 * Example swaps shown on the home screen. All photos are AI-generated stand-ins from the
 * P0 render test, not real people; the "after" images are real Higgsfield renders.
 * Boxes come from the photo reader (Claude) output for the same photos.
 */
export const DEMO = {
  person: {
    before: personBefore,
    after: personAfter,
    outfit: personOutfit,
    aspect: 3 / 4,
    parts: {
      top: { x: 0.311, y: 0.158, w: 0.406, h: 0.381 } satisfies Box,
      bottoms: { x: 0.386, y: 0.527, w: 0.251, h: 0.352 } satisfies Box,
      shoes: { x: 0.357, y: 0.869, w: 0.316, h: 0.112 } satisfies Box,
    },
    product: { image: productJacket, title: "Black leather bomber", part: "Outerwear" },
  },
  room: {
    before: roomBefore,
    after: roomAfter,
    aspect: 4 / 3,
    sofa: { x: 0.183, y: 0.429, w: 0.717, h: 0.56 } satisfies Box,
    product: { image: productSofa, title: "Emerald velvet sofa", part: "Sofa" },
  },
  wheel: {
    before: wheelBefore,
    after: wheelAfter,
    aspect: 4 / 5,
    wheel: { x: 0.27, y: 0.2, w: 0.4, h: 0.52 } satisfies Box,
    product: { image: productWheel, title: "Gloss black 10-spoke", part: "Wheels" },
  },
  object,
} as const;

/**
 * Home-page hero: big, several-part makeovers (Higgsfield Marketing Studio low/2k, words-only
 * swaps, 2026-09-24). Plain "before" scenes on purpose, so the change is dramatic.
 * Boxes are hand-placed on the rendered photos.
 */
export const HERO_DEMO = {
  car: {
    before: heroCarBefore,
    after: heroCarAfter,
    aspect: 2400 / 1343,
    box: { x: 0.13, y: 0.35, w: 0.73, h: 0.45 } satisfies Box,
    swaps: [
      { part: "Paint", to: "Satin matte black" },
      { part: "Wheels", to: "Bronze 19-inch" },
      { part: "Windows", to: "Dark tint" },
      { part: "Stance", to: "Lowered" },
    ],
  },
  room: {
    before: heroRoomBefore,
    after: heroRoomAfter,
    aspect: 2688 / 1520,
    // Mirrored left-right when saved, so the new sofa and art land on the "after" side.
    box: { x: 0.53, y: 0.38, w: 0.45, h: 0.55 } satisfies Box,
    swaps: [
      { part: "Sofa", to: "Cream bouclé" },
      { part: "Tables", to: "Travertine, walnut" },
      { part: "Walls", to: "Art, brass sconces" },
      { part: "Rug", to: "Cream wool" },
      { part: "Extras", to: "Olive tree, arc lamp" },
    ],
  },
  // The try-on woman's date-night look (same photos as TRY_ON_DEMO, below).
  person: {
    before: tryOnBase,
    after: tryOnDate,
    aspect: 1744 / 2336,
    box: { x: 0.33, y: 0.14, w: 0.34, h: 0.8 } satisfies Box,
    swaps: [
      { part: "Top and jeans", to: "Black satin slip dress" },
      { part: "Shoes", to: "Strappy heels" },
      { part: "Extras", to: "Gold bracelet" },
    ],
  },
} as const;

/**
 * Home-page try-on: one AI-generated woman, four words-only outfit renders
 * (Higgsfield Marketing Studio low/2k, 2026-09-27, ~$0.13 in total). Same face, pose and room in each.
 */
export const TRY_ON_DEMO = {
  before: tryOnBase,
  aspect: 1744 / 2336,
  beforeAlt: "A woman in a white t-shirt, light blue jeans and white sneakers, standing in her apartment",
  looks: [
    {
      id: "date",
      label: "Date night",
      image: tryOnDate,
      pieces: ["Black satin slip dress", "Strappy heels", "Gold bracelet"],
      alt: "The same woman in a black satin slip dress and black strappy heeled sandals",
    },
    {
      id: "summer",
      label: "Summer day",
      image: tryOnSummer,
      pieces: ["Yellow floral sundress", "Tan sandals"],
      alt: "The same woman in a yellow floral linen sundress and tan flat sandals",
    },
    {
      id: "office",
      label: "Smart casual",
      image: tryOnOffice,
      pieces: ["Beige blazer", "Wide-leg trousers", "Black loafers"],
      alt: "The same woman in an oversized beige blazer, black wide-leg trousers and black loafers",
    },
    {
      id: "cosy",
      label: "Cosy autumn",
      image: tryOnCosy,
      pieces: ["Cream cardigan", "Pleated midi skirt", "Knee boots"],
      alt: "The same woman in a cream cable-knit cardigan, a brown pleated midi skirt and tall brown boots",
    },
  ],
} as const;
