import { useEffect, useSyncExternalStore } from "react";
import { apiFetch } from "@/shared/api/httpClient";
import type { Id } from "@/shared/lib/id";

/**
 * Tra cứu nhãn hiển thị cho các DTO liên service chỉ mang ID (roomId/buildingId/customerId).
 * Bộ đệm ở phạm vi module để mỗi ID chỉ gọi API một lần; lỗi/403 được ghi nhớ là "không có nhãn"
 * và UI tự lùi về "#id".
 */
export type RoomRef = { id: string; code: string; buildingId: string; maxCapacity: number };

type RoomRow = { id: Id; roomCode: string; buildingId: Id; maxCapacity: number };
type UserRow = { id: Id; fullName?: string | null };

const roomCache = new Map<string, RoomRef | null>();
const buildingCache = new Map<string, string | null>();
const customerCache = new Map<string, string | null>();
const staffCache = new Map<string, string | null>();
const inflight = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version += 1;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot() {
  return version;
}

function run(key: string, task: () => Promise<void>) {
  if (inflight.has(key)) return;
  inflight.add(key);
  void task()
    .catch(() => undefined)
    .finally(() => {
      inflight.delete(key);
      emit();
    });
}

function ensureRoom(id: string) {
  if (roomCache.has(id)) return;
  run(`room:${id}`, async () => {
    try {
      const room = await apiFetch<RoomRow>(`/api/v1/rooms/${encodeURIComponent(id)}`);
      roomCache.set(id, {
        id: String(room.id),
        code: room.roomCode,
        buildingId: String(room.buildingId),
        maxCapacity: room.maxCapacity,
      });
    } catch {
      roomCache.set(id, null);
    }
  });
}

function ensureBuilding(id: string) {
  if (buildingCache.has(id)) return;
  run(`building:${id}`, async () => {
    try {
      const building = await apiFetch<{ name?: string | null }>(
        `/api/v1/buildings/${encodeURIComponent(id)}`,
      );
      buildingCache.set(id, building?.name ?? null);
    } catch {
      buildingCache.set(id, null);
    }
  });
}

function ensureCustomer(id: string) {
  if (customerCache.has(id)) return;
  run(`customer:${id}`, async () => {
    try {
      const user = await apiFetch<UserRow>(`/api/v1/users/${encodeURIComponent(id)}`);
      customerCache.set(id, user.fullName ?? null);
    } catch {
      customerCache.set(id, null);
    }
  });
}

let staffRequested = false;

function ensureStaff() {
  if (staffRequested) return;
  staffRequested = true;
  run("staff:all", async () => {
    try {
      const page = await apiFetch<{ content?: UserRow[] }>("/api/v1/staff?page=0&size=100");
      for (const staff of page.content ?? []) staffCache.set(String(staff.id), staff.fullName ?? null);
    } catch {
      // Không đủ quyền (CUSTOMER/KY_THUAT) — giữ "#id".
    }
  });
}

const NOOP = () => undefined;

function useResolve(
  ids: readonly (Id | null | undefined)[],
  ensure: (id: string) => void,
  loadAll?: () => void,
) {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  const key = Array.from(
    new Set(ids.filter((id): id is Id => id != null).map((id) => String(id))),
  ).join(",");
  useEffect(() => {
    loadAll?.();
    if (!key) return;
    for (const id of key.split(",")) ensure(id);
  }, [key, ensure, loadAll]);
}

export function useRoomLookup(ids: readonly (Id | null | undefined)[]) {
  useResolve(ids, ensureRoom);
  return (id: Id | null | undefined): RoomRef | undefined =>
    id == null ? undefined : roomCache.get(String(id)) ?? undefined;
}

export function useBuildingLookup(ids: readonly (Id | null | undefined)[]) {
  useResolve(ids, ensureBuilding);
  return (id: Id | null | undefined): string | undefined =>
    id == null ? undefined : buildingCache.get(String(id)) ?? undefined;
}

export function useCustomerLookup(ids: readonly (Id | null | undefined)[]) {
  useResolve(ids, ensureCustomer);
  return (id: Id | null | undefined): string | undefined =>
    id == null ? undefined : customerCache.get(String(id)) ?? undefined;
}

export function useStaffLookup(ids: readonly (Id | null | undefined)[]) {
  useResolve(ids, NOOP, ensureStaff);
  return (id: Id | null | undefined): string | undefined =>
    id == null ? undefined : staffCache.get(String(id)) ?? undefined;
}
