"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SAMPLE_DATA_NOTE } from "@/lib/catalog";
import {
  defaultFloorQuad,
  scaleForPlacement,
  sortClickedPoints,
  type FloorPoint,
  type FloorQuad,
} from "@/lib/floor";
import { NoopRenderer } from "@/lib/mockup-renderer";
import { toStudioProduct } from "@/lib/products/adapt";
import type { CatalogProduct, SearchAllResult } from "@/lib/products/types";
import {
  CustomProduct,
  MockupDownload,
  OverlayLayout,
  ProductUrl,
  RoomPhoto,
  type ExportLayer,
} from "@/lib/studio";
import type { Placement, Product, StoreLink } from "@/lib/types";
import { trackUsage } from "@/lib/usage";
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
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [floorQuad, setFloorQuad] = useState<FloorQuad | null>(null);
  const [floorDraft, setFloorDraft] = useState<FloorPoint[]>([]);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchAllResult | null>(null);

  const products = useMemo(
    () => [...sampleItems, ...customProducts, ...catalogProducts],
    [sampleItems, customProducts, catalogProducts],
  );
  const productById = useMemo(() => {
    const map = new Map<string, Product>();
    for (const product of products) map.set(product.id, product);
    return map;
  }, [products]);

  const step = !photoUrl ? 1 : !floorQuad ? 2 : placements.length === 0 ? 3 : 4;
  const markingFloor = Boolean(photoUrl && !floorQuad);
  const showAmazonDisclosure = useMemo(() => {
    if (products.some((product) => product.retailer === "amazon")) return true;
    return Boolean(searchResult?.products.some((product) => product.retailer === "amazon"));
  }, [products, searchResult]);

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
    setFloorQuad(null);
    setFloorDraft([]);
    trackUsage("photo_uploaded", { type: file.type || "image" });
    setStatus({
      text: "Room photo ready. Click 4 floor corners, or skip / use default.",
      error: false,
    });
  }

  function commitFloor(quad: FloorQuad, method: "clicked" | "default") {
    setFloorQuad(quad);
    setFloorDraft([]);
    trackUsage("floor_marked", { method });
    setStatus({
      text:
        method === "default"
          ? "Default floor applied. Search and place items; drag them on the floor."
          : "Floor marked. Search and place items; drag them on the floor.",
      error: false,
    });
  }

  function skipFloor() {
    if (!photoUrl) {
      setStatus({ text: "Upload a room photo first.", error: true });
      return;
    }
    commitFloor(defaultFloorQuad(), "default");
  }

  function redoFloor() {
    setFloorQuad(null);
    setFloorDraft([]);
    setStatus({
      text: "Click 4 floor corners (back then front), or skip / use default.",
      error: false,
    });
  }

  function pointFromPointer(event: { clientX: number; clientY: number }, stage: HTMLElement): FloorPoint {
    const rect = stage.getBoundingClientRect();
    const width = Math.max(rect.width, 1);
    const height = Math.max(rect.height, 1);
    return {
      x: OverlayLayout.clamp(((event.clientX - rect.left) / width) * 100, 0, 100),
      y: OverlayLayout.clamp(((event.clientY - rect.top) / height) * 100, 0, 100),
    };
  }

  function addFloorPoint(event: React.PointerEvent<HTMLElement>) {
    const stage = stageRef.current;
    if (!stage || !markingFloor) return;
    const point = pointFromPointer(event, stage);
    const next = [...floorDraft, point];
    if (next.length >= 4) {
      commitFloor(sortClickedPoints(next.slice(0, 4)), "clicked");
      return;
    }
    setFloorDraft(next);
    setStatus({
      text: `Floor corner ${next.length} of 4. Click the remaining corners.`,
      error: false,
    });
  }

  function beginFloorHandleDrag(event: React.PointerEvent<HTMLButtonElement>, index: number) {
    if (!floorQuad) return;
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    event.preventDefault();
    event.stopPropagation();
    endDragRef.current?.();
    const origin = floorQuad[index];
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;

    const onMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const dx = ((moveEvent.clientX - startX) / rect.width) * 100;
      const dy = ((moveEvent.clientY - startY) / rect.height) * 100;
      setFloorQuad((current) => {
        if (!current) return current;
        const next: FloorQuad = [current[0], current[1], current[2], current[3]];
        next[index] = {
          x: OverlayLayout.clamp(origin.x + dx, 0, 100),
          y: OverlayLayout.clamp(origin.y + dy, 0, 100),
        };
        return next;
      });
    };

    const onEnd = (endEvent: PointerEvent) => {
      if (endEvent.pointerId !== pointerId) return;
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
  }

  function placeProduct(productId: string, name?: string) {
    if (!photoUrl) {
      setStatus({ text: "Upload a room photo before placing items.", error: true });
      return;
    }
    const created = OverlayLayout.create(productId, placements);
    setPlacements((current) => [...current, created]);
    setSelectedId(created.instanceId);
    trackUsage("item_placed", { id: productId.slice(0, 40) });
    const product = name ? { name } : productById.get(productId);
    setStatus({
      text: product
        ? `Placed ${product.name}. Drag it, or resize from the corner.`
        : "Placed item.",
      error: false,
    });
  }

  function placeCatalogProduct(item: CatalogProduct) {
    const product = toStudioProduct(item);
    setCatalogProducts((current) =>
      current.some((entry) => entry.id === product.id) ? current : [...current, product],
    );
    placeProduct(product.id, product.name);
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

  async function onSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (query.length > 100) {
      setStatus({ text: "Search query must be 100 characters or fewer.", error: true });
      return;
    }
    setSearching(true);
    trackUsage("search", { qLength: query.trim().length });
    try {
      const params = new URLSearchParams({ q: query.trim(), limit: "10" });
      const response = await fetch(`/api/products/search?${params.toString()}`);
      const payload = (await response.json()) as SearchAllResult & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Search failed.");
      }
      setSearchResult(payload);
      const amazon = payload.sources.find((source) => source.id === "amazon-creators");
      if (payload.usingSampleFallback) {
        setStatus({
          text: amazon?.error
            ? `Showing sample catalog — ${amazon.error}`
            : "Showing sample catalog — Amazon keys not configured",
          error: false,
        });
      } else {
        setStatus({
          text: `Found ${payload.products.length} item${payload.products.length === 1 ? "" : "s"}.`,
          error: false,
        });
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : "Search failed.";
      setStatus({ text, error: true });
    } finally {
      setSearching(false);
    }
  }

  async function onDownload() {
    if (!photoUrl || exporting) return;
    setExporting(true);
    try {
      const layers: ExportLayer[] = [];
      for (const placement of placements) {
        const product = productById.get(placement.productId);
        if (!product) continue;
        const scale = scaleForPlacement(floorQuad, placement);
        layers.push({
          name: product.name,
          src: product.imageSrc,
          x: placement.x,
          y: placement.y,
          width: placement.width * scale,
          z: placement.z,
        });
      }
      const message = await MockupDownload.save(photoUrl, layers);
      trackUsage("export", { items: layers.length });
      setStatus({ text: message, error: false });
    } catch (error) {
      const text = error instanceof Error ? error.message : "Could not download the mockup.";
      setStatus({ text, error: true });
    } finally {
      setExporting(false);
    }
  }

  const floorPoints = floorQuad ?? floorDraft;
  const fallbackNote = searchFallbackNote(searchResult);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Room Mockup</h1>
          <p className={styles.lede}>
            Upload a photo of your room, mark the floor, then place furniture and
            decor on it. The photo stays in this browser.
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

      <ol className={styles.steps} aria-label="Prototype steps">
        <Step n={1} current={step} label="Upload photo" />
        <Step n={2} current={step} label="Mark floor" />
        <Step n={3} current={step} label="Search & place" />
        <Step n={4} current={step} label="Click to shop" />
      </ol>

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
          <div className={styles.floorActions}>
            <button
              type="button"
              className={`${styles.button} ${styles.small}`}
              disabled={!photoUrl || Boolean(floorQuad)}
              onClick={skipFloor}
            >
              Skip / use default
            </button>
            <button
              type="button"
              className={`${styles.button} ${styles.small}`}
              disabled={!photoUrl}
              onClick={redoFloor}
            >
              Redo floor
            </button>
          </div>
          <div
            ref={stageRef}
            className={markingFloor ? `${styles.stage} ${styles.marking}` : styles.stage}
            onPointerDown={(event) => {
              const target = event.target;
              if (target instanceof Element && target.closest("[data-placement]")) return;
              if (target instanceof Element && target.closest("[data-floor-handle]")) return;
              if (markingFloor) {
                addFloorPoint(event);
                return;
              }
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
            {photoUrl && floorPoints.length > 0 ? (
              <svg
                className={styles.floorSvg}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {floorQuad ? (
                  <polygon className={styles.floorPoly} points={pointsAttr(floorQuad)} />
                ) : (
                  <polyline
                    className={styles.floorLine}
                    points={pointsAttr(floorDraft)}
                    fill="none"
                  />
                )}
              </svg>
            ) : null}
            {photoUrl
              ? floorPoints.map((point, index) => (
                  <button
                    key={`floor-${index}`}
                    type="button"
                    data-floor-handle
                    className={styles.floorHandle}
                    style={{ left: `${point.x}%`, top: `${point.y}%` }}
                    aria-label={`Floor corner ${index + 1}`}
                    disabled={!floorQuad}
                    onPointerDown={(event) => beginFloorHandleDrag(event, index)}
                  />
                ))
              : null}
            {photoUrl
              ? placements.map((placement) => {
                  const product = productById.get(placement.productId);
                  if (!product) return null;
                  const scale = scaleForPlacement(floorQuad, placement);
                  return (
                    <PlacedProduct
                      key={placement.instanceId}
                      placement={placement}
                      product={product}
                      displayWidth={placement.width * scale}
                      selected={placement.instanceId === selectedId}
                      onMovePointerDown={(event) => beginDrag(event, placement, "move")}
                      onResizePointerDown={(event) => beginDrag(event, placement, "resize")}
                      onRemove={() => removePlacement(placement.instanceId)}
                      onBringToFront={() => bringToFront(placement.instanceId)}
                      onShop={() => {
                        trackUsage("product_click", {
                          retailer: product.retailer ?? product.origin,
                        });
                      }}
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
                ? "Search or pick a sample item, then drag it. Resize from the corner handle."
                : "Upload a room photo before placing items."}
            </p>
          </div>

          <form className={styles.searchRow} onSubmit={onSearch}>
            <label className={styles.srOnly} htmlFor="product-search">
              Search products
            </label>
            <input
              id="product-search"
              type="search"
              value={query}
              maxLength={100}
              placeholder="Search sofa, lamp, table…"
              onChange={(event) => setQuery(event.target.value)}
            />
            <button
              type="submit"
              className={`${styles.button} ${styles.primary} ${styles.small}`}
              disabled={searching}
            >
              {searching ? "Searching…" : "Search"}
            </button>
          </form>
          {fallbackNote ? <p className={styles.fallbackNote}>{fallbackNote}</p> : null}

          {searchResult ? (
            <>
              <h3 className={styles.subhead}>Search results</h3>
              {searchResult.products.length === 0 ? (
                <p className={styles.note}>No products matched that search.</p>
              ) : (
                <ul className={styles.catalog}>
                  {searchResult.products.map((item) => (
                    <li key={item.id} className={styles.card}>
                      <div className={styles.thumb}>
                        <ProductThumb src={item.imageUrl} name={item.title} />
                      </div>
                      <div>
                        <h3>{item.title}</h3>
                        <p className={styles.origin}>
                          <span className={styles.badge}>{item.retailer}</span>{" "}
                          {availabilityLabel(item.availability)}
                        </p>
                        <PriceLine
                          price={item.price}
                          currency={item.currency}
                          fetchedAt={item.fetchedAt}
                        />
                        <button
                          type="button"
                          className={`${styles.button} ${styles.small} ${styles.primary}`}
                          disabled={!photoUrl}
                          aria-describedby="place-requirement"
                          onClick={() => placeCatalogProduct(item)}
                        >
                          Place
                        </button>{" "}
                        <ShopAnchor
                          href={item.affiliateUrl ?? item.productUrl}
                          onClick={() => {
                            trackUsage("product_click", { retailer: item.retailer });
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}

          <h3 className={styles.subhead}>Sample catalog</h3>
          <ul className={styles.catalog}>
            {[...sampleItems, ...customProducts].map((product) => (
              <li key={product.id} className={styles.card}>
                <div className={styles.thumb}>
                  <ProductThumb src={product.imageSrc} name={product.name} />
                </div>
                <div>
                  <h3>{product.name}</h3>
                  <p className={styles.origin}>
                    {product.retailer ? (
                      <span className={styles.badge}>{product.retailer}</span>
                    ) : null}{" "}
                    {product.origin === "sample" ? "Sample type" : "Your product"}
                  </p>
                  <PriceLine
                    price={product.price ?? null}
                    currency={product.currency ?? null}
                    fetchedAt={product.fetchedAt}
                  />
                  <button
                    type="button"
                    className={`${styles.button} ${styles.small} ${styles.primary}`}
                    disabled={!photoUrl}
                    aria-describedby="place-requirement"
                    onClick={() => placeProduct(product.id)}
                  >
                    Place in room
                  </button>
                  {product.shopUrl ? (
                    <>
                      {" "}
                      <ShopAnchor
                        href={product.shopUrl}
                        onClick={() => {
                          trackUsage("product_click", {
                            retailer: product.retailer ?? product.origin,
                          });
                        }}
                      />
                    </>
                  ) : (
                    <StoreLinks links={product.links} />
                  )}
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
      {showAmazonDisclosure ? (
        <p className={styles.disclosure}>
          As an Amazon Associate we earn from qualifying purchases.
        </p>
      ) : null}
    </div>
  );
}

function Step({ n, current, label }: { n: number; current: number; label: string }) {
  const className =
    n === current ? `${styles.step} ${styles.stepActive}` : n < current ? `${styles.step} ${styles.stepDone}` : styles.step;
  return (
    <li className={className}>
      {n} {label}
    </li>
  );
}

function pointsAttr(points: readonly FloorPoint[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function searchFallbackNote(result: SearchAllResult | null): string | null {
  if (!result?.usingSampleFallback) return null;
  const amazon = result.sources.find((source) => source.id === "amazon-creators");
  if (amazon?.error) return `Showing sample catalog — ${amazon.error}`;
  return "Showing sample catalog — Amazon keys not configured";
}

function availabilityLabel(value: CatalogProduct["availability"] | undefined): string {
  if (value === "in_stock") return "In stock";
  if (value === "out_of_stock") return "Out of stock";
  return "Availability unknown";
}

function formatPrice(price: number, currency: string | null): string {
  if (!currency || currency === "USD") return `$${price.toFixed(2)}`;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(price);
  } catch {
    return `${price} ${currency}`;
  }
}

function formatFetchedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

function PriceLine({
  price,
  currency,
  fetchedAt,
}: {
  price: number | null;
  currency: string | null;
  fetchedAt?: string;
}) {
  if (price === null || price === undefined) return null;
  return (
    <p className={styles.priceAsOf}>
      {formatPrice(price, currency)}
      {fetchedAt ? ` as of ${formatFetchedAt(fetchedAt)}` : null}
    </p>
  );
}

function ShopAnchor({ href, onClick }: { href: string; onClick?: () => void }) {
  if (!href) return null;
  return (
    <a
      className={styles.shopLink}
      href={href}
      target="_blank"
      rel="sponsored noopener noreferrer"
      onClick={onClick}
    >
      Shop
    </a>
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
  displayWidth,
  selected,
  onMovePointerDown,
  onResizePointerDown,
  onRemove,
  onBringToFront,
  onShop,
}: {
  placement: Placement;
  product: Product;
  displayWidth: number;
  selected: boolean;
  onMovePointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onResizePointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onRemove: () => void;
  onBringToFront: () => void;
  onShop: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const shopHref = product.shopUrl ?? product.links[0]?.href;
  return (
    <div
      data-placement
      className={selected ? `${styles.placed} ${styles.selected}` : styles.placed}
      style={{
        left: `${placement.x}%`,
        top: `${placement.y}%`,
        width: `${displayWidth}%`,
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
        {shopHref ? (
          <a
            className={styles.toolButton}
            href={shopHref}
            target="_blank"
            rel="sponsored noopener noreferrer"
            onClick={onShop}
          >
            Shop
          </a>
        ) : null}
        {product.links.length > 1 ? (
          <details className={styles.buy}>
            <summary className={styles.toolButton}>Buy / View</summary>
            <StoreLinks links={product.links} menu />
          </details>
        ) : null}
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
