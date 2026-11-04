import { useEffect, useState } from "react";
import { idStr, type Id } from "@/shared/lib/id";
import { propertyApi } from "@/features/properties/api/propertyApi";

export const PLACEHOLDER_IMAGE =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="750"><rect width="1200" height="750" fill="#e9eeea"/><g fill="#b9c7c2"><rect x="430" y="260" width="340" height="300" rx="12"/><rect x="465" y="300" width="70" height="70" rx="6"/><rect x="565" y="300" width="70" height="70" rx="6"/><rect x="665" y="300" width="70" height="70" rx="6"/><rect x="465" y="405" width="70" height="70" rx="6"/><rect x="665" y="405" width="70" height="70" rx="6"/><rect x="565" y="450" width="70" height="110" rx="6"/></g></svg>',
  );

// Ảnh phòng đọc công khai qua properties-service nên khách vãng lai cũng tải được;
// danh sách URL được cache theo roomId để không gọi lặp lại.
const imageCache = new Map<string, string[]>();
const imageRequests = new Map<string, Promise<string[]>>();

export const loadRoomImageUrls = (roomId: Id): Promise<string[]> => {
  const key = idStr(roomId);
  const cached = imageCache.get(key);
  if (cached) return Promise.resolve(cached);
  const inflight = imageRequests.get(key);
  if (inflight) return inflight;
  const request = propertyApi
    .roomImages(key)
    .then((list) => {
      const urls = list.map((image) => image.imageUrl).filter((url): url is string => Boolean(url));
      imageCache.set(key, urls);
      return urls;
    })
    .catch((error) => {
      imageCache.set(key, []);
      throw error;
    })
    .finally(() => {
      imageRequests.delete(key);
    });
  imageRequests.set(key, request);
  return request;
};

export default function RoomThumb({ roomId, alt, className }: { roomId: Id; alt: string; className?: string }) {
  const key = idStr(roomId);
  const [src, setSrc] = useState<string | null>(() => imageCache.get(key)?.[0] ?? null);

  useEffect(() => {
    const cached = imageCache.get(key);
    if (cached) {
      setSrc(cached[0] ?? null);
      return;
    }
    let cancelled = false;
    loadRoomImageUrls(key)
      .then((urls) => {
        if (!cancelled) setSrc(urls[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return <img src={src ?? PLACEHOLDER_IMAGE} alt={src ? alt : ""} loading="lazy" className={className} />;
}
