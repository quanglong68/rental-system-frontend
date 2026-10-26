import { Link, useNavigate } from "react-router";
import { Icon } from "@/shared/ui";
import type { BuildingSearchResult } from "@/features/properties/api/propertyApi";
import BuildingThumbnail from "./BuildingThumbnail";

type Props = {
  buildings: BuildingSearchResult[];
  deletingId: string | null;
  onEdit: (building: BuildingSearchResult) => void;
  onDelete: (building: BuildingSearchResult) => void;
};

const area = (building: BuildingSearchResult) => [building.wardName, building.provinceName].filter(Boolean).join(", ") || "Chưa có tên địa bàn";
const roomPath = (id: string) => `/admin/buildings/${encodeURIComponent(id)}/rooms`;

function BuildingActions({ building, deletingId, onEdit, onDelete }: Props & { building: BuildingSearchResult }) {
  return <div className="building-actions" onClick={(event) => event.stopPropagation()}>
    <Link className="building-view-link" to={roomPath(building.buildingId)}>Xem phòng <Icon name="chevron" size={15} /></Link>
    <button type="button" className="building-icon-action" title={`Sửa ${building.name}`} aria-label={`Sửa ${building.name}`} onClick={() => onEdit(building)}><Icon name="edit" size={17} /></button>
    <button type="button" className="building-icon-action building-icon-danger" title={`Xóa ${building.name}`} aria-label={`Xóa ${building.name}`} disabled={deletingId === building.buildingId} onClick={() => onDelete(building)}><Icon name="trash" size={17} /></button>
  </div>;
}

export default function BuildingList(props: Props) {
  const navigate = useNavigate();
  return <>
    <div className="building-desktop-list"><table className="data-table building-table">
      <thead><tr><th scope="col">Tòa nhà</th><th scope="col">Địa chỉ</th><th scope="col">Địa bàn</th><th scope="col">Thao tác</th></tr></thead>
      <tbody>{props.buildings.map((building) => <tr key={building.buildingId} tabIndex={0} onClick={() => navigate(roomPath(building.buildingId))} onKeyDown={(event) => { if (event.currentTarget === event.target && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); navigate(roomPath(building.buildingId)); } }}>
        <td><div className="building-identity"><BuildingThumbnail src={building.buildingUrlImage} name={building.name}/><div><Link className="property-link" to={roomPath(building.buildingId)} onClick={(event) => event.stopPropagation()}>{building.name}</Link>{building.description && <span className="building-description">{building.description}</span>}</div></div></td>
        <td className="building-address">{building.address}</td>
        <td className="building-area">{area(building)}</td>
        <td><BuildingActions {...props} building={building}/></td>
      </tr>)}</tbody>
    </table></div>
    <div className="building-mobile-list">{props.buildings.map((building) => <article className="building-mobile-card" key={building.buildingId}>
      <div className="building-mobile-main"><BuildingThumbnail src={building.buildingUrlImage} name={building.name}/><div><Link className="property-link" to={roomPath(building.buildingId)}>{building.name}</Link><p>{building.address}</p></div></div>
      <div className="building-mobile-area"><Icon name="pin" size={15}/>{area(building)}</div>
      <BuildingActions {...props} building={building}/>
    </article>)}</div>
  </>;
}
