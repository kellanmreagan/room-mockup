import type { SyntheticEvent } from "react";

type PlainImageProps = {
  src: string;
  alt: string;
  className?: string;
  onError?: (event: SyntheticEvent<HTMLImageElement>) => void;
};

/**
 * Room photos are blob: object URLs. User-added products point at arbitrary
 * hosts. next/image requires a fixed images.remotePatterns list and does not
 * accept object URLs, so both cases use a plain img.
 */
export function PlainImage({ src, alt, className, onError }: PlainImageProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- blob room photos and arbitrary product hosts cannot use next/image
    <img
      src={src}
      alt={alt}
      className={className}
      draggable={false}
      onError={onError}
    />
  );
}
