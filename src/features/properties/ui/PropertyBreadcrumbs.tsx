import {Link} from "react-router";

export default function PropertyBreadcrumbs({building, room}: {
    building?: { buildingId: string; name: string } | null;
    room?: { roomCode: string } | null
}) {
    const items = [
        {label: "Quản lý tài sản", to: "/admin/buildings"},
        {label: "Tòa nhà", to: building ? "/admin/buildings" : undefined},
        ...(building ? [{
            label: building.name,
            to: room ? `/admin/buildings/${building.buildingId}/rooms` : undefined
        }] : []),
        ...(room ? [{label: `Phòng ${room.roomCode}`, to: undefined}] : []),
    ];
    return <nav aria-label="Đường dẫn" className="property-breadcrumbs">{items.map((item, index) => <span
        key={index}>{index > 0 && <span aria-hidden="true"> / </span>}{item.to ?
        <Link to={item.to}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}</span>)}</nav>;
}
