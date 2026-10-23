import assert from "node:assert/strict";
import test from "node:test";
import { fetchPagedHistory, type PageResult } from "./pagedHistory.ts";

const page = (content: number[], pageNumber: number, total = 3): PageResult<number> => ({
  content,
  page: pageNumber,
  size: 1,
  totalElements: total,
  totalPages: total,
});

test("tải đủ các trang lịch sử theo totalPages", async () => {
  const calls: number[] = [];
  const history = await fetchPagedHistory(async (pageNumber) => {
    calls.push(pageNumber);
    return page([pageNumber + 1], pageNumber);
  });

  assert.deepEqual(calls, [0, 1, 2]);
  assert.deepEqual(history.items, [1, 2, 3]);
  assert.equal(history.totalElements, 3);
  assert.equal(history.complete, true);
});

test("giữ dữ liệu đã tải khi một trang sau lỗi", async () => {
  const history = await fetchPagedHistory(async (pageNumber) => {
    if (pageNumber === 1) throw new Error("request failed");
    return page([1], pageNumber);
  });

  assert.deepEqual(history.items, [1]);
  assert.equal(history.complete, false);
  assert.equal(history.incompleteReason, "page-error");
});

test("báo thiếu dữ liệu khi chạm giới hạn trang", async () => {
  const history = await fetchPagedHistory(async (pageNumber) => page([pageNumber + 1], pageNumber), { maxPages: 2 });

  assert.deepEqual(history.items, [1, 2]);
  assert.equal(history.complete, false);
  assert.equal(history.incompleteReason, "page-limit");
});

test("retry độc lập: endpoint lỗi không chặn endpoint còn lại", async () => {
  let attempts = 0;
  const [reports, requests] = await Promise.allSettled([
    fetchPagedHistory(async () => page([1], 0, 1)),
    fetchPagedHistory(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("requests unavailable");
      return page([2], 0, 1);
    }),
  ]);

  assert.equal(reports.status, "fulfilled");
  assert.equal(requests.status, "rejected");
  const retried = await fetchPagedHistory(async () => page([2], 0, 1));
  assert.deepEqual(retried.items, [2]);
});
