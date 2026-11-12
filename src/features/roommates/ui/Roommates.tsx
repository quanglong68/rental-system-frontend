import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { sameId, type Id } from "@/shared/lib/id";
import { Icon, vnd } from "@/shared/ui";
import {
  bookingApi,
  type RoommatePost,
  type RoommateApplication,
} from "@/api/booking";
import { listingApi, type ListingItem } from "@/api/listing";
import { propertyApi, type Room, type RoomImage } from "@/features/properties/api/propertyApi";
import { contractsApi, type Contract, type ContractDetail } from "@/features/contracts/api/contractsApi";
import { useCxToast } from "@/features/notifications";
import { useAuth } from "@/features/auth";
import { ApiError } from "@/shared/api/httpClient";
import { errorText } from "@/shared/api/errors";
import { useBuildingLookup, useCustomerLookup, useRoomLookup } from "@/shared/lib/refLabels";
import { editBudgetInput, emptyBudgetInput } from "./budgetInput";
import ChatStartButton from "@/features/chat/ui/ChatStartButton";
import RoommateApplicationModal from "./RoommateApplicationModal";

const errText = (e: unknown) => errorText(e);

const newestFirst = <T,>(items: T[], getTime: (item: T) => string | null | undefined) =>
  [...items].sort((a, b) => {
    const ta = Date.parse(getTime(a) ?? "") || 0;
    const tb = Date.parse(getTime(b) ?? "") || 0;
    return tb - ta;
  });

/** Tính ngày đầu tiên của tháng tiếp theo (YYYY-MM-DD) */
function getFirstDayOfNextMonth(): string {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const y = nextMonth.getFullYear();
  const m = String(nextMonth.getMonth() + 1).padStart(2, "0");
  const d = String(nextMonth.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

export default function Roommates() {
  const [tab, setTab] = useState<"explore" | "my-posts" | "my-apps">("explore");
  const [posts, setPosts] = useState<RoommatePost[]>([]);
  const [myPosts, setMyPosts] = useState<RoommatePost[]>([]);
  const [myApps, setMyApps] = useState<RoommateApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [toastNode, showToast] = useCxToast();
  const { user } = useAuth();

  // Create Post Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [myContracts, setMyContracts] = useState<Contract[]>([]);
  const [contractDetails, setContractDetails] = useState<Record<string, ContractDetail>>({});
  const [newRoomId, setNewRoomId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [budgetInput, setBudgetInput] = useState(emptyBudgetInput);
  const budgetInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);

  useLayoutEffect(() => {
    const input = budgetInputRef.current;
    if (input && document.activeElement === input) {
      input.setSelectionRange(budgetInput.selectionStart, budgetInput.selectionEnd);
    }
  }, [budgetInput]);

  // Apply Modal State (Đầy đủ hồ sơ định danh như lúc thuê phòng)
  const [applyPost, setApplyPost] = useState<RoommatePost | null>(null);
  const [applyName, setApplyName] = useState("");
  const [applyPhone, setApplyPhone] = useState("");
  const [applyDob, setApplyDob] = useState("");
  const [applyGender, setApplyGender] = useState("Nam");
  const [applyCccd, setApplyCccd] = useState("");
  const [applyCccdDate, setApplyCccdDate] = useState("");
  const [applyCccdPlace, setApplyCccdPlace] = useState("");
  const [applyAddress, setApplyAddress] = useState("");
  const [applyOccupation, setApplyOccupation] = useState("");
  const [applyMoveInDate, setApplyMoveInDate] = useState(getFirstDayOfNextMonth());
  const [applyMessage, setApplyMessage] = useState("");
  const [frontCccdFile, setFrontCccdFile] = useState<File | null>(null);
  const [backCccdFile, setBackCccdFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);

  // Full Room Detail Modal
  const [detailPost, setDetailPost] = useState<RoommatePost | null>(null);
  const [detailListing, setDetailListing] = useState<ListingItem | null>(null);
  const [detailRoom, setDetailRoom] = useState<Room | null>(null);
  const [detailImages, setDetailImages] = useState<RoomImage[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  // Post Applications drawer/view
  const [selectedPostId, setSelectedPostId] = useState<Id | null>(null);
  const [postApps, setPostApps] = useState<RoommateApplication[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [appsError, setAppsError] = useState("");
  const [busyAppId, setBusyAppId] = useState<Id | null>(null);

  // View single application dossier modal
  const [viewingApp, setViewingApp] = useState<RoommateApplication | null>(null);

  const roomOf = useRoomLookup([
    ...posts.map((p) => p.roomId),
    ...myPosts.map((p) => p.roomId),
    ...myContracts.map((c) => c.roomId),
  ]);
  const buildingOf = useBuildingLookup([
    ...posts.map((p) => p.buildingId),
    ...myPosts.map((p) => p.buildingId),
    ...myContracts.map((c) => c.buildingId),
  ]);
  const customerOf = useCustomerLookup(postApps.map((a) => a.customerId));
  const postTitleOf = (id: Id) =>
    [...posts, ...myPosts].find((p) => sameId(p.id, id))?.title;

  const minMoveInDate = useMemo(() => getFirstDayOfNextMonth(), []);

  const loadData = async () => {
    setLoading(true);
    setLoadError("");
    const [exploreRes, myPostsRes, myAppsRes, myContractsRes] = await Promise.allSettled([
      bookingApi.roommatePosts({ page: 0, size: 50 }),
      bookingApi.myRoommatePosts(),
      bookingApi.myRoommateApplications(),
      contractsApi.mine(),
    ]);

    const errors: string[] = [];
    if (exploreRes.status === "fulfilled") {
      setPosts(newestFirst(exploreRes.value?.content ?? [], (p) => p.createdAt));
    } else {
      errors.push(`Tin đăng ở ghép: ${errText(exploreRes.reason)}`);
    }
    if (myPostsRes.status === "fulfilled") {
      setMyPosts(newestFirst(myPostsRes.value ?? [], (p) => p.createdAt));
    } else {
      errors.push(`Bài đăng của tôi: ${errText(myPostsRes.reason)}`);
    }
    if (myAppsRes.status === "fulfilled") {
      setMyApps(newestFirst(myAppsRes.value ?? [], (a) => a.createdAt));
    } else {
      errors.push(`Đơn ứng tuyển của tôi: ${errText(myAppsRes.reason)}`);
    }
    if (myContractsRes.status === "fulfilled") {
      setMyContracts((myContractsRes.value ?? []).filter((c) => c.status === "ACTIVE"));
    }
    setLoadError(errors.join(" · "));
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const selectTab = (next: typeof tab) => {
    setTab(next);
    setSelectedPostId(null);
    setPostApps([]);
    setAppsError("");
  };

  // Open Room Full Detail Modal
  const handleViewRoomDetail = async (post: RoommatePost) => {
    setDetailPost(post);
    setDetailListing(null);
    setDetailRoom(null);
    setDetailImages([]);
    setActiveImageIdx(0);
    setDetailLoading(true);

    try {
      const [listingRes, roomRes, imagesRes] = await Promise.allSettled([
        listingApi.getByRoom(post.roomId),
        propertyApi.room(String(post.roomId)),
        propertyApi.roomImages(String(post.roomId)),
      ]);

      if (listingRes.status === "fulfilled") {
        setDetailListing(listingRes.value);
      }
      if (roomRes.status === "fulfilled") {
        setDetailRoom(roomRes.value);
      }
      if (imagesRes.status === "fulfilled") {
        setDetailImages(imagesRes.value || []);
      }
    } catch {
      // Ignored
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenCreateModal = async () => {
    try {
      const list = await contractsApi.mine();
      const activeContracts = (list || []).filter((c) => c.status === "ACTIVE");
      if (activeContracts.length === 0) {
        showToast("Bạn cần có hợp đồng thuê phòng đang có hiệu lực trên hệ thống mới có thể đăng tin tìm bạn ở ghép.");
        return;
      }

      // Fetch detail để biết số lượng người đang ở trong từng hợp đồng
      const detailsMap: Record<string, ContractDetail> = {};
      await Promise.all(
        activeContracts.map(async (c) => {
          try {
            const d = await contractsApi.detail(c.id);
            detailsMap[String(c.roomId)] = d;
          } catch {
            // Ignored
          }
        }),
      );
      setContractDetails(detailsMap);
      setMyContracts(activeContracts);

      // Chỉ cho đăng tin khi tải được sức chứa thật và phòng còn chỗ.
      const eligibleContracts = activeContracts.filter((c) => {
        const d = detailsMap[String(c.roomId)];
        const capacity = roomOf(c.roomId)?.maxCapacity;
        if (!d || capacity == null) return false;
        const currentCount = d.tenants.filter((t) => !t.leftAt).length;
        return currentCount < capacity;
      });
      if (eligibleContracts.length === 0) {
        showToast("Không tìm thấy phòng còn chỗ hoặc chưa tải được sức chứa phòng. Vui lòng tải lại dữ liệu hoặc liên hệ quản lý.");
        return;
      }
      const availableContract = eligibleContracts[0];

      setNewRoomId(String(availableContract.roomId));
      setNewTitle("");
      setNewDesc("");
      setBudgetInput(emptyBudgetInput());
      setShowCreateModal(true);
    } catch (err) {
      showToast(
        err instanceof ApiError && (err.status === 401 || err.status === 403)
          ? "Vui lòng đăng nhập với tài khoản người thuê phòng để đăng tin tìm bạn ở ghép."
          : errText(err),
      );
    }
  };

  const handleBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    setBudgetInput(editBudgetInput(budgetInput, {
      value: input.value,
      selectionStart: input.selectionStart ?? input.value.length,
      selectionEnd: input.selectionEnd ?? input.value.length,
      inputType: (e.nativeEvent as InputEvent).inputType,
    }));
  };

  const handleCreatePost = async () => {
    if (!newRoomId || !newTitle.trim()) {
      showToast("Vui lòng chọn phòng và điền tiêu đề bài đăng");
      return;
    }
    if (!budgetInput.raw || budgetInput.raw === "0") {
      showToast("Vui lòng nhập chi phí chia sẻ dự kiến hợp lệ");
      return;
    }

    const d = contractDetails[newRoomId];
    const selectedContract = myContracts.find((contract) => String(contract.roomId) === newRoomId);
    const capacity = selectedContract ? roomOf(selectedContract.roomId)?.maxCapacity : undefined;
    if (!d || capacity == null) {
      showToast("Chưa xác minh được sức chứa phòng. Vui lòng tải lại trang rồi thử lại.");
      return;
    }
    const activeTenants = d.tenants.filter((t) => !t.leftAt).length;
    if (activeTenants >= capacity) {
      showToast(`Phòng đã đủ ${activeTenants}/${capacity} người, không thể đăng tin tuyển thêm.`);
      return;
    }

    setSubmitting(true);
    try {
      await bookingApi.createRoommatePost({
        roomId: newRoomId.trim(),
        title: newTitle.trim(),
        description: newDesc.trim(),
        budgetShare: Number(budgetInput.raw),
      });
      showToast("Đã tạo bài đăng tìm bạn ở ghép thành công!");
      setShowCreateModal(false);
      setNewRoomId("");
      setNewTitle("");
      setNewDesc("");
      setBudgetInput(emptyBudgetInput());
      await loadData();
    } catch (err) {
      showToast(`Không thể tạo bài đăng: ${errText(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenApplyModal = (post: RoommatePost) => {
    if (post.status === "CLOSED") {
      showToast("Bài đăng này đã đóng hoặc phòng đã đủ người ở.");
      return;
    }
    const isCurrentTenantOfRoom = myContracts.some((c) => c.status === "ACTIVE" && sameId(c.roomId, post.roomId));
    if (isCurrentTenantOfRoom) {
      showToast("Bạn đang là người thuê phòng này rồi.");
      return;
    }
    const existing = myApps.find((a) => {
      if (sameId(a.roommatePostId, post.id)) return true;
      const targetPost = [...posts, ...myPosts].find((p2) => sameId(p2.id, a.roommatePostId));
      return targetPost && sameId(targetPost.roomId, post.roomId);
    });
    if (existing) {
      if (existing.status === "ACCEPTED" || existing.status === "ACCEPTED_PENDING") {
        showToast("Bạn đã được duyệt tham gia phòng này rồi.");
      } else if (existing.status === "REJECTED" || existing.status === "REJECTED_FULL") {
        showToast("Đơn ứng tuyển vào phòng này của bạn đã bị từ chối.");
      } else {
        showToast("Bạn đã gửi đơn ứng tuyển cho phòng này rồi, vui lòng chờ chủ phòng xét duyệt.");
      }
      return;
    }
    setApplyPost(post);
    setApplyName(user?.fullName ?? "");
    setApplyPhone("");
    setApplyDob("");
    setApplyGender("Nam");
    setApplyCccd("");
    setApplyCccdDate("");
    setApplyCccdPlace("Cục Cảnh sát QLHC về TTXH");
    setApplyAddress("");
    setApplyOccupation("Người đi làm");
    setApplyMoveInDate(getFirstDayOfNextMonth());
    setApplyMessage("Chào bạn, mình muốn ứng tuyển ở ghép, sinh hoạt gọn gàng, giữ gìn vệ sinh chung.");
    setFrontCccdFile(null);
    setBackCccdFile(null);
    setFrontPreview(null);
    setBackPreview(null);
  };

  const handleFrontFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFrontCccdFile(file);
      setFrontPreview(URL.createObjectURL(file));
    }
  };

  const handleBackFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBackCccdFile(file);
      setBackPreview(URL.createObjectURL(file));
    }
  };

  const handleApply = async () => {
    if (!applyPost) return;
    if (!applyName.trim()) {
      showToast("Vui lòng nhập họ và tên của bạn");
      return;
    }
    if (!/^0\d{9,10}$/.test(applyPhone.trim())) {
      showToast("Số điện thoại không hợp lệ (bắt đầu bằng 0, gồm 10–11 chữ số)");
      return;
    }
    if (!/^(\d{9}|\d{12})$/.test(applyCccd.trim())) {
      showToast("Số CCCD không hợp lệ (9 hoặc 12 chữ số)");
      return;
    }
    if (!applyMoveInDate) {
      showToast("Vui lòng chọn ngày dự kiến chuyển vào");
      return;
    }
    if (applyMoveInDate < minMoveInDate) {
      showToast(`Theo quy định, ngày dọn vào ở ghép phải từ ngày đầu tháng sau (${fmtDate(minMoveInDate)}) để phân bổ tiền phòng và điện nước rõ ràng.`);
      return;
    }
    if (!applyMessage.trim()) {
      showToast("Vui lòng nhập lời nhắn ứng tuyển");
      return;
    }
    if (!frontCccdFile || !backCccdFile) {
      showToast("Vui lòng chọn ảnh CCCD 2 mặt (mặt trước và mặt sau) để xác thực danh tính");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Upload ảnh CCCD trước
      showToast("Đang tải ảnh CCCD lên…");
      const [frontUpload, backUpload] = await Promise.all([
        bookingApi.uploadIdentityFile(frontCccdFile, "FRONT"),
        bookingApi.uploadIdentityFile(backCccdFile, "BACK"),
      ]);

      // 2. Gửi đơn ứng tuyển với đầy đủ hồ sơ định danh
      await bookingApi.applyRoommatePost(applyPost.id, {
        fullName: applyName.trim(),
        phone: applyPhone.trim(),
        cccdNumber: applyCccd.trim(),
        message: applyMessage.trim(),
        dateOfBirth: applyDob || null,
        gender: applyGender || null,
        cccdIssueDate: applyCccdDate || null,
        cccdIssuePlace: applyCccdPlace.trim() || null,
        permanentAddress: applyAddress.trim() || null,
        occupation: applyOccupation.trim() || null,
        moveInDate: applyMoveInDate || null,
        cccdFrontKey: frontUpload.objectKey,
        cccdBackKey: backUpload.objectKey,
      });

      showToast("Đã gửi đơn ứng tuyển ở ghép thành công kèm hồ sơ định danh!");
      setApplyPost(null);
      await loadData();
    } catch (err) {
      showToast(`Không thể gửi đơn ứng tuyển: ${errText(err)}`);
    } finally {
      setSubmitting(false);
    }
  };


  const handleViewApplications = async (postId: Id) => {
    setSelectedPostId(postId);
    setPostApps([]);
    setAppsError("");
    setAppsLoading(true);
    try {
      const res = await bookingApi.postRoommateApplications(postId);
      const list = newestFirst(res?.content ?? [], (a) => a.createdAt);
      setPostApps(list);
      const unread = list.filter((a) => !a.readAt);
      if (unread.length > 0) {
        void Promise.allSettled(unread.map((a) => bookingApi.markRoommateApplicationRead(a.id))).then(() => {
          const now = new Date().toISOString();
          setPostApps((prev) => prev.map((a) => (a.readAt ? a : { ...a, readAt: now })));
        });
      }
    } catch (err) {
      setAppsError(errText(err));
    } finally {
      setAppsLoading(false);
    }
  };

  const mapRejectionReason = (status: string): string => {
    if (status === "REJECTED_FULL") {
      return "Không thể thêm người này: phòng đã đủ sức chứa hoặc ứng viên đang có hợp đồng thuê còn hiệu lực.";
    }
    if (status === "REJECTED") return "Đơn ứng tuyển đã bị từ chối.";
    return "";
  };

  const handleAcceptApp = async (appId: Id) => {
    const postId = selectedPostId ?? viewingApp?.roommatePostId;
    if (!postId || busyAppId != null) return;
    setBusyAppId(appId);
    try {
      await bookingApi.acceptRoommateApplication(appId);
      showToast("Đã nhận yêu cầu duyệt. Đang kiểm tra kết quả thêm vào hợp đồng…");

      let finalStatus: string | undefined;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
        const res = await bookingApi.postRoommateApplications(postId);
        const updatedApp = (res?.content ?? []).find((item) => sameId(item.id, appId));
        finalStatus = updatedApp?.status;
        if (finalStatus === "ACCEPTED" || finalStatus === "REJECTED_FULL" || finalStatus === "REJECTED") break;
      }

      if (finalStatus === "ACCEPTED") {
        showToast("Đã thêm thành viên vào hợp đồng thành công.");
      } else if (finalStatus === "REJECTED_FULL" || finalStatus === "REJECTED") {
        showToast(`Không thể hoàn tất duyệt: ${mapRejectionReason(finalStatus)}`);
      } else {
        showToast("Yêu cầu vẫn đang được xử lý. Vui lòng mở lại danh sách đơn sau ít phút để kiểm tra trạng thái.");
      }
      await handleViewApplications(postId);
      await loadData();
    } catch (err) {
      showToast(`Không thể duyệt đơn: ${errText(err)}`);
      await handleViewApplications(postId);
    } finally {
      setBusyAppId(null);
    }
  };

  const handleRejectApp = async (appId: Id) => {
    const postId = selectedPostId ?? viewingApp?.roommatePostId;
    setBusyAppId(appId);
    try {
      await bookingApi.rejectRoommateApplication(appId);
      showToast("Đã từ chối đơn ứng tuyển.");
      if (postId) await handleViewApplications(postId);
      await loadData();
    } catch (err) {
      showToast(`Lỗi khi từ chối đơn: ${errText(err)}`);
    } finally {
      setBusyAppId(null);
    }
  };

  const handleClosePost = async (id: Id) => {
    try {
      await bookingApi.closeRoommatePost(id);
      showToast("Đã đóng bài đăng tìm bạn ở ghép");
      if (selectedPostId && sameId(selectedPostId, id)) {
        setSelectedPostId(null);
        setPostApps([]);
      }
      await loadData();
    } catch (err) {
      showToast(`Không thể đóng bài đăng: ${errText(err)}`);
    }
  };

  const renderBadge = (status: string) => {
    switch (status) {
      case "OPEN":
        return <span className="cx-badge success">Đang tìm</span>;
      case "ACCEPTED":
        return <span className="cx-badge success">Đã chấp nhận</span>;
      case "ACCEPTED_PENDING":
        return <span className="cx-badge info">Đang xử lý...</span>;
      case "PENDING":
        return <span className="cx-badge warning">Chờ duyệt</span>;
      case "REJECTED":
        return <span className="cx-badge danger">Đã từ chối</span>;
      case "REJECTED_FULL":
        return <span className="cx-badge danger">Không thể thêm (Xem chi tiết)</span>;
      case "CLOSED":
        return <span className="cx-badge muted">Đã đóng</span>;
      default:
        return <span className="cx-badge">{status}</span>;
    }
  };

  return (
    <>
      {toastNode}
      <section className="cx-section !pt-32">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="cx-eyebrow">Cộng đồng cư dân · Tìm bạn cùng phòng</div>
            <h1 className="cx-serif cx-h2">
              Tìm người <em>hợp lối sống</em>, chia sẻ chi phí minh bạch.
            </h1>
            <p className="mt-2 text-sm text-muted max-w-xl">
              Xem đầy đủ thông tin phòng, tiện ích và công thức chia đều tiền thuê, điện nước tự động của tòa nhà.
            </p>
          </div>
          <button
            className="cx-btn self-start md:self-auto shadow-md"
            onClick={handleOpenCreateModal}
          >
            + Đăng tin tìm người ở ghép
          </button>
        </div>

        <div className="mt-8 flex gap-3 border-b border-line pb-4">
          <button
            className={`cx-chip ${tab === "explore" ? "on" : ""}`}
            onClick={() => selectTab("explore")}
          >
            Tin đăng ở ghép ({posts.length})
          </button>
          <button
            className={`cx-chip ${tab === "my-posts" ? "on" : ""}`}
            onClick={() => selectTab("my-posts")}
          >
            Bài đăng của tôi ({myPosts.length})
          </button>
          <button
            className={`cx-chip ${tab === "my-apps" ? "on" : ""}`}
            onClick={() => selectTab("my-apps")}
          >
            Đơn ứng tuyển của tôi ({myApps.length})
          </button>
        </div>

        {loadError && (
          <div className="mt-6 flex flex-col justify-between gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm md:flex-row md:items-center">
            <span className="text-danger">{loadError}</span>
            <button className="cx-btn ghost !py-2 text-xs self-start md:self-auto" onClick={() => void loadData()}>
              Thử lại
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-muted">Đang tải danh sách ở ghép…</div>
        ) : tab === "explore" ? (
          posts.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-line bg-white p-12 text-center">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-surface text-muted">
                <Icon name="users" size={28} />
              </div>
              <h2 className="text-xl font-bold">Chưa có bài đăng tìm người ở ghép nào</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
                Hãy quay lại sau hoặc là người đầu tiên tạo tin tìm bạn cùng phòng!
              </p>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((p) => {
                const room = roomOf(p.roomId);
                const building = buildingOf(p.buildingId);
                const isClosed = p.status === "CLOSED";
                const isMyPost = user && sameId(p.customerId, user.id);

                return (
                  <div
                    key={p.id}
                    className="flex flex-col justify-between rounded-2xl border border-line bg-white p-6 shadow-sm transition hover:shadow-md hover:border-teal/50"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-teal bg-teal/10 px-2 py-0.5 rounded">
                          Phòng {room?.code ?? `#${p.roomId}`} {building ? `· ${building}` : ""}
                        </span>
                        {renderBadge(p.status)}
                      </div>
                      <h3 className="mt-3 text-lg font-bold text-text leading-snug">{p.title}</h3>
                      {p.description && (
                        <p className="mt-2 text-sm leading-6 text-muted line-clamp-3">
                          {p.description}
                        </p>
                      )}

                      {/* Thông tin nhanh về chi phí chia sẻ */}
                      <div className="mt-4 rounded-xl bg-surface p-3 text-xs space-y-1.5 border border-line/50">
                        <div className="flex justify-between">
                          <span className="text-muted">Chi phí chia sẻ dự kiến:</span>
                          <span className="font-bold text-accent">{vnd(p.budgetShare)} / người</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-muted">
                          <span>Kỳ tính phí áp dụng:</span>
                          <span className="font-semibold text-text">Từ tháng sau (01/{new Date().getMonth() + 2 > 12 ? "01" : String(new Date().getMonth() + 2).padStart(2, "0")})</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 border-t border-line pt-4 flex items-center justify-between gap-2">
                      <button
                        className="cx-btn ghost !py-2 text-xs flex items-center gap-1.5"
                        onClick={() => void handleViewRoomDetail(p)}
                      >
                        <Icon name="search" size={14} /> Xem chi tiết phòng
                      </button>

                      <div className="flex flex-wrap items-center justify-end gap-2">
                      {!isMyPost && (
                        <ChatStartButton
                          contextType="ROOMMATE_POST"
                          contextId={p.id}
                          label="Nhắn chủ phòng"
                          title="Nhắn trực tiếp cho người đăng tin ở ghép"
                          className="cx-btn ghost !py-2 text-xs"
                        />
                      )}

                      {isMyPost ? (
                        <span className="rounded-lg bg-surface px-3 py-1.5 text-xs font-semibold text-muted border border-line">
                          Bài đăng của bạn
                        </span>
                      ) : isClosed ? (
                        <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-muted">
                          Phòng đã đủ người
                        </span>
                      ) : (() => {
                        const isCurrentTenantOfRoom = myContracts.some((c) => c.status === "ACTIVE" && sameId(c.roomId, p.roomId));
                        if (isCurrentTenantOfRoom) {
                          return (
                            <span className="rounded-lg bg-surface px-3 py-1.5 text-xs font-semibold text-muted border border-line">
                              Bạn đang ở phòng này
                            </span>
                          );
                        }
                        const existing = myApps.find((a) => {
                          if (sameId(a.roommatePostId, p.id)) return true;
                          const targetPost = [...posts, ...myPosts].find((p2) => sameId(p2.id, a.roommatePostId));
                          return targetPost && sameId(targetPost.roomId, p.roomId);
                        });
                        if (existing) {
                          if (existing.status === "ACCEPTED" || existing.status === "ACCEPTED_PENDING") {
                            return (
                              <span className="rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 border bg-emerald-50 text-emerald-800 border-emerald-200">
                                <Icon name="check" size={13} />
                                Đã được duyệt
                              </span>
                            );
                          }
                          if (existing.status === "REJECTED" || existing.status === "REJECTED_FULL") {
                            return (
                              <span className="rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 border bg-rose-50 text-rose-800 border-rose-200">
                                Đã bị từ chối
                              </span>
                            );
                          }
                          return (
                            <span className="rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 border bg-amber-50 text-amber-800 border-amber-200">
                              <Icon name="clock" size={13} />
                              Đã gửi đơn (Chờ duyệt)
                            </span>
                          );
                        }
                        return (
                          <button
                            className="cx-btn !py-2 text-xs"
                            onClick={() => handleOpenApplyModal(p)}
                          >
                            Ứng tuyển
                          </button>
                        );
                      })()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : tab === "my-posts" ? (
          myPosts.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-line bg-white p-12 text-center">
              <h2 className="text-xl font-bold">Bạn chưa đăng bài tìm người ở ghép nào</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
                Nếu bạn đang thuê phòng và muốn san sẻ chi phí, hãy bấm nút Đăng tin ở trên.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              {myPosts.map((p) => {
                const room = roomOf(p.roomId);
                const building = buildingOf(p.buildingId);

                return (
                  <div key={p.id} className="rounded-xl border border-line bg-white p-6 shadow-sm">
                    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-bold text-text">{p.title}</h3>
                          {renderBadge(p.status)}
                        </div>
                        <p className="mt-1 text-sm text-muted">
                          Phòng {room?.code ?? `#${p.roomId}`}
                          {building ? ` · ${building}` : ""} · Chi phí chia sẻ:{" "}
                          <b className="text-accent">{vnd(p.budgetShare)}/người</b>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="cx-btn ghost !py-2 text-xs"
                          onClick={() => {
                            if (selectedPostId !== null && sameId(selectedPostId, p.id)) {
                              setSelectedPostId(null);
                              setPostApps([]);
                              setAppsError("");
                            } else {
                              void handleViewApplications(p.id);
                            }
                          }}
                        >
                          {selectedPostId !== null && sameId(selectedPostId, p.id) ? "Ẩn hồ sơ ứng tuyển" : "Xem hồ sơ ứng tuyển"}
                        </button>
                        {p.status === "OPEN" && (
                          <button
                            className="cx-btn ghost !py-2 text-xs text-danger hover:bg-danger/10"
                            onClick={() => void handleClosePost(p.id)}
                          >
                            Đóng tin
                          </button>
                        )}
                      </div>
                    </div>

                    {selectedPostId !== null && sameId(selectedPostId, p.id) && (
                      <div className="mt-6 border-t border-line pt-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm text-text">Hồ sơ ứng tuyển ({postApps.length})</h4>
                          <span className="text-xs text-muted">
                            Lưu ý: Chỉ duyệt được khi phòng còn chỗ trống theo sức chứa quy định.
                          </span>
                        </div>
                        {appsLoading ? (
                          <p className="mt-2 text-xs text-muted">Đang tải hồ sơ ứng tuyển…</p>
                        ) : appsError ? (
                          <div className="mt-2 flex items-center gap-3">
                            <p className="text-xs text-danger">{appsError}</p>
                            <button className="cx-btn ghost !py-1 text-xs" onClick={() => void handleViewApplications(p.id)}>
                              Thử lại
                            </button>
                          </div>
                        ) : postApps.length === 0 ? (
                          <p className="mt-2 text-xs text-muted">Chưa có ai ứng tuyển bài đăng này.</p>
                        ) : (
                          <div className="mt-3 space-y-3">
                            {postApps.map((app) => (
                              <div
                                key={app.id}
                                className={`flex flex-col justify-between gap-3 rounded-xl border border-line p-4 md:flex-row md:items-center ${
                                  app.readAt ? "bg-surface" : "bg-sky-50/60"
                                }`}
                              >
                                <div className="space-y-1.5 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm text-text">
                                      {app.fullName || customerOf(app.customerId) || "Khách ứng tuyển"}
                                    </span>
                                    {renderBadge(app.status)}
                                    {!app.readAt && <span className="cx-badge info">Mới</span>}
                                  </div>
                                  <div className="text-xs text-text font-medium flex flex-wrap gap-x-3 gap-y-1">
                                    {app.phone && <span>SĐT: <b>{app.phone}</b></span>}
                                    {app.cccdNumber && <span>CCCD: <b>{app.cccdNumber}</b></span>}
                                  </div>
                                  <div className="text-[11px] text-muted">
                                    Nộp lúc: {new Date(app.createdAt).toLocaleString("vi-VN")}
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 shrink-0">
                                  <button
                                    className="cx-btn ghost !py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50"
                                    onClick={() => setViewingApp(app)}
                                  >
                                    Xem hồ sơ &amp; CCCD
                                  </button>
                                  <ChatStartButton
                                    contextType="ROOMMATE_APPLICATION"
                                    contextId={app.id}
                                    label="Nhắn tin"
                                    className="cx-btn ghost !py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50"
                                  />
                                  {app.status === "PENDING" && (
                                    <>
                                      <button
                                        className="cx-btn ghost !py-1.5 text-xs text-danger hover:bg-danger/10"
                                        disabled={busyAppId !== null}
                                        onClick={() => void handleRejectApp(app.id)}
                                      >
                                        Từ chối
                                      </button>
                                      <button
                                        className="cx-btn !py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700"
                                        disabled={busyAppId !== null}
                                        onClick={() => void handleAcceptApp(app.id)}
                                      >
                                        {busyAppId !== null && sameId(busyAppId, app.id) ? "Đang xử lý…" : "Duyệt vào phòng"}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : myApps.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-line bg-white p-12 text-center">
            <h2 className="text-xl font-bold">Bạn chưa gửi đơn ứng tuyển nào</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
              Khám phá danh sách các bài đăng ở ghép để tìm phòng phù hợp.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {myApps.map((app) => (
              <div
                key={app.id}
                className="flex flex-col justify-between gap-4 rounded-xl border border-line bg-white p-6 shadow-sm md:flex-row md:items-center"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-bold text-text">
                      Ứng tuyển bài đăng{" "}
                      {postTitleOf(app.roommatePostId) ? `"${postTitleOf(app.roommatePostId)}"` : `#${app.roommatePostId}`}
                    </h3>
                    {renderBadge(app.status)}
                  </div>
                  {app.message && (
                    <p className="mt-1 text-sm text-muted line-clamp-2">
                      Lời nhắn: &ldquo;{app.message}&rdquo;
                    </p>
                  )}
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
                    {app.phone && <span>SĐT: {app.phone}</span>}
                    {app.cccdNumber && <span>CCCD: {app.cccdNumber}</span>}
                    {app.moveInDate && <span>Dự kiến vào: {fmtDate(app.moveInDate)}</span>}
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    Thời gian gửi: {new Date(app.createdAt).toLocaleString("vi-VN")}
                  </p>
                  {(app.status === "REJECTED_FULL" || app.status === "REJECTED") && (
                    <p className="mt-1.5 rounded-lg bg-danger/5 border border-danger/20 px-3 py-1.5 text-xs text-danger">
                      {app.status === "REJECTED_FULL"
                        ? "Không thể thêm: phòng đã đủ sức chứa hoặc bạn đang có hợp đồng thuê phòng khác còn hiệu lực."
                        : "Đơn ứng tuyển đã bị chủ phòng từ chối."}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center">
                  <ChatStartButton
                    contextType="ROOMMATE_APPLICATION"
                    contextId={app.id}
                    label="Nhắn chủ phòng"
                    className="cx-btn ghost !py-2 text-xs font-semibold text-teal-700 hover:bg-teal-50"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* MODAL 1: Chi tiết toàn diện phòng & ở ghép (Như lúc khách xem phòng) */}
      <AnimatePresence>
        {detailPost && (
          <div
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto"
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 md:p-8 shadow-2xl"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
            >
              <button
                className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full bg-surface text-muted hover:text-text"
                onClick={() => setDetailPost(null)}
              >
                <Icon name="close" size={16} />
              </button>

              <div className="cx-eyebrow !text-teal">Thông tin phòng ở ghép</div>
              <h2 className="text-2xl font-bold text-text">
                {detailPost.title}
              </h2>
              <p className="text-xs text-muted mt-1">
                Phòng {roomOf(detailPost.roomId)?.code ?? `#${detailPost.roomId}`} · {buildingOf(detailPost.buildingId) ?? `Tòa #${detailPost.buildingId}`}
              </p>

              {detailLoading ? (
                <div className="py-16 text-center text-sm text-muted">Đang tải đầy đủ thông tin phòng…</div>
              ) : (
                <div className="mt-6 space-y-6">
                  {/* Gallery ảnh phòng */}
                  {detailImages.length > 0 && (
                    <div>
                      <div className="h-64 w-full overflow-hidden rounded-2xl bg-surface">
                        <img
                          src={detailImages[activeImageIdx]?.imageUrl}
                          alt="Ảnh phòng"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      {detailImages.length > 1 && (
                        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                          {detailImages.map((img, idx) => (
                            <button
                              key={img.imageId || idx}
                              className={`h-16 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                                activeImageIdx === idx ? "border-teal" : "border-transparent opacity-70"
                              }`}
                              onClick={() => setActiveImageIdx(idx)}
                            >
                              <img src={img.imageUrl} alt="thumbnail" className="h-full w-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Thông số phòng quan trọng */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl bg-surface p-3 border border-line">
                      <span className="text-xs text-muted block">Diện tích phòng</span>
                      <span className="text-base font-bold text-text">{detailRoom?.area || detailListing?.roomNumber ? `${detailRoom?.area || 30} m²` : "Tiêu chuẩn"}</span>
                    </div>
                    <div className="rounded-xl bg-surface p-3 border border-line">
                      <span className="text-xs text-muted block">Sức chứa tối đa</span>
                      <span className="text-base font-bold text-text">{detailListing?.maxCapacity || detailRoom?.maxCapacity || 2} người</span>
                    </div>
                    <div className="rounded-xl bg-surface p-3 border border-line">
                      <span className="text-xs text-muted block">Giá thuê gốc phòng</span>
                      <span className="text-base font-bold text-teal">{vnd(detailListing?.price || detailRoom?.basePrice || 0)}</span>
                    </div>
                    <div className="rounded-xl bg-surface p-3 border border-line">
                      <span className="text-xs text-muted block">Phần chia sẻ dự kiến</span>
                      <span className="text-base font-bold text-accent">{vnd(detailPost.budgetShare)}/người</span>
                    </div>
                  </div>

                  {/* Bảng minh bạch cơ chế chia sẻ chi phí */}
                  <div className="rounded-2xl border border-teal/30 bg-teal/5 p-4 text-xs space-y-2">
                    <h4 className="font-bold text-sm text-teal flex items-center gap-1.5">
                      <Icon name="check" size={16} /> Cơ chế chia sẻ chi phí minh bạch của tòa nhà
                    </h4>
                    <p className="text-muted leading-relaxed">
                      Toàn bộ các khoản phát sinh trong tháng của phòng gồm <b>tiền thuê phòng</b>, <b>tiền điện sinh hoạt theo công tơ</b>, <b>tiền nước</b> và <b>dịch vụ tòa nhà dùng chung</b> (Internet, vệ sinh) sẽ được hệ thống chia đều tự động cho tất cả các thành viên đang có hợp đồng hiệu lực tại phòng.
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-1 font-medium text-text">
                      <div>Điện: {detailListing?.electricityPrice ? `${vnd(detailListing.electricityPrice)} / kWh` : "3.500 đ / kWh"}</div>
                      <div>Nước: {detailListing?.waterPrice ? `${vnd(detailListing.waterPrice)} / ${detailListing.waterUnit === "PERSON" ? "người" : "m³"}` : "25.000 đ / m³"}</div>
                      <div>Tiền cọc phòng: {detailListing?.depositAmount ? vnd(detailListing.depositAmount) : "Theo hợp đồng"}</div>
                      <div>Kỳ hạn hợp đồng: {detailListing?.minTermMonths || 12} tháng</div>
                    </div>
                  </div>

                  {/* Mô tả từ người đăng */}
                  {detailPost.description && (
                    <div>
                      <h4 className="text-xs font-bold text-muted uppercase tracking-wider">Mô tả phòng & yêu cầu người ở ghép</h4>
                      <p className="mt-1.5 text-sm leading-relaxed text-text bg-surface p-3 rounded-xl border border-line">
                        {detailPost.description}
                      </p>
                    </div>
                  )}

                  {/* Thông tin tòa nhà & chủ nhà */}
                    {detailListing && (
                      <div className="rounded-xl border border-line p-3 text-xs space-y-1">
                        <div className="font-bold text-text">{detailListing.buildingName}</div>
                        <div className="text-muted">{detailListing.address}</div>
                        {detailListing.lessorName && (
                          <div className="pt-1 text-muted">
                            Chủ quản lý: <b>{detailListing.lessorName}</b> {detailListing.lessorPhone ? '· SĐT: ' + detailListing.lessorPhone : ''}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Nút hành động */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
                      <button className="cx-btn ghost" onClick={() => setDetailPost(null)}>
                        Đóng
                      </button>
                      {user && sameId(detailPost.customerId, user.id) ? (
                        <span className="rounded-xl bg-surface px-4 py-2 text-xs font-semibold text-muted border border-line">
                          Đây là bài đăng của bạn
                        </span>
                      ) : detailPost.status === 'CLOSED' ? (
                        <button className="cx-btn disabled opacity-50 cursor-not-allowed" disabled>
                          Phòng đã đủ người (Tin đã đóng)
                        </button>
                      ) : (() => {
                        const isCurrentTenantOfRoom = myContracts.some((c) => c.status === "ACTIVE" && sameId(c.roomId, detailPost.roomId));
                        if (isCurrentTenantOfRoom) {
                          return (
                            <span className="rounded-xl bg-surface px-4 py-2 text-xs font-semibold text-muted border border-line">
                              Bạn đang thuê phòng này
                            </span>
                          );
                        }
                        const existing = myApps.find((a) => {
                          if (sameId(a.roommatePostId, detailPost.id)) return true;
                          const targetPost = [...posts, ...myPosts].find((p2) => sameId(p2.id, a.roommatePostId));
                          return targetPost && sameId(targetPost.roomId, detailPost.roomId);
                        });
                        if (existing) {
                          if (existing.status === 'ACCEPTED' || existing.status === 'ACCEPTED_PENDING') {
                            return (
                              <span className="rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-1.5 border bg-emerald-50 text-emerald-800 border-emerald-200">
                                <Icon name="check" size={14} />
                                Đã được duyệt tham gia phòng
                              </span>
                            );
                          }
                          if (existing.status === 'REJECTED' || existing.status === 'REJECTED_FULL') {
                            return (
                              <span className="rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-1.5 border bg-rose-50 text-rose-800 border-rose-200">
                                Đơn ứng tuyển đã bị từ chối
                              </span>
                            );
                          }
                          return (
                            <span className="rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-1.5 border bg-amber-50 text-amber-800 border-amber-200">
                              <Icon name="clock" size={14} />
                              Bạn đã nộp đơn vào phòng này (Chờ duyệt)
                            </span>
                          );
                        }
                        return (
                          <button
                            className="cx-btn !px-6"
                            onClick={() => {
                              const p = detailPost;
                              setDetailPost(null);
                              handleOpenApplyModal(p);
                            }}
                          >
                            Ứng tuyển ở ghép ngay
                          </button>
                        );
                      })()}
                    </div>
                  </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: Đăng tin tìm bạn ở ghép */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-text">Đăng tin tìm bạn ở ghép</h2>
            <p className="mt-1 text-xs text-muted">
              Lưu ý: Chỉ áp dụng cho phòng còn chỗ trống theo sức chứa và có hợp đồng hiệu lực.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-text">Chọn phòng bạn đang thuê:</label>
                <select
                  value={newRoomId}
                  onChange={(e) => setNewRoomId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line bg-white p-2.5 text-sm font-medium"
                >
                  {myContracts.map((c) => {
                    const d = contractDetails[String(c.roomId)];
                    const activeTenants = d ? d.tenants.filter((t) => !t.leftAt).length : 1;
                    return (
                      <option key={c.id} value={c.roomId}>
                        Phòng {roomOf(c.roomId)?.code ?? `#${c.roomId}`} (
                        {buildingOf(c.buildingId) ?? `Tòa #${c.buildingId}`}) — Hiện có {activeTenants} người ở
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text">Tiêu đề bài đăng:</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ví dụ: Tìm bạn nữ ở ghép phòng ban công thoáng mát"
                  className="mt-1 w-full rounded-lg border border-line p-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text">Chi phí chia sẻ dự kiến / người / tháng:</label>
                <div className="relative mt-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    ref={budgetInputRef}
                    value={budgetInput.display}
                    onChange={handleBudgetChange}
                    placeholder="Ví dụ: 2.500.000"
                    className="w-full rounded-lg border border-line p-2.5 pr-14 text-sm font-semibold"
                  />
                  <span className="pointer-events-none absolute right-3 top-3 text-xs font-bold text-muted">
                    VNĐ
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text">Mô tả lối sống, yêu cầu:</label>
                <textarea
                  rows={3}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Giữ gìn vệ sinh chung, không hút thuốc, giờ giấc tự do, thân thiện..."
                  className="mt-1 w-full rounded-lg border border-line p-2.5 text-sm"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="cx-btn ghost"
                onClick={() => setShowCreateModal(false)}
              >
                Hủy
              </button>
              <button
                className="cx-btn"
                disabled={submitting}
                onClick={handleCreatePost}
              >
                {submitting ? "Đang đăng…" : "Đăng tin"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Gửi đơn ứng tuyển ở ghép (Hồ sơ định danh đầy đủ + dọn vào từ tháng sau) */}
      {applyPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white p-6 md:p-8 shadow-2xl">
            <h2 className="text-xl font-bold text-text">Hồ sơ ứng tuyển ở ghép</h2>
            <p className="mt-1 text-xs text-muted">
              Đăng ký vào bài đăng: <b>“{applyPost.title}”</b> (Phòng {roomOf(applyPost.roomId)?.code ?? `#${applyPost.roomId}`}).
            </p>

            <div className="mt-4 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-800">
              <span className="flex items-start gap-2">
                <Icon name="clock" size={15} className="mt-0.5 shrink-0" />
                <span>
                  <b>Quy định chu kỳ hóa đơn:</b> Thành viên ở ghép bắt đầu tính từ ngày 1 của tháng tiếp theo (<b>{fmtDate(minMoveInDate)}</b>) để đảm bảo tiền phòng, điện, nước được chia rõ ràng, minh bạch cho toàn bộ thành viên.
                </span>
              </span>
            </div>

            <div className="mt-4 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text">Họ và tên *</label>
                  <input
                    type="text"
                    value={applyName}
                    onChange={(e) => setApplyName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="mt-1 w-full rounded-lg border border-line p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text">Số điện thoại *</label>
                  <input
                    type="tel"
                    value={applyPhone}
                    onChange={(e) => setApplyPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                    placeholder="0901234567"
                    className="mt-1 w-full rounded-lg border border-line p-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text">Ngày sinh</label>
                  <input
                    type="date"
                    value={applyDob}
                    onChange={(e) => setApplyDob(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-line p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text">Giới tính</label>
                  <select
                    value={applyGender}
                    onChange={(e) => setApplyGender(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-line bg-white p-2 text-sm"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text">Số CCCD *</label>
                  <input
                    type="text"
                    value={applyCccd}
                    onChange={(e) => setApplyCccd(e.target.value.replace(/\D/g, "").slice(0, 12))}
                    placeholder="9 hoặc 12 số"
                    className="mt-1 w-full rounded-lg border border-line p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text">Ngày cấp</label>
                  <input
                    type="date"
                    value={applyCccdDate}
                    onChange={(e) => setApplyCccdDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-line p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text">Nơi cấp</label>
                  <input
                    type="text"
                    value={applyCccdPlace}
                    onChange={(e) => setApplyCccdPlace(e.target.value)}
                    placeholder="Cục CS QLHC..."
                    className="mt-1 w-full rounded-lg border border-line p-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text">Nghề nghiệp / Đơn vị</label>
                  <input
                    type="text"
                    value={applyOccupation}
                    onChange={(e) => setApplyOccupation(e.target.value)}
                    placeholder="Sinh viên / Nhân viên văn phòng"
                    className="mt-1 w-full rounded-lg border border-line p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text">Ngày dự kiến chuyển vào *</label>
                  <input
                    type="date"
                    min={minMoveInDate}
                    value={applyMoveInDate}
                    onChange={(e) => setApplyMoveInDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-line p-2 text-sm bg-surface font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text">Địa chỉ thường trú:</label>
                <input
                  type="text"
                  value={applyAddress}
                  onChange={(e) => setApplyAddress(e.target.value)}
                  placeholder="Xã/Phường, Quận/Huyện, Tỉnh/Thành phố"
                  className="mt-1 w-full rounded-lg border border-line p-2 text-sm"
                />
              </div>

              {/* Upload ảnh CCCD */}
              <div>
                <label className="block text-xs font-semibold text-text">Ảnh CCCD 2 mặt (Xác thực phụ lục hợp đồng):</label>
                <div className="mt-1.5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-dashed border-line p-3 text-center bg-surface">
                    <span className="block text-xs font-semibold text-muted">Mặt trước</span>
                    {frontPreview ? (
                      <img src={frontPreview} alt="Mặt trước" className="mt-2 h-20 w-full object-cover rounded-lg" />
                    ) : (
                      <div className="my-3 text-xs text-muted">Chưa chọn ảnh</div>
                    )}
                    <input type="file" accept="image/*" onChange={handleFrontFileChange} className="mt-1 text-xs w-full" />
                  </div>
                  <div className="rounded-xl border border-dashed border-line p-3 text-center bg-surface">
                    <span className="block text-xs font-semibold text-muted">Mặt sau</span>
                    {backPreview ? (
                      <img src={backPreview} alt="Mặt sau" className="mt-2 h-20 w-full object-cover rounded-lg" />
                    ) : (
                      <div className="my-3 text-xs text-muted">Chưa chọn ảnh</div>
                    )}
                    <input type="file" accept="image/*" onChange={handleBackFileChange} className="mt-1 text-xs w-full" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text">Lời nhắn giới thiệu bản thân & thói quen sinh hoạt:</label>
                <textarea
                  rows={2}
                  value={applyMessage}
                  onChange={(e) => setApplyMessage(e.target.value)}
                  placeholder="Giờ giấc sinh hoạt, tính cách, sở thích, cam kết giữ gìn vệ sinh chung..."
                  className="mt-1 w-full rounded-lg border border-line p-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-line pt-4">
              <button
                className="cx-btn ghost"
                onClick={() => setApplyPost(null)}
              >
                Hủy
              </button>
              <button
                className="cx-btn"
                disabled={submitting}
                onClick={handleApply}
              >
                {submitting ? "Đang gửi hồ sơ…" : "Xác nhận gửi hồ sơ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: View Single Application Dossier */}
      {viewingApp && (
        <RoommateApplicationModal
          app={viewingApp}
          customerName={customerOf(viewingApp.customerId)}
          roomCode={(() => {
            const post = [...posts, ...myPosts].find((p) => sameId(p.id, viewingApp.roommatePostId));
            return roomOf(post?.roomId ?? 0)?.code ?? `#${post?.roomId ?? "?"}`;
          })()}
          buildingName={(() => {
            const post = [...posts, ...myPosts].find((p) => sameId(p.id, viewingApp.roommatePostId));
            return buildingOf(post?.buildingId ?? 0) ?? `Tòa #${post?.buildingId ?? "?"}`;
          })()}
          onClose={() => setViewingApp(null)}
          onAccept={
            viewingApp.status === "PENDING"
              ? () => {
                  void handleAcceptApp(viewingApp.id);
                  setViewingApp(null);
                }
              : undefined
          }
          onReject={
            viewingApp.status === "PENDING"
              ? () => {
                  void handleRejectApp(viewingApp.id);
                  setViewingApp(null);
                }
              : undefined
          }
          busy={busyAppId !== null && sameId(busyAppId, viewingApp.id)}
        />
      )}
    </>
  );
}
