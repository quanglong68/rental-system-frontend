import {Link} from "react-router";
import {hasAnyRole, useAuth} from "@/features/auth";

export default function PropertyBreadcrumbs({building, room, action}: {
    building?: { buildingId: string; name: string } | null;
    room?: { roomCode: string } | null;
    action?: string;
}) {
    const {user} = useAuth();
    const isAdmin = hasAnyRole(user, ["ADMIN"]);
    const items = [
        isAdmin
            ? {label: "Quản lý tài sản", to: "/admin/buildings"}
            : {label: "Phòng", to: "/admin/rooms"},
        ...(building ? [{
            label: building.name,
            to: room ? `/admin/buildings/${building.buildingId}/rooms` : undefined
        }] : []),
        ...(action ? [{label: action, to: undefined}] : []),
        ...(room ? [{label: `Phòng ${room.roomCode}`, to: undefined}] : []),
    ];
    return <nav aria-label="Đường dẫn" className="property-breadcrumbs">{items.map((item, index) => <span
        key={index}>{index > 0 && <span aria-hidden="true"> / </span>}{item.to ?
        <Link to={item.to}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}</span>)}</nav>;
}
