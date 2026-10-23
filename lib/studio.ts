import type { Placement, Product, StoreLink } from "./types";

/**
 * Real storefront search URLs built from a generic query.
 * These are not product pages and do not include a price.
 */
export class StoreSearch {
  static linksFor(query: string): StoreLink[] {
    const q = encodeURIComponent(query.trim());
    return [
      { store: "Amazon", href: `https://www.amazon.com/s?k=${q}` },
      {
        store: "Wayfair",
        href: `https://www.wayfair.com/keyword.php?keyword=${q}`,
      },
      { store: "IKEA", href: `https://www.ikea.com/us/en/search/?q=${q}` },
      { store: "eBay", href: `https://www.ebay.com/sch/i.html?_nkw=${q}` },
      {
        store: "Facebook Marketplace",
        href: `https://www.facebook.com/marketplace/search/?query=${q}`,
      },
    ];
  }
}

export class ProductUrl {
  static isHttpUrl(value: string): boolean {
    try {
      const url = new URL(value.trim());
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }
}

export class RoomPhoto {
  static isImage(file: File): boolean {
    if (file.type.startsWith("image/")) return true;
    return /\.(avif|bmp|gif|jpe?g|png|svg|webp|heic|heif)$/i.test(file.name);
  }

  static revoke(url: string | null): void {
    if (url) URL.revokeObjectURL(url);
  }
}

export class CustomProduct {
  static create(name: string, pageUrl: string, imageUrl: string): Product {
    return {
      id: crypto.randomUUID(),
      name: name.trim(),
      imageSrc: imageUrl.trim(),
      origin: "custom",
      links: [{ store: "Product page", href: pageUrl.trim() }],
    };
  }
}

export class OverlayLayout {
  static clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  static nextZ(placements: readonly Placement[]): number {
    return placements.reduce((max, item) => Math.max(max, item.z), 0) + 1;
  }

  static create(productId: string, existing: readonly Placement[]): Placement {
    const slot = existing.length;
    const column = slot % 3;
    const row = Math.floor(slot / 3) % 3;
    return {
      instanceId: crypto.randomUUID(),
      productId,
      x: 6 + column * 24,
      y: 8 + row * 18,
      width: 30,
      z: OverlayLayout.nextZ(existing),
    };
  }

  static moved(
    originX: number,
    originY: number,
    dxPx: number,
    dyPx: number,
    stageWidth: number,
    stageHeight: number,
  ): { x: number; y: number } {
    return {
      x: OverlayLayout.clamp(originX + (dxPx / stageWidth) * 100, -20, 95),
      y: OverlayLayout.clamp(originY + (dyPx / stageHeight) * 100, -20, 95),
    };
  }

  static resized(originWidth: number, dxPx: number, stageWidth: number): number {
    return OverlayLayout.clamp(originWidth + (dxPx / stageWidth) * 100, 8, 92);
  }
}

export interface ExportLayer {
  name: string;
  src: string;
  x: number;
  y: number;
  width: number;
  z: number;
}

export class MockupDownload {
  static async save(photoUrl: string, layers: readonly ExportLayer[]): Promise<string> {
    const photo = await MockupDownload.loadImage(photoUrl, false).catch(() => {
      throw new Error("Could not read that room photo. Try a JPEG or PNG.");
    });
    if (photo.naturalWidth < 1 || photo.naturalHeight < 1) {
      throw new Error("That room photo has no visible pixels. Try another image.");
    }

    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(photo.naturalWidth, photo.naturalHeight));
    const width = Math.max(1, Math.round(photo.naturalWidth * scale));
    const height = Math.max(1, Math.round(photo.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not start image export in this browser.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(photo, 0, 0, width, height);

    const ordered = [...layers].sort((a, b) => a.z - b.z);
    for (const layer of ordered) {
      const image = await MockupDownload.loadImage(
        layer.src,
        MockupDownload.isCrossOrigin(layer.src),
      ).catch(() => {
        throw new Error(
          `Could not download. "${layer.name}" blocked canvas export (CORS). Remove that product and try again, or keep using the on-screen mockup.`,
        );
      });
      MockupDownload.drawLayer(context, image, layer, width, height);
    }

    const url = MockupDownload.toPng(canvas);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "room-mockup.png";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return "Downloaded room-mockup.png.";
  }

  private static drawLayer(
    context: CanvasRenderingContext2D,
    image: HTMLImageElement,
    layer: ExportLayer,
    stageWidth: number,
    stageHeight: number,
  ): void {
    if (image.naturalWidth < 1 || image.naturalHeight < 1) {
      throw new Error(`Could not draw "${layer.name}".`);
    }
    const drawWidth = (layer.width / 100) * stageWidth;
    const drawHeight = drawWidth * (image.naturalHeight / image.naturalWidth);
    const drawX = (layer.x / 100) * stageWidth;
    const drawY = (layer.y / 100) * stageHeight;
    context.save();
    context.shadowColor = "rgba(255,255,255,0.9)";
    context.shadowBlur = 8;
    context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    context.shadowColor = "transparent";
    context.shadowBlur = 0;
    context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    context.restore();
  }

  private static toPng(canvas: HTMLCanvasElement): string {
    try {
      return canvas.toDataURL("image/png");
    } catch {
      throw new Error(
        "Could not download. A product image from another site blocked canvas export (CORS). Remove that item and try again.",
      );
    }
  }

  private static isCrossOrigin(src: string): boolean {
    if (src.startsWith("blob:") || src.startsWith("data:")) return false;
    try {
      return new URL(src, window.location.href).origin !== window.location.origin;
    } catch {
      return true;
    }
  }

  private static loadImage(src: string, crossOrigin: boolean): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      if (crossOrigin) image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("load failed"));
      image.src = src;
    });
  }
}
