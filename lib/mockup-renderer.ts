import type { Placement } from "./types";

export interface MockupRenderRequest {
  roomPhotoUrl: string;
  placements: readonly Placement[];
}

export interface MockupRenderResult {
  imageUrl: string;
}

/**
 * Turns a room photo plus placements into a finished mockup image.
 *
 * TODO: a real implementation would call an image-edit model, for example
 * OpenAI gpt-image-1 images/edits with OPENAI_API_KEY, or Replicate SDXL
 * inpainting with REPLICATE_API_TOKEN. It would send the room photo and a
 * mask of the placed items, then return the edited image.
 * NoopRenderer does not call a network. The page composites overlays by hand.
 */
export interface MockupRenderer {
  readonly id: string;
  readonly label: string;
  isAvailable(): boolean;
  render(request: MockupRenderRequest): Promise<MockupRenderResult | null>;
}

export class NoopRenderer implements MockupRenderer {
  static readonly unavailableReason =
    "AI render needs an API key: OPENAI_API_KEY for OpenAI gpt-image-1 image edits, or REPLICATE_API_TOKEN for Replicate SDXL inpainting. This build only places overlays on your photo.";

  readonly id = "noop";
  readonly label = "Manual overlay";

  isAvailable(): boolean {
    return false;
  }

  async render(): Promise<null> {
    return null;
  }
}
