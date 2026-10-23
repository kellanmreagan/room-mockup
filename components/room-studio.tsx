"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SAMPLE_DATA_NOTE } from "@/lib/catalog";
import { NoopRenderer } from "@/lib/mockup-renderer";
import {
  CustomProduct,
  MockupDownload,
  OverlayLayout,
  ProductUrl,
  RoomPhoto,
  type ExportLayer,
} from "@/lib/studio";
import type { Placement, Product, StoreLink } from "@/lib/types";
import { PlainImage } from "./plain-image";
import styles from "./room-studio.module.css";

type RoomStudioProps = {
  sampleItems: readonly Product[];
};

type Status = {
  text: string;
  error: boolean;
};

type DragMode = "move" | "resize";

type DragSession = {
  pointerId: number;
  instanceId: string;
  mode: DragMode;
  originX: number;
  originY: number;
  originWidth: number;
  startX: number;
  startY: number;
  stageWidth: number;
  stageHeight: number;
};

export function RoomStudio({ sampleItems }: RoomStudioProps) {
  const renderer = useMemo(() => new NoopRenderer(), []);
  const stageRef = useRef<HTMLDivElement>(null);
  const photoUrlRef = useRef<string | null>(null);
  const endDragRef = useRef<(() => void) | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [customProducts, setCustomProducts] = useState<Product[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const products = useMemo(
    () => [...sampleItems, ...customProducts],
    [sampleItems, customProducts],
  );
  const productById = useMemo(() => {
    const map = new Map<string, Product>();
    for (const product of products) map.set(product.id, product);
    return map;
  }, [products]);

  useEffect(() => {
    return () => {
      endDragRef.current?.();
      RoomPhoto.revoke(photoUrlRef.current);
    };
  }, []);

  function onPhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!RoomPhoto.isImage(file)) {
      setStatus({ text: "Choose an image file.", error: true });
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    RoomPhoto.revoke(photoUrlRef.current);
    photoUrlRef.current = nextUrl;
    setPhotoUrl(nextUrl);
    setStatus({
      text: "Room photo ready. Place an item from the panel.",
      error: false,
    });
  }

  function placeProduct(productId: string) {
    if (!photoUrl) {
      setStatus({ text: "Upload a room photo before placing items.", error: true });
      return;
    }
    const created = OverlayLayout.create(productId, placements);
    setPlacements((current) => [...current, created]);
    setSelectedId(created.instanceId);
    const product = productById.get(productId);
    setStatus({
      text: product
        ? `Placed ${product.name}. Drag it, or resize from the corner.`
        : "Placed item.",
      error: false,
    });
  }

  function removePlacement(instanceId: string) {
    setPlacements((current) => current.filter((item) => item.instanceId !== instanceId));
    setSelectedId((current) => (current === instanceId ? null : current));
  }

  function bringToFront(instanceId: string) {
    setSelectedId(instanceId);
    setPlacements((current) => {
      const z = OverlayLayout.nextZ(current);
      return current.map((item) =>
        item.instanceId === instanceId ? { ...item, z } : item,
      );
    });
  }

  function beginDrag(
    event: React.PointerEvent<HTMLElement>,
    placement: Placement,
    mode: DragMode,
  ) {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    event.preventDefault();
    endDragRef.current?.();

    const session: DragSession = {
      pointerId: event.pointerId,
      instanceId: placement.instanceId,
      mode,
      originX: placement.x,
      originY: placement.y,
      originWidth: placement.width,
      startX: event.clientX,
      startY: event.clientY,
      stageWidth: rect.width,
      stageHeight: rect.height,
    };

    const onMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== session.pointerId) return;
      const dx = moveEvent.clientX - session.startX;
      const dy = moveEvent.clientY - session.startY;
      setPlacements((current) =>
        current.map((item) => {
          if (item.instanceId !== session.instanceId) return item;
          if (session.mode === "resize") {
            return {
              ...item,
              width: OverlayLayout.resized(session.originWidth, dx, session.stageWidth),
            };
          }
          const moved = OverlayLayout.moved(
            session.originX,
            session.originY,
            dx,
            dy,
            session.stageWidth,
            session.stageHeight,
          );
          return { ...item, ...moved };
        }),
      );
    };

    const onEnd = (endEvent: PointerEvent) => {
      if (endEvent.pointerId !== session.pointerId) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      endDragRef.current = null;
    };

    endDragRef.current = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    bringToFront(placement.instanceId);
  }

  function onAddProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "");
    const pageUrl = String(data.get("pageUrl") ?? "");
    const imageUrl = String(data.get("imageUrl") ?? "");
    if (name.trim().length === 0) {
      setFormError("Enter a product name.");
      return;
    }
    if (name.trim().length > 120) {
      setFormError("Use a product name of 120 characters or fewer.");
      return;
    }
    if (!ProductUrl.isHttpUrl(pageUrl)) {
      setFormError("Product page URL must start with http:// or https://.");
      return;
    }
    if (!ProductUrl.isHttpUrl(imageUrl)) {
      setFormError("Image URL must start with http:// or https://.");
      return;
    }
    const product = CustomProduct.create(name, pageUrl, imageUrl);
    setCustomProducts((current) => [...current, product]);
    form.reset();
    setFormError(null);
    setStatus({ text: `Added "${product.name}" to the panel.`, error: false });
  }

  async function onDownload() {
    if (!photoUrl || exporting) return;
    setExporting(true);
    try {
      const layers: ExportLayer[] = [];
      for (const placement of placements) {
        const product = productById.get(placement.productId);
        if (!product) continue;
        layers.push({
          name: product.name,
          src: product.imageSrc,
          x: placement.x,
          y: placement.y,
          width: placement.width,
          z: placement.z,
        });
      }
      const message = await MockupDownload.save(photoUrl, layers);
      setStatus({ text: message, error: false });
    } catch (error) {
      const text = error instanceof Error ? error.message : "Could not download the mockup.";
      setStatus({ text, error: true });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Room Mockup</h1>
          <p className={styles.lede}>
            Upload a photo of your room, then place furniture and decor on it.
            The photo stays in this browser.
          </p>
        </div>
        <div className={styles.actions}>
          <label className={`${styles.button} ${styles.fileButton}`}>
            <input
              className={styles.fileInput}
              type="file"
              accept="image/*"
              onChange={onPhotoChange}
            />
            {photoUrl ? "Replace photo" : "Upload room photo"}
          </label>
          <button
            type="button"
            className={styles.button}
            disabled={!photoUrl || exporting}
            title="Saves a PNG of the photo and placed items. Images from other sites can block this if they do not allow canvas access."
            onClick={() => {
              void onDownload();
            }}
          >
            {exporting ? "Preparing PNG..." : "Download mockup"}
          </button>
          <span className={styles.tip} title={NoopRenderer.unavailableReason}>
            <button
              type="button"
              className={styles.button}
              disabled={!renderer.isAvailable()}
              aria-describedby="ai-render-note"
            >
              AI render (coming soon)
            </button>
          </span>
        </div>
      </header>
      <p id="ai-render-note" className={styles.note}>
        {NoopRenderer.unavailableReason}
      </p>
      <p
        className={status?.error ? styles.statusError : styles.status}
        role="status"
        aria-live="polite"
      >
        {status?.text ?? ""}
      </p>

      <div className={styles.workspace}>
        <section className={styles.stageFrame} aria-label="Room canvas">
          <div className={styles.stageHeader}>
            <h2>Your room</h2>
            <p className={styles.note}>Preview: {renderer.label}</p>
          </div>
          <div
            ref={stageRef}
            className={styles.stage}
            onPointerDown={(event) => {
              const target = event.target;
              if (target instanceof Element && target.closest("[data-placement]")) return;
              setSelectedId(null);
            }}
          >
            {photoUrl ? (
              <PlainImage
                src={photoUrl}
                alt="Your room"
                className={styles.photo}
                onError={() => {
                  setStatus({
                    text: "That image could not be shown in this browser. Try a JPEG or PNG.",
                    error: true,
                  });
                }}
              />
            ) : (
              <div className={styles.empty}>
                <p>Upload a room photo to start placing furniture.</p>
              </div>
            )}
            {photoUrl
              ? placements.map((placement) => {
                  const product = productById.get(placement.productId);
                  if (!product) return null;
                  return (
                    <PlacedProduct
                      key={placement.instanceId}
                      placement={placement}
                      product={product}
                      selected={placement.instanceId === selectedId}
                      onMovePointerDown={(event) => beginDrag(event, placement, "move")}
                      onResizePointerDown={(event) => beginDrag(event, placement, "resize")}
                      onRemove={() => removePlacement(placement.instanceId)}
                      onBringToFront={() => bringToFront(placement.instanceId)}
                    />
                  );
                })
              : null}
          </div>
        </section>

        <section className={styles.panel} aria-labelledby="products-heading">
          <div className={styles.panelHeader}>
            <h2 id="products-heading">Products</h2>
            <p className={styles.disclaimer}>{SAMPLE_DATA_NOTE}</p>
            <p id="place-requirement" className={styles.note}>
              {photoUrl
                ? "Place an item, then drag it. Resize from the corner handle."
                : "Upload a room photo before placing items."}
            </p>
          </div>
          <ul className={styles.catalog}>
            {products.map((product) => (
              <li key={product.id} className={styles.card}>
                <div className={styles.thumb}>
                  <ProductThumb src={product.imageSrc} name={product.name} />
                </div>
                <div>
                  <h3>{product.name}</h3>
                  <p className={styles.origin}>
                    {product.origin === "sample" ? "Sample type" : "Your product"}
                  </p>
                  <button
                    type="button"
                    className={`${styles.button} ${styles.small} ${styles.primary}`}
                    disabled={!photoUrl}
                    aria-describedby="place-requirement"
                    onClick={() => placeProduct(product.id)}
                  >
                    Place in room
                  </button>
                  <StoreLinks links={product.links} />
                </div>
              </li>
            ))}
          </ul>

          <form className={styles.form} autoComplete="off" onSubmit={onAddProduct}>
            <h3>Add your own product</h3>
            <p className={styles.note}>
              Paste a real product page and a direct image address. It is stored only in
              this browser and can be placed like the sample items.
            </p>
            <label htmlFor="custom-name">Product name</label>
            <input id="custom-name" name="name" type="text" required maxLength={120} />
            <label htmlFor="custom-page">Product page URL</label>
            <input
              id="custom-page"
              name="pageUrl"
              type="url"
              inputMode="url"
              required
              autoComplete="off"
              spellCheck={false}
              placeholder="https://"
            />
            <label htmlFor="custom-image">Image URL</label>
            <input
              id="custom-image"
              name="imageUrl"
              type="url"
              inputMode="url"
              required
              autoComplete="off"
              spellCheck={false}
              placeholder="https://"
            />
            {formError ? (
              <p id="add-product-error" className={styles.statusError} role="alert">
                {formError}
              </p>
            ) : null}
            <button type="submit" className={`${styles.button} ${styles.primary}`}>
              Add product
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

function StoreLinks({ links, menu = false }: { links: readonly StoreLink[]; menu?: boolean }) {
  return (
    <ul className={menu ? styles.menu : styles.links}>
      {links.map((link) => (
        <li key={`${link.store}-${link.href}`}>
          <a href={link.href} target="_blank" rel="noopener noreferrer">
            Buy / View · {link.store}
          </a>
        </li>
      ))}
    </ul>
  );
}

function ProductThumb({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <span className={styles.thumbFallback}>{name}</span>;
  }
  return (
    <PlainImage
      src={src}
      alt=""
      className={styles.thumbImage}
      onError={() => setFailed(true)}
    />
  );
}

function PlacedProduct({
  placement,
  product,
  selected,
  onMovePointerDown,
  onResizePointerDown,
  onRemove,
  onBringToFront,
}: {
  placement: Placement;
  product: Product;
  selected: boolean;
  onMovePointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onResizePointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onRemove: () => void;
  onBringToFront: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <div
      data-placement
      className={selected ? `${styles.placed} ${styles.selected}` : styles.placed}
      style={{
        left: `${placement.x}%`,
        top: `${placement.y}%`,
        width: `${placement.width}%`,
        zIndex: placement.z,
      }}
      onPointerDown={onMovePointerDown}
    >
      {imageFailed ? (
        <div className={styles.missingImage}>{product.name}</div>
      ) : (
        <PlainImage
          src={product.imageSrc}
          alt={product.name}
          className={styles.placedImage}
          onError={() => setImageFailed(true)}
        />
      )}
      <div
        className={styles.toolbar}
        data-control
        onPointerDown={(event) => event.stopPropagation()}
      >
        <details className={styles.buy}>
          <summary className={styles.toolButton}>Buy / View</summary>
          <StoreLinks links={product.links} menu />
        </details>
        <button type="button" className={styles.toolButton} onClick={onBringToFront}>
          Bring to front <span className={styles.srOnly}>{product.name}</span>
        </button>
        <button
          type="button"
          className={`${styles.toolButton} ${styles.danger}`}
          onClick={onRemove}
        >
          Remove <span className={styles.srOnly}>{product.name}</span>
        </button>
      </div>
      <button
        type="button"
        className={styles.handle}
        aria-label={`Resize ${product.name}`}
        onPointerDown={(event) => {
          event.stopPropagation();
          onResizePointerDown(event);
        }}
      />
    </div>
  );
}
