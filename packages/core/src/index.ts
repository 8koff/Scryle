export { BRAND, LEGAL } from "./brand";

export type { CaptureStep, Pack, PackId, PartDef } from "./packs/types";
export { getPack, isPackId, PACKS } from "./packs/registry";

export { BoxSchema, DetectedPartSchema, SceneAnalysisSchema } from "./scene/schema";
export type { Box, DetectedPart, SceneAnalysis } from "./scene/schema";
export { partAtPoint } from "./scene/parts";

export { buildEditPrompt, type EditPromptInput, type Swap } from "./render/prompt";
export { buildRenderPlan, type RenderPlan, type Selection } from "./render/plan";
export { nearestAspectRatio } from "./render/aspect";

export {
  APPLE_PRODUCT_PREFIX,
  appleProductId,
  CREDIT_PACKS,
  creditPackForAppleProduct,
  creditPack,
  FREE_RENDERS,
  formatUsd,
  INVITE_RENDERS,
  isCreditPackId,
  MAX_SWAPS_PER_PICTURE,
  packMargin,
  packSavingPercent,
} from "./credits";
export type { CreditPack, CreditPackId, PaymentStore } from "./credits";

export type {
  ApiErrorCode,
  ApiResponse,
  CheckoutDone,
  CreditsInfo,
  InviteInfo,
  RenderCard,
  RenderStart,
  RenderRequestStatus,
  RenderStatus,
  Reopened,
  ScanResult,
  SelectionInput,
} from "./api";

export { fitsPart, STUDIO_OPTIONS, studioParts } from "./studio";
export type { StudioOption, StudioPart } from "./studio";
