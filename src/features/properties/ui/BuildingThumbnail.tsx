import { useEffect, useState } from "react";
import { Icon } from "@/shared/ui";

export default function BuildingThumbnail({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  return <span className="building-thumbnail">
    {src && !failed ? <img src={src} alt={`Ảnh tòa nhà ${name}`} loading="lazy" decoding="async" onError={() => setFailed(true)} /> : <Icon name="building" size={22} />}
  </span>;
}
