"use strict";

// JavaScript thuần. Ngày giờ tính theo Việt Nam; tuần bắt đầu vào thứ Hai.
const TIME_ZONE = "Asia/Bangkok";
const DATA_KEY = "student-balance-data-v1";
const SESSION_KEY = "student-balance-session";
const DEMO_DATA_VERSION = 2;
const WORK_LIMIT = 28;
const DAY_NAMES = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];
const TYPES = { study: { label: "Lịch học", icon: "book" }, work: { label: "Ca làm", icon: "briefcase" }, exam: { label: "Lịch thi", icon: "deadline" }, deadline: { label: "Deadline", icon: "deadline" }, personal: { label: "Cá nhân", icon: "user" } };
const PAGE_NAMES = { home: "Trang chủ", calendar: "Lịch của tôi", deadlines: "Deadline", swaps: "Góc đổi ca", stats: "Thống kê", profile: "Hồ sơ" };
const main = document.getElementById("main-content");
const dialog = document.getElementById("app-dialog");
let currentPage = "home";
let selectedWeek = getWeekStart(todayString());
let calendarFilter = "all";
let deadlineFilter = "pending";
let swapFilter = "all";
let pendingConflict = null;
let toastTimer;
let currentStudentId = "";
let state = loadState();

// 1. Hàm dùng chung. Escape nội dung trước khi đưa vào HTML.
function icon(name) { return `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`; }
function escapeHTML(value = "") { return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character])); }
function uniqueId(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; }
function todayString() {
  const parts = new Intl.DateTimeFormat("en", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = type => parts.find(item => item.type === type).value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function addDays(date, amount) {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + amount);
  return result.toISOString().slice(0, 10);
}
function getWeekStart(date) { return addDays(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7)); }
function shortDate(date) { return date.split("-").reverse().join("/"); }
function displayDate(date, options = {}) { return new Intl.DateTimeFormat("vi-VN", { timeZone: TIME_ZONE, day: "numeric", month: "long", ...options }).format(new Date(`${date}T12:00:00+07:00`)); }
function dayName(date) { return DAY_NAMES[(new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7]; }
function minutes(time) { const [hours, minute] = time.split(":").map(Number); return hours * 60 + minute; }
function duration(event) { return (minutes(event.end) - minutes(event.start)) / 60; }
function number(value) { return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value); }
function initials(name) { return name.trim().split(/\s+/).slice(-2).map(part => part[0] || "").join("").toUpperCase(); }
function weekLabel() { return `${shortDate(selectedWeek).slice(0, 5)} – ${shortDate(addDays(selectedWeek, 6))}`; }
function inWeek(date, week = selectedWeek) { return date >= week && date <= addDays(week, 6); }
function emptyState(title, description, iconName = "calendar", action = "") { return `<div class="empty-state">${icon(iconName)}<h3>${title}</h3><p>${description}</p>${action}</div>`; }

// 2. Dữ liệu mẫu cho ba tuần: 18 giờ, 24 giờ và 30 giờ làm.
// Ngày mẫu được đặt theo ngày mở trang lần đầu; không cần nhập thủ công.
function createDemoState() {
  const today = todayString();
  const monday = getWeekStart(today);
  const daysAgo = days => Date.now() - days * 86400000;
  const events = [];
  const classTemplates = [
    { key: "web", title: "Lập trình Web", day: 0, start: "08:00", end: "10:00", location: "Phòng A203", notes: "Mang laptop. Thực hành giao diện HTML, CSS và JavaScript." },
    { key: "math", title: "Xác suất thống kê", day: 0, start: "13:00", end: "15:00", location: "Phòng B102", notes: "Ôn bài phân phối xác suất và chuẩn bị bài tập chương 3." },
    { key: "database", title: "Cơ sở dữ liệu", day: 1, start: "09:00", end: "11:00", location: "Phòng B205", notes: "Thực hành truy vấn SQL và mô hình quan hệ." },
    { key: "english", title: "Tiếng Anh chuyên ngành", day: 2, start: "08:00", end: "10:00", location: "Phòng A105", notes: "Chuẩn bị phần thuyết trình chủ đề công nghệ." },
    { key: "design", title: "Thiết kế UI/UX", day: 3, start: "13:00", end: "15:00", location: "Phòng C102", notes: "Mang bản phác thảo ứng dụng và báo cáo nghiên cứu người dùng." },
    { key: "teamwork", title: "Kỹ năng làm việc nhóm", day: 0, start: "10:00", end: "11:00", location: "Phòng A204", notes: "Thảo luận phân công nhiệm vụ đồ án. Tiếp nối sau giờ Lập trình Web." },
    { key: "mobile", title: "Lập trình ứng dụng di động", day: 2, start: "13:00", end: "16:00", location: "Phòng máy C201", notes: "Thực hành màn hình đăng nhập và điều hướng ứng dụng." },
    { key: "network", title: "Mạng máy tính", day: 3, start: "08:00", end: "11:00", location: "Phòng máy B302", notes: "Thực hành cấu hình mạng LAN và kiểm tra kết nối." },
    { key: "startup", title: "Khởi nghiệp sáng tạo", day: 4, start: "08:00", end: "10:00", location: "Phòng D101", notes: "Hoàn thiện ý tưởng Student Balance và phân tích khảo sát của nhóm." },
    { key: "project", title: "Thực hành đồ án nhóm", day: 5, start: "13:00", end: "16:00", location: "Thư viện – Phòng nhóm 02", notes: "Ghép các phần giao diện, rà soát chức năng và tập thuyết trình." }
  ];
  const legacyClasses = new Set(["web", "math", "database", "english", "design"]);
  const shiftTemplates = [
    { key: "work-mon", title: "Ca làm Coffee House", day: 0, start: "18:00", end: "22:00", location: "Coffee House Nguyễn Văn Linh", workplace: "Coffee House", wage: 25000, notes: "Nhân viên phục vụ: nhận order, hỗ trợ khách và dọn bàn cuối ca." },
    { key: "work-tue", title: "Ca làm Coffee House", day: 1, start: "18:00", end: "22:00", location: "Coffee House Nguyễn Văn Linh", workplace: "Coffee House", wage: 25000, notes: "Có mặt trước ca 10 phút để nhận bàn giao." },
    { key: "work-wed", title: "Ca làm Circle K", day: 2, start: "18:00", end: "23:00", location: "Circle K Nguyễn Hữu Thọ", workplace: "Circle K", wage: 28000, notes: "Hỗ trợ thu ngân, bổ sung hàng lên kệ và kiểm tra tồn kho." },
    { key: "work-fri", title: "Ca làm Coffee House", day: 4, start: "17:00", end: "22:00", location: "Coffee House Nguyễn Văn Linh", workplace: "Coffee House", wage: 25000, notes: "Ca đông khách cuối tuần. Kiểm tra lịch thi trước khi nhận ca." },
    { key: "work-thu", title: "Ca bổ sung Circle K", day: 3, start: "17:00", end: "23:00", location: "Circle K Nguyễn Hữu Thọ", workplace: "Circle K", wage: 28000, notes: "Ca bổ sung 6 giờ. Hãy theo dõi tổng giờ làm trong tuần." },
    { key: "work-sat", title: "Ca cuối tuần Coffee House", day: 5, start: "16:00", end: "22:00", location: "Coffee House Nguyễn Văn Linh", workplace: "Coffee House", wage: 30000, notes: "Ca 6 giờ tiếp nối sau buổi đồ án. Cân nhắc đổi ca nếu tuần quá tải." }
  ];
  for (let week = 0; week < 3; week++) {
    const eventDate = day => addDays(monday, week * 7 + day);
    classTemplates.forEach(item => {
      const id = week === 0 && legacyClasses.has(item.key) ? `demo-${item.key}` : `demo-v2-w${week}-${item.key}`;
      events.push({ id, type: "study", title: item.title, date: eventDate(item.day), start: item.start, end: item.end, location: item.location, notes: item.notes, workplace: "", wage: "" });
    });
    // Bốn ca cơ bản = 18h; thêm ca thứ Năm = 24h; thêm ca thứ Bảy = 30h.
    shiftTemplates.slice(0, 4 + week).forEach(item => {
      const id = week === 0 ? `demo-${item.key}` : `demo-v2-w${week}-${item.key}`;
      events.push({ id, type: "work", title: item.title, date: eventDate(item.day), start: item.start, end: item.end, location: item.location, workplace: item.workplace, wage: item.wage, notes: item.notes });
    });
    const exams = [
      { title: "Thi Cơ sở dữ liệu", day: 4, start: "18:00", end: "20:00", location: "Phòng B301" },
      { title: "Kiểm tra Thiết kế UI/UX", day: 1, start: "13:00", end: "15:00", location: "Phòng C102" },
      { title: "Thi Mạng máy tính", day: 3, start: "18:00", end: "20:00", location: "Phòng B302" }
    ];
    const exam = exams[week];
    events.push({ id: week === 0 ? "demo-exam" : `demo-v2-w${week}-exam`, type: "exam", title: exam.title, date: eventDate(exam.day), start: exam.start, end: exam.end, location: exam.location, workplace: "", wage: "", notes: "Mang thẻ sinh viên và có mặt trước giờ thi 15 phút." });
    [
      { key: "personal", title: "Chạy bộ & nạp năng lượng", day: 5, start: "09:00", end: "10:00", location: "Công viên gần nhà" },
      { key: "exercise", title: "Đi bộ sáng Chủ nhật", day: 6, start: "08:00", end: "09:00", location: "Công viên ven sông" },
      { key: "rest", title: "Đọc sách & nghỉ ngơi", day: 6, start: "16:00", end: "18:00", location: "Ở nhà" }
    ].forEach(item => events.push({ id: week === 0 && item.key === "personal" ? "demo-personal" : `demo-v2-w${week}-${item.key}`, type: "personal", title: item.title, date: eventDate(item.day), start: item.start, end: item.end, location: item.location, workplace: "", wage: "", notes: "Thời gian dành cho bản thân, tạm nghỉ học và công việc." }));
  }
  return {
    version: 1,
    demoVersion: DEMO_DATA_VERSION,
    demoSeedWeek: monday,
    profile: { name: "Nguyễn Văn An", email: "an.nguyen@example.com", major: "Công nghệ thông tin", year: "Năm 3", maxHours: 28 },
    events,
    deadlines: [
      { id: "demo-deadline-design", title: "Báo cáo Design Thinking", subject: "Khởi nghiệp sáng tạo", date: addDays(today, 3), end: "23:59", createdAt: daysAgo(5), completed: false, notes: "Hoàn thiện báo cáo khảo sát, chân dung người dùng và slide của nhóm." },
      { id: "demo-deadline-web", title: "Bài tập Lập trình Web", subject: "Lập trình Web", date: addDays(today, 5), end: "23:59", createdAt: daysAgo(4), completed: false, notes: "Xây dựng giao diện responsive bằng HTML, CSS và JavaScript." },
      { id: "demo-deadline-db", title: "Đồ án Cơ sở dữ liệu", subject: "Cơ sở dữ liệu", date: addDays(today, 8), end: "17:00", createdAt: daysAgo(6), completed: false, notes: "Kiểm tra mô hình dữ liệu và chuẩn bị bản thuyết trình." },
      { id: "demo-v2-deadline-today", title: "Nộp wireframe ứng dụng", subject: "Thiết kế UI/UX", date: today, end: "23:59", createdAt: daysAgo(7), completed: false, notes: "Xuất bản PDF gồm màn hình đăng nhập, dashboard và lịch tuần." },
      { id: "demo-v2-deadline-urgent", title: "Bài tập phân phối xác suất", subject: "Xác suất thống kê", date: addDays(today, 1), end: "17:00", createdAt: daysAgo(5), completed: false, notes: "Làm bài 1–5 trong phiếu bài tập chương 3 và kiểm tra kết quả." },
      { id: "demo-v2-deadline-overdue", title: "Bài luyện đọc tiếng Anh", subject: "Tiếng Anh chuyên ngành", date: addDays(today, -1), end: "23:59", createdAt: daysAgo(8), completed: false, notes: "Đọc bài về công nghệ trong đời sống sinh viên, trả lời 5 câu hỏi và nộp bổ sung bài luyện đọc." },
      { id: "demo-v2-deadline-done", title: "Sơ đồ mạng LAN", subject: "Mạng máy tính", date: addDays(today, -2), end: "17:00", createdAt: daysAgo(10), completed: true, notes: "Đã nộp sơ đồ kết nối, địa chỉ IP và báo cáo thực hành." },
      { id: "demo-v2-deadline-future", title: "Thuyết trình ứng dụng di động", subject: "Lập trình ứng dụng di động", date: addDays(today, 14), end: "09:00", createdAt: daysAgo(2), completed: false, notes: "Chuẩn bị demo ứng dụng, chia phần trình bày và kiểm tra trên điện thoại." }
    ],
    swaps: [
      { id: "demo-swap-1", title: "Coffee House – Nhân viên phục vụ", date: addDays(today, 4), start: "18:00", end: "22:00", location: "Coffee House Nguyễn Văn Linh", reason: "Trùng lịch thi cuối kỳ", notes: "Bạn nào có thể hỗ trợ thì nhận ca giúp mình nhé!", author: "Trần Minh Khôi", authorId: "demo-khoi", requestedBy: [], sourceEventId: "" },
      { id: "demo-swap-2", title: "Circle K – Nhân viên bán hàng", date: addDays(today, 5), start: "18:00", end: "23:00", location: "Circle K Nguyễn Hữu Thọ", reason: "Có việc gia đình", notes: "Ưu tiên bạn đã từng làm ở cửa hàng.", author: "Lê Thị Mai", authorId: "demo-mai", requestedBy: [], sourceEventId: "" },
      { id: "demo-swap-3", title: "Gia sư – Tiếng Anh", date: addDays(today, 6), start: "09:00", end: "11:00", location: "Trung tâm Anh ngữ Sunshine", reason: "Cần thời gian hoàn thành đồ án", notes: "Lớp tiếng Anh cơ bản, tài liệu đã chuẩn bị sẵn.", author: "Phạm Ngọc Linh", authorId: "demo-linh", requestedBy: [], sourceEventId: "" },
      { id: "demo-v2-swap-bookstore", title: "Nhà sách – Hỗ trợ bán hàng", date: addDays(today, 2), start: "17:00", end: "21:00", location: "Nhà sách Mặt Trời – Đường Nguyễn Văn Cừ", reason: "Có buổi học bù", notes: "Sắp xếp sách, hỗ trợ tìm sách và kiểm kê cuối ca.", author: "Nguyễn Trúc Linh", authorId: "demo-truc-linh", requestedBy: [], sourceEventId: "" },
      { id: "demo-v2-swap-tea", title: "Trà sữa – Nhân viên thu ngân", date: addDays(today, 3), start: "18:00", end: "22:00", location: "Trà sữa Mây – Đường Lê Văn Việt", reason: "Trùng buổi thuyết trình nhóm", notes: "Có người hướng dẫn trong 30 phút đầu ca.", author: "Lê Bảo An", authorId: "demo-bao-an", requestedBy: [], sourceEventId: "" },
      { id: "demo-v2-swap-cinema", title: "Rạp phim – Soát vé", date: addDays(today, 7), start: "16:00", end: "22:00", location: "Rạp phim Ánh Sao – Khu trung tâm", reason: "Cần ôn thi Mạng máy tính", notes: "Hỗ trợ kiểm tra vé và hướng dẫn khách đến phòng chiếu.", author: "Đào Quang Huy", authorId: "demo-quang-huy", requestedBy: [], sourceEventId: "" },
      { id: "demo-v2-swap-tutor", title: "Gia sư – Toán lớp 9", date: addDays(today, 9), start: "18:00", end: "20:00", location: "Trung tâm Học tốt – Đường Phạm Văn Đồng", reason: "Tham gia hoạt động câu lạc bộ", notes: "Ôn phương trình bậc hai; giáo án và bài tập đã có sẵn.", author: "Võ Minh Khang", authorId: "demo-minh-khang", requestedBy: [], sourceEventId: "" },
      { id: "demo-v2-swap-bakery", title: "Tiệm bánh – Nhân viên phục vụ", date: addDays(today, 11), start: "07:00", end: "11:00", location: "Tiệm bánh Nắng – Đường Hoàng Diệu", reason: "Có lịch bảo vệ đồ án", notes: "Hỗ trợ quầy bánh, đóng gói và đón khách buổi sáng.", author: "Phạm Thu Hà", authorId: "demo-thu-ha", requestedBy: [], sourceEventId: "" }
    ],
    readNotifications: []
  };
}

// Bổ sung mẫu mới vào trình duyệt đã mở bản cũ, không ghi đè lịch/hồ sơ đã sửa.
// Những mẫu cũ đã bị xóa cũng không được tự thêm lại.
function upgradeDemoData(saved) {
  if ((saved.demoVersion || 1) >= DEMO_DATA_VERSION) return saved;
  const demo = createDemoState();
  ["events", "deadlines", "swaps"].forEach(collection => {
    const existingIds = new Set(saved[collection].map(item => item.id));
    demo[collection].forEach(item => {
      if (item.id.startsWith("demo-v2-") && !existingIds.has(item.id)) saved[collection].push(item);
    });
  });
  saved.demoVersion = DEMO_DATA_VERSION;
  saved.demoSeedWeek = demo.demoSeedWeek;
  try { localStorage.setItem(DATA_KEY, JSON.stringify(saved)); }
  catch (error) { console.warn("Chưa lưu được dữ liệu mẫu bổ sung.", error); }
  return saved;
}
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(DATA_KEY) || "null");
    if (saved?.version === 1 && saved.profile && [saved.events, saved.deadlines, saved.swaps, saved.readNotifications].every(Array.isArray)) return upgradeDemoData(saved);
  } catch (error) { console.warn("Không đọc được dữ liệu đã lưu.", error); }
  return createDemoState();
}
function saveState() {
  try { localStorage.setItem(DATA_KEY, JSON.stringify(state)); return true; }
  catch (error) { console.warn(error); toast("Chưa lưu được dữ liệu. Hãy bật bộ nhớ trình duyệt để giữ dữ liệu khi tải lại.", true); return false; }
}

// 3. Khoảng giao nhau: cùng ngày và startA < endB, endA > startB.
// Hai lịch tiếp nối tại cùng thời điểm không tính là trùng.
function overlaps(first, second) { return first.date === second.date && minutes(first.start) < minutes(second.end) && minutes(first.end) > minutes(second.start); }
function getConflicts(events = state.events) {
  const conflicts = [];
  events.filter(event => event.type === "work").forEach(work => {
    events.filter(event => event.type === "study" || event.type === "exam").forEach(school => { if (overlaps(work, school)) conflicts.push({ work, school }); });
  });
  return conflicts;
}
function getWeekMetrics(week = selectedWeek) {
  const events = state.events.filter(event => inWeek(event.date, week));
  const studyHours = events.filter(event => event.type === "study" || event.type === "exam").reduce((sum, event) => sum + duration(event), 0);
  const workHours = events.filter(event => event.type === "work").reduce((sum, event) => sum + duration(event), 0);
  // Gộp các khoảng trùng để không tính hai lần khi trừ thời gian đã có lịch.
  let occupied = 0;
  for (let day = 0; day < 7; day++) {
    const intervals = events.filter(event => event.date === addDays(week, day)).map(event => [minutes(event.start), minutes(event.end)]).sort((a, b) => a[0] - b[0]);
    let begin = -1;
    let finish = -1;
    intervals.forEach(([start, end]) => {
      if (start > finish) { if (begin >= 0) occupied += finish - begin; begin = start; finish = end; }
      else finish = Math.max(finish, end);
    });
    if (begin >= 0) occupied += finish - begin;
  }
  return { studyHours, workHours, freeHours: Math.max(0, 112 - occupied / 60), deadlineCount: state.deadlines.filter(deadline => inWeek(deadline.date, week)).length, conflicts: getConflicts(events) };
}
function workloadStatus(hours) {
  if (hours >= WORK_LIMIT) return { label: "Nguy cơ quá tải", color: "danger", message: "Bạn đã vượt ngưỡng cảnh báo do hệ thống thiết lập. Hãy cân nhắc giảm hoặc đổi ca làm." };
  if (hours >= 20) return { label: "Cần chú ý", color: "warning", message: "Bạn đang làm khá nhiều. Hãy đảm bảo ngủ đủ và dành thời gian cho việc học." };
  return { label: "Ổn định", color: "study", message: "Lịch làm hiện tại đang ở mức hợp lý." };
}
function deadlineStatus(deadline) {
  if (deadline.completed) return { label: "Đã hoàn thành", remaining: "Đã hoàn thành", color: "study", progress: 100 };
  const due = new Date(`${deadline.date}T${deadline.end}:00+07:00`).getTime();
  const days = Math.round((new Date(`${deadline.date}T00:00:00Z`) - new Date(`${todayString()}T00:00:00Z`)) / 86400000);
  const created = deadline.createdAt || due - 7 * 86400000;
  const progress = Math.max(0, Math.min(100, (Date.now() - created) / Math.max(1, due - created) * 100));
  if (due < Date.now()) return { label: "Quá hạn", remaining: days < 0 ? `Quá hạn ${Math.abs(days)} ngày` : "Đã quá giờ nộp", color: "danger", progress: 100 };
  const remaining = days === 0 ? "Đến hạn hôm nay" : `Còn ${days} ngày`;
  if (days <= 1) return { label: "Gấp", remaining, color: "danger", progress };
  if (days <= 3) return { label: "Sắp đến hạn", remaining, color: "warning", progress };
  return { label: "Còn nhiều thời gian", remaining, color: "personal", progress };
}
function upcomingDeadlines() { return state.deadlines.filter(deadline => !deadline.completed).sort((a, b) => `${a.date} ${a.end}`.localeCompare(`${b.date} ${b.end}`)); }

// 4. Phiên đăng nhập mô phỏng, tuyệt đối không lưu mật khẩu.
function login(studentId, remember) {
  currentStudentId = studentId;
  try {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify({ studentId }));
  } catch (error) { toast("Phiên đăng nhập chỉ được giữ đến khi đóng trang.", true); }
  saveState();
  showApp();
}
function showApp() {
  document.getElementById("login-screen").hidden = true;
  document.getElementById("app-shell").hidden = false;
  navigate(window.location.hash.slice(1), false);
}
function logout() {
  try { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); } catch (error) { console.warn(error); }
  closeDialog(); hideNotifications(); currentStudentId = "";
  document.getElementById("login-form").reset();
  document.getElementById("login-password").type = "password";
  document.getElementById("toggle-password").setAttribute("aria-label", "Hiện mật khẩu");
  document.getElementById("login-screen").hidden = false;
  document.getElementById("app-shell").hidden = true;
  document.querySelector('#login-form [name="studentId"]').focus();
  toast("Bạn đã đăng xuất. Dữ liệu vẫn được lưu trên trình duyệt.");
}
function navigate(page, scroll = true) {
  currentPage = PAGE_NAMES[page] ? page : "home";
  if (window.location.hash !== `#${currentPage}`) window.history.replaceState(null, "", `#${currentPage}`);
  hideNotifications(); render();
  if (scroll) { window.scrollTo({ top: 0, behavior: "instant" }); main.focus({ preventScroll: true }); }
}
function render() {
  const pages = { home: renderHome, calendar: renderCalendarPage, deadlines: renderDeadlinesPage, swaps: renderSwapsPage, stats: renderStatsPage, profile: renderProfilePage };
  main.innerHTML = pages[currentPage]();
  document.getElementById("header-page-title").textContent = PAGE_NAMES[currentPage];
  document.title = `${PAGE_NAMES[currentPage]} · Student Balance`;
  document.getElementById("header-date").textContent = `${dayName(todayString())}, ${displayDate(todayString(), { year: "numeric" })}`;
  document.querySelectorAll("[data-profile-name]").forEach(element => { element.textContent = state.profile.name; });
  document.querySelectorAll("[data-avatar]").forEach(element => { element.textContent = initials(state.profile.name); });
  document.querySelectorAll(".side-nav [data-page], .bottom-nav [data-page]").forEach(button => {
    button.classList.toggle("active", button.dataset.page === currentPage);
    if (button.dataset.page === currentPage) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
  });
  document.getElementById("nav-deadline-count").textContent = upcomingDeadlines().length;
  updateNotificationBadge();
}
function pageHeading(title, subtitle, action = "", eyebrow = "") { return `<div class="page-heading"><div>${eyebrow ? `<span class="eyebrow">${eyebrow}</span>` : ""}<h1>${title}</h1><p>${subtitle}</p></div>${action}</div>`; }
function addEventButton(type = "") { return `<button class="button primary" data-action="add-event" data-type="${type}">${icon("plus")}Thêm ${type === "deadline" ? "deadline" : "lịch"}</button>`; }
function statCard(label, value, unit, iconName, color, foot, footColor = "") { return `<article class="panel stat-card"><div class="stat-top"><span class="stat-label">${label}</span><span class="stat-icon ${color}">${icon(iconName)}</span></div><div class="stat-value">${value}<span>${unit}</span></div><p class="stat-foot ${footColor}">${footColor ? icon(footColor === "red" ? "warning" : "check") : ""}${foot}</p></article>`; }
function balanceCard(hours) {
  const status = workloadStatus(hours);
  return `<section class="panel balance-panel"><div class="balance-top"><h2>Mức độ cân bằng tuần này</h2><span class="badge ${status.color}">${icon(status.color === "study" ? "check" : "warning")}${status.label}</span></div><p class="balance-copy">${status.message}</p><div class="balance-meter"><div class="balance-meter-top"><strong>${number(hours)} giờ làm việc</strong><span>Ngưỡng cảnh báo: 28 giờ</span></div><div class="progress-track" role="progressbar" aria-label="Giờ làm so với ngưỡng cảnh báo" aria-valuemin="0" aria-valuemax="28" aria-valuenow="${Math.min(hours, 28)}" aria-valuetext="${number(hours)} giờ làm việc"><div class="progress-fill ${status.color}" style="width:${Math.min(100, hours / 28 * 100)}%"></div></div><div class="balance-scale"><span>0 giờ</span><span>20 giờ</span><span>28 giờ</span></div></div><p class="balance-disclaimer">Ngưỡng cảnh báo được thiết lập cho prototype dựa trên dữ liệu khảo sát của nhóm.</p></section>`;
}
function overloadBanner(hours) {
  if (hours < WORK_LIMIT) return "";
  return `<section class="overload-banner" role="alert"><h2>${icon("warning")}Nguy cơ quá tải</h2><p>Bạn đang có <strong>${number(hours)} giờ làm trong tuần này.</strong> Hãy cân nhắc giảm hoặc đổi một số ca để tránh ảnh hưởng đến việc học và nghỉ ngơi.</p><div class="overload-actions"><button class="button secondary small" data-action="view-work">Xem các ca làm</button><button class="button danger small" data-action="choose-swap">Đăng tìm người đổi ca</button></div></section>`;
}
function renderHome() {
  const metrics = getWeekMetrics(getWeekStart(todayString()));
  const classes = state.events.filter(event => event.date === todayString() && event.type === "study");
  const deadlines = upcomingDeadlines();
  const conflict = metrics.conflicts[0];
  let html = pageHeading(`Xin chào, ${escapeHTML(state.profile.name)} 👋`, "Hãy kiểm tra lịch trình của bạn hôm nay.", addEventButton(), "MỘT TUẦN MỚI, NHỮNG MỤC TIÊU MỚI");
  html += `<nav class="mobile-secondary-nav" aria-label="Các mục khác"><button data-page="deadlines">${icon("deadline")}Deadline (${deadlines.length})</button><button data-page="stats">${icon("chart")}Thống kê tuần</button></nav>`;
  html += `<div class="stat-grid">${statCard("Lịch học hôm nay", classes.length, "buổi học", "book", "study", `${number(classes.reduce((sum, event) => sum + duration(event), 0))} giờ dành cho học tập`)}${statCard("Giờ làm tuần này", number(metrics.workHours), '<span class="value-total">/ 28</span> giờ', "briefcase", "work", workloadStatus(metrics.workHours).label, metrics.workHours < 20 ? "green" : metrics.workHours >= 28 ? "red" : "")}${statCard("Deadline sắp tới", deadlines.length, "deadline", "deadline", "personal", deadlines.length ? deadlineStatus(deadlines[0]).remaining : "Đã hoàn thành mọi bài tập")}${statCard("Xung đột lịch", metrics.conflicts.length, "cảnh báo", "warning", "danger", conflict ? "Có ca làm cần điều chỉnh" : "Lịch trình không bị trùng", conflict ? "red" : "green")}</div>`;
  html += overloadBanner(metrics.workHours) + `<div class="balance-row">${balanceCard(metrics.workHours)}<aside class="daily-note">${icon("coffee")}<h3>Một chút thời gian cho bạn</h3><p>Giữa những giờ học và ca làm, hãy nhớ nghỉ ngơi và nạp lại năng lượng nhé.</p></aside></div>`;
  if (conflict) html += `<div class="conflict-banner">${icon("warning")}<div class="conflict-banner-text"><strong>${escapeHTML(conflict.work.title)} đang trùng lịch ${conflict.school.type === "exam" ? "thi" : "học"}.</strong><p>${dayName(conflict.work.date)}, ${shortDate(conflict.work.date)} · ${escapeHTML(conflict.school.title)} (${conflict.school.start} – ${conflict.school.end})</p></div><button class="button small" data-action="event-detail" data-id="${escapeHTML(conflict.work.id)}">Xem & xử lý</button></div>`;
  return html + `<div class="dashboard-grid">${renderCalendar()}<div class="dashboard-side">${renderToday()}${renderMiniDeadlines()}</div></div>`;
}

// 5. Lịch tuần: vị trí theo phút, chia cột khi nhiều lịch trùng nhau.
function weekControls() { return `<div class="week-controls"><button class="icon-button prev" data-action="prev-week" aria-label="Tuần trước">${icon("chevron")}</button><span class="week-range">${weekLabel()}</span><button class="icon-button" data-action="next-week" aria-label="Tuần sau">${icon("chevron")}</button><button class="today-button" data-action="this-week">Hôm nay</button></div>`; }
function eventLayout(events) {
  const layouts = new Map();
  const sorted = [...events].sort((a, b) => minutes(a.start) - minutes(b.start));
  let cluster = [];
  let clusterEnd = -1;
  function placeCluster() {
    const ends = [];
    cluster.forEach(event => {
      let column = ends.findIndex(end => end <= minutes(event.start));
      if (column === -1) column = ends.length;
      ends[column] = minutes(event.end);
      layouts.set(event.id, { column, columns: 1 });
    });
    cluster.forEach(event => { layouts.get(event.id).columns = ends.length; });
  }
  sorted.forEach(event => {
    if (cluster.length && minutes(event.start) >= clusterEnd) { placeCluster(); cluster = []; clusterEnd = -1; }
    cluster.push(event); clusterEnd = Math.max(clusterEnd, minutes(event.end));
  });
  placeCluster();
  return layouts;
}
function renderCalendar() {
  const allEvents = state.events.filter(event => inWeek(event.date));
  const events = allEvents.filter(event => calendarFilter === "all" || event.type === calendarFilter);
  const conflicted = new Set(getConflicts(allEvents).flatMap(pair => [pair.work.id, pair.school.id]));
  let html = `<section class="panel calendar-panel"><div class="panel-heading"><h2>Lịch tuần của bạn</h2><button class="text-button" data-action="add-event">${icon("plus")} Thêm lịch</button></div><div class="calendar-toolbar">${weekControls()}<div class="filter-tabs" role="group" aria-label="Lọc loại lịch">${[["all", "Tất cả"], ["study", "Học"], ["work", "Làm"], ["exam", "Thi"]].map(([value, label]) => `<button data-filter="${value}" class="${calendarFilter === value ? "active" : ""}" aria-pressed="${calendarFilter === value}">${label}</button>`).join("")}</div></div><div class="calendar-grid"><div class="calendar-day-heading"></div>`;
  for (let day = 0; day < 7; day++) {
    const date = addDays(selectedWeek, day);
    html += `<div class="calendar-day-heading ${date === todayString() ? "is-today" : ""}">${DAY_NAMES[day]}<strong>${Number(date.slice(-2))}</strong></div>`;
  }
  html += '<div class="time-axis">';
  for (let hour = 7; hour <= 23; hour++) html += `<span class="time-label" style="top:${(hour - 7) * 34}px">${String(hour).padStart(2, "0")}:00</span>`;
  html += "</div>";
  for (let day = 0; day < 7; day++) {
    const date = addDays(selectedWeek, day);
    const dayEvents = events.filter(event => event.date === date);
    const layouts = eventLayout(dayEvents);
    html += `<div class="day-column ${date === todayString() ? "is-today" : ""}">`;
    dayEvents.forEach(event => {
      const layout = layouts.get(event.id);
      const top = (minutes(event.start) - 420) / 60 * 34;
      const height = duration(event) * 34;
      const width = 100 / layout.columns;
      html += `<button class="calendar-event ${event.type} ${conflicted.has(event.id) ? "conflicted" : ""}" data-action="event-detail" data-id="${escapeHTML(event.id)}" style="top:${Math.min(top, 520)}px;height:${Math.max(24, height - 3)}px;left:calc(${layout.column * width}% + 3px);width:calc(${width}% - 6px)" title="${escapeHTML(event.title)} · ${event.start} – ${event.end}" aria-label="${escapeHTML(event.title)}, ${shortDate(event.date)}, ${event.start} đến ${event.end}${conflicted.has(event.id) ? ", có xung đột lịch" : ""}"><strong>${escapeHTML(event.title)}</strong><small>${event.start} – ${event.end}</small>${height > 85 && event.location ? `<small class="event-place">${escapeHTML(event.location)}</small>` : ""}${conflicted.has(event.id) && height > 85 ? '<span class="conflict-mark">Trùng lịch</span>' : ""}</button>`;
    });
    html += "</div>";
  }
  html += '</div><div class="agenda-mobile">';
  for (let day = 0; day < 7; day++) {
    const date = addDays(selectedWeek, day);
    const dayEvents = events.filter(event => event.date === date).sort((a, b) => a.start.localeCompare(b.start));
    html += `<section class="agenda-day"><h3 class="agenda-day-heading ${date === todayString() ? "is-today" : ""}">${DAY_NAMES[day]}<span>${shortDate(date).slice(0, 5)}${date === todayString() ? " · Hôm nay" : ""}</span></h3>`;
    html += dayEvents.length ? dayEvents.map(event => `<button class="agenda-event ${event.type} ${conflicted.has(event.id) ? "conflicted" : ""}" data-action="event-detail" data-id="${escapeHTML(event.id)}">${icon(TYPES[event.type].icon)}<span class="agenda-event-info"><strong>${escapeHTML(event.title)}</strong><small>${escapeHTML(event.location || TYPES[event.type].label)}${conflicted.has(event.id) ? " · Trùng lịch" : ""}</small></span><span class="agenda-time">${event.start} – ${event.end}</span></button>`).join("") : '<p class="agenda-empty">Không có lịch. Một khoảng trống cho bạn.</p>';
    html += "</section>";
  }
  return html + `</div>${events.length ? "" : emptyState("Tuần này chưa có lịch phù hợp", "Thêm lịch mới hoặc chọn một bộ lọc khác.")}<div class="calendar-legend"><span class="legend-item"><span class="legend-dot"></span>Lịch học</span><span class="legend-item"><span class="legend-dot work"></span>Ca làm</span><span class="legend-item"><span class="legend-dot exam"></span>Lịch thi</span><span class="legend-item"><span class="legend-dot personal"></span>Cá nhân</span></div></section>`;
}
function renderCalendarPage() { return pageHeading("Lịch của tôi", "Một nơi cho lịch học, ca làm và thời gian của riêng bạn.", addEventButton()) + overloadBanner(getWeekMetrics().workHours) + renderCalendar(); }
function renderToday() {
  const events = state.events.filter(event => event.date === todayString()).sort((a, b) => a.start.localeCompare(b.start));
  return `<section class="panel"><div class="panel-heading today-heading"><div><h2>Hôm nay của bạn</h2><p class="today-date">${dayName(todayString())}, ${displayDate(todayString())}</p></div><span class="badge personal">${events.length} lịch</span></div><div class="today-timeline">${events.length ? events.map(event => `<button class="timeline-event" data-action="event-detail" data-id="${escapeHTML(event.id)}"><span class="timeline-marker ${event.type}"></span><span class="timeline-body"><span class="timeline-time">${event.start} – ${event.end}</span><strong>${escapeHTML(event.title)}</strong><span class="timeline-place">${icon("location")}${escapeHTML(event.location || "Chưa có địa điểm")}</span></span></button>`).join("") : emptyState("Hôm nay chưa có lịch", "Dành thời gian cho một điều bạn yêu thích.", "coffee")}<button class="text-button" data-page="calendar">Xem toàn bộ lịch</button></div></section>`;
}
function renderMiniDeadlines() {
  const deadlines = upcomingDeadlines().slice(0, 3);
  return `<section class="panel"><div class="panel-heading"><h2>Deadline sắp tới</h2><button class="text-button" data-page="deadlines">Xem tất cả</button></div><div class="mini-deadlines">${deadlines.length ? deadlines.map(deadline => {
    const status = deadlineStatus(deadline);
    return `<div class="mini-deadline"><input type="checkbox" data-deadline-check="${escapeHTML(deadline.id)}" aria-label="Hoàn thành ${escapeHTML(deadline.title)}"><div class="mini-deadline-body"><button data-action="deadline-detail" data-id="${escapeHTML(deadline.id)}">${escapeHTML(deadline.title)}</button><p>${shortDate(deadline.date)} · ${deadline.end}</p><span class="badge ${status.color}">${status.remaining}</span></div></div>`;
  }).join("") : emptyState("Bạn đã hoàn thành tất cả!", "Một chút nghỉ ngơi xứng đáng.", "check")}</div></section>`;
}

// 6. Deadline: thanh tiến độ là thời gian đã trôi qua đến hạn nộp.
function renderDeadlinesPage() {
  const pending = state.deadlines.filter(deadline => !deadline.completed).length;
  const filters = [["pending", `Chưa hoàn thành (${pending})`], ["completed", `Đã hoàn thành (${state.deadlines.length - pending})`], ["all", "Tất cả"]];
  const deadlines = [...state.deadlines].filter(deadline => deadlineFilter === "all" || (deadlineFilter === "completed" ? deadline.completed : !deadline.completed)).sort((a, b) => `${a.date} ${a.end}`.localeCompare(`${b.date} ${b.end}`));
  let html = pageHeading("Deadline của tôi", "Từng việc một, bạn sẽ hoàn thành mọi mục tiêu.", addEventButton("deadline"));
  html += `<div class="page-tabs" role="group" aria-label="Lọc deadline">${filters.map(([value, label]) => `<button data-deadline-filter="${value}" class="${deadlineFilter === value ? "active" : ""}" aria-pressed="${deadlineFilter === value}">${label}</button>`).join("")}</div>`;
  if (!deadlines.length) return html + `<div class="panel">${emptyState("Chưa có deadline trong mục này", "Thêm bài tập hoặc chọn một trạng thái khác.", "deadline", addEventButton("deadline"))}</div>`;
  return html + `<div class="content-grid">${deadlines.map(deadline => {
    const status = deadlineStatus(deadline);
    return `<article class="panel deadline-card ${deadline.completed ? "completed" : ""}"><div class="card-top"><span class="stat-icon personal">${icon("deadline")}</span><span class="badge ${status.color}">${status.label}</span></div><h2 class="card-title">${escapeHTML(deadline.title)}</h2><p class="card-subtitle">Môn: ${escapeHTML(deadline.subject || "Chưa có môn học")}</p><p class="deadline-due">${icon("calendar")}${shortDate(deadline.date)} · ${deadline.end}</p><div class="deadline-progress"><div class="progress-caption"><span>${status.remaining}</span><span>${Math.round(status.progress)}%</span></div><div class="progress-track" role="progressbar" aria-label="Thời gian đã qua đến hạn nộp" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(status.progress)}"><div class="progress-fill ${status.color}" style="width:${status.progress}%"></div></div></div>${deadline.notes ? `<p class="deadline-note">${escapeHTML(deadline.notes)}</p>` : ""}<div class="card-actions"><label class="checkbox-label"><input type="checkbox" data-deadline-check="${escapeHTML(deadline.id)}" ${deadline.completed ? "checked" : ""}>Đánh dấu hoàn thành</label><button class="icon-button" data-action="edit-deadline" data-id="${escapeHTML(deadline.id)}" aria-label="Chỉnh sửa ${escapeHTML(deadline.title)}">${icon("edit")}</button><button class="icon-button" data-action="delete-deadline" data-id="${escapeHTML(deadline.id)}" aria-label="Xóa ${escapeHTML(deadline.title)}">${icon("trash")}</button></div></article>`;
  }).join("")}</div><p class="chart-note">Thanh tiến độ biểu thị thời gian đã trôi qua từ khi tạo deadline đến hạn nộp.</p>`;
}
function setDeadlineCompleted(id, completed) {
  const deadline = state.deadlines.find(item => item.id === id);
  if (!deadline) return;
  deadline.completed = completed;
  const saved = saveState(); render();
  if (saved) toast(completed ? `Đã hoàn thành “${deadline.title}”. Làm tốt lắm!` : `Đã đưa “${deadline.title}” về trạng thái chưa hoàn thành.`);
}

// 7. Đổi ca mô phỏng; không gửi thông tin tới một hệ thống bên ngoài.
function isMySwap(swap) { return swap.authorId === currentStudentId; }
function renderSwapsPage() {
  const swaps = state.swaps.filter(swap => swapFilter === "all" || (swapFilter === "mine" ? isMySwap(swap) : swap.requestedBy.includes(currentStudentId)));
  let html = pageHeading("Góc đổi ca cộng đồng", "Chia sẻ một ca làm, giúp nhau cân bằng hơn.", `<button class="button primary" data-action="add-swap">${icon("plus")}Đăng ca cần đổi</button>`);
  html += `<div class="section-description">${icon("swap")}Đây là cộng đồng mô phỏng. Bài đăng và yêu cầu nhận ca chỉ được lưu trên trình duyệt này.</div><div class="page-tabs" role="group" aria-label="Lọc bài đăng đổi ca">${[["all", "Tất cả ca"], ["mine", "Ca của tôi"], ["requested", "Đã gửi yêu cầu"]].map(([value, label]) => `<button data-swap-filter="${value}" class="${swapFilter === value ? "active" : ""}" aria-pressed="${swapFilter === value}">${label}</button>`).join("")}</div>`;
  if (!swaps.length) return html + `<div class="panel">${emptyState("Chưa có ca trong mục này", "Bạn có thể đăng ca cần đổi hoặc xem các bài đăng khác.", "swap")}</div>`;
  return html + `<div class="content-grid">${swaps.map(swap => {
    const requested = swap.requestedBy.includes(currentStudentId);
    const mine = isMySwap(swap);
    const past = new Date(`${swap.date}T${swap.end}:00+07:00`).getTime() < Date.now();
    return `<article class="panel swap-card"><div class="card-top"><span class="stat-icon work">${icon("briefcase")}</span><span class="badge ${mine ? "personal" : past ? "warning" : "work"}">${mine ? "Ca của bạn" : past ? "Đã qua thời gian" : "Cần người hỗ trợ"}</span></div><h2 class="card-title">${escapeHTML(swap.title)}</h2><p class="swap-detail">${icon("calendar")}${dayName(swap.date)}, ${shortDate(swap.date)}</p><p class="swap-detail">${icon("clock")}${swap.start} – ${swap.end} (${number(duration(swap))} giờ)</p><p class="swap-detail">${icon("location")}${escapeHTML(swap.location)}</p><p class="swap-reason">Lý do: <strong>${escapeHTML(swap.reason)}</strong></p>${swap.notes ? `<p class="deadline-note">${escapeHTML(swap.notes)}</p>` : ""}<div class="card-actions"><span class="swap-user"><span class="avatar">${escapeHTML(initials(swap.author))}</span>${escapeHTML(swap.author)}</span>${mine ? `<button class="icon-button" data-action="delete-swap" data-id="${escapeHTML(swap.id)}" aria-label="Xóa bài đăng ${escapeHTML(swap.title)}">${icon("trash")}</button>` : requested ? `<span class="swap-requested">${icon("check")}Đã gửi</span>` : `<button class="button ${past ? "secondary" : "primary"} small" data-action="accept-swap" data-id="${escapeHTML(swap.id)}" ${past ? "disabled" : ""}>Nhận ca</button>`}</div></article>`;
  }).join("")}</div>`;
}
function acceptSwap(id) {
  const swap = state.swaps.find(item => item.id === id);
  if (!swap || isMySwap(swap) || swap.requestedBy.includes(currentStudentId)) return;
  if (new Date(`${swap.date}T${swap.end}:00+07:00`).getTime() < Date.now()) return toast("Ca này đã qua thời gian nhận.", true);
  swap.requestedBy.push(currentStudentId);
  const saved = saveState(); render();
  if (saved) toast("Bạn đã gửi yêu cầu nhận ca thành công.");
}

// 8. Biểu đồ bằng CSS và dữ liệu thật, không dùng thư viện.
function renderStatsPage() {
  const metrics = getWeekMetrics();
  const events = state.events.filter(event => inWeek(event.date));
  const days = DAY_NAMES.map((label, index) => {
    const dayEvents = events.filter(event => event.date === addDays(selectedWeek, index));
    return { label: index === 6 ? "CN" : `T${index + 2}`, study: dayEvents.filter(event => event.type === "study" || event.type === "exam").reduce((sum, event) => sum + duration(event), 0), work: dayEvents.filter(event => event.type === "work").reduce((sum, event) => sum + duration(event), 0) };
  });
  const maxHours = Math.max(6, ...days.flatMap(day => [day.study, day.work]));
  const personal = events.filter(event => event.type === "personal").reduce((sum, event) => sum + duration(event), 0);
  const total = metrics.studyHours + metrics.workHours + personal;
  const studyPercent = total ? metrics.studyHours / total * 100 : 0;
  const workPercent = total ? metrics.workHours / total * 100 : 0;
  const personalPercent = total ? 100 - studyPercent - workPercent : 0;
  let html = pageHeading("Thống kê tuần", "Nhìn lại thời gian của bạn để lên kế hoạch tốt hơn.", weekControls());
  html += `<div class="stat-grid">${statCard("Tổng giờ học & thi", number(metrics.studyHours), "giờ", "book", "study", "Thời gian học tập theo lịch")}${statCard("Tổng giờ làm", number(metrics.workHours), "giờ", "briefcase", "work", workloadStatus(metrics.workHours).label)}${statCard("Deadline trong tuần", metrics.deadlineCount, "deadline", "deadline", "personal", `${state.deadlines.filter(deadline => inWeek(deadline.date) && deadline.completed).length} deadline đã hoàn thành`)}${statCard("Xung đột lịch", metrics.conflicts.length, "cảnh báo", "warning", "danger", metrics.conflicts.length ? "Cần điều chỉnh ca làm" : "Lịch tuần không bị trùng")}</div>`;
  html += `<div class="stats-layout"><section class="panel"><div class="panel-heading"><h2>Giờ học & giờ làm mỗi ngày</h2><span class="badge personal">${weekLabel()}</span></div><div class="chart-content"><div class="bar-chart" role="img" aria-label="${escapeHTML(days.map(day => `${day.label}: học ${number(day.study)} giờ, làm ${number(day.work)} giờ`).join("; "))}">${days.map(day => `<div class="bar-day"><div class="bar-pair"><div class="chart-bar" style="height:${day.study / maxHours * 180}px"><span>${number(day.study)}h</span></div><div class="chart-bar work" style="height:${day.work / maxHours * 180}px"><span>${number(day.work)}h</span></div></div><span>${day.label}</span></div>`).join("")}</div><div class="chart-legend"><span class="legend-item"><span class="legend-dot"></span>Học tập & thi</span><span class="legend-item"><span class="legend-dot work"></span>Làm thêm</span></div></div></section><section class="panel"><div class="panel-heading"><h2>Tỷ lệ thời gian tuần này</h2></div><div class="donut-area"><div class="donut" style="background:${total ? `conic-gradient(#6eb899 0% ${studyPercent}%, #f0bd7c ${studyPercent}% ${studyPercent + workPercent}%, #8aa6ee ${studyPercent + workPercent}% 100%)` : "#eef1f7"}" role="img" aria-label="Học tập ${number(studyPercent)}%, làm thêm ${number(workPercent)}%, cá nhân ${number(personalPercent)}%"><div class="donut-inner"><strong>${number(total)}h</strong><span>đã lên lịch</span></div></div><div class="ratio-row"><span class="legend-item"><span class="legend-dot"></span>Học tập & thi</span><strong>${number(studyPercent)}%</strong></div><div class="ratio-row"><span class="legend-item"><span class="legend-dot work"></span>Làm thêm</span><strong>${number(workPercent)}%</strong></div><div class="ratio-row"><span class="legend-item"><span class="legend-dot personal"></span>Cá nhân</span><strong>${number(personalPercent)}%</strong></div></div></section></div>`;
  return html + `<section class="panel stat-summary"><div><h3>${number(metrics.freeHours)} giờ chưa có lịch trong tuần</h3><p>Tính trong khung 07:00 – 23:00 mỗi ngày; các khoảng lịch trùng nhau được gộp lại.</p></div><button class="button secondary small" data-page="calendar">Lên kế hoạch cho tuần</button></section><div style="margin-top:23px">${balanceCard(metrics.workHours)}</div>`;
}
function renderProfilePage() {
  const profile = state.profile;
  return pageHeading("Hồ sơ sinh viên", "Một vài thông tin để Student Balance hiểu bạn hơn.") + `<div class="profile-layout"><section class="panel profile-summary"><span class="avatar avatar-large">${escapeHTML(initials(profile.name))}</span><h2>${escapeHTML(profile.name)}</h2><p>${escapeHTML(currentStudentId)}</p><hr><p class="profile-fact">${icon("book")}${escapeHTML(profile.major)}</p><p class="profile-fact">${icon("calendar")}${escapeHTML(profile.year)}</p><p class="profile-fact">${icon("briefcase")}Mục tiêu: ${number(profile.maxHours)} giờ/tuần</p><button class="button secondary full-width" data-action="logout" style="margin-top:20px">${icon("logout")}Đăng xuất</button></section><form id="profile-form" class="panel profile-form"><h2>Thông tin cá nhân</h2><div class="form-grid"><label class="field">Họ và tên<input name="name" value="${escapeHTML(profile.name)}" maxlength="80" autocomplete="name" required></label><label class="field">Email<input name="email" type="email" value="${escapeHTML(profile.email)}" maxlength="120" autocomplete="email" required></label><label class="field">Ngành học<input name="major" value="${escapeHTML(profile.major)}" maxlength="100" required></label><label class="field">Năm học<select name="year">${["Năm 1", "Năm 2", "Năm 3", "Năm 4", "Năm 5 trở lên"].map(year => `<option ${year === profile.year ? "selected" : ""}>${year}</option>`).join("")}</select></label><label class="field span-2">Số giờ làm tối đa mong muốn mỗi tuần<input type="number" name="maxHours" min="1" max="112" step="0.5" value="${profile.maxHours}" required><span class="field-hint">Đây là mục tiêu cá nhân. Hệ thống vẫn cảnh báo quá tải từ 28 giờ/tuần theo thiết lập của prototype.</span></label></div><p id="profile-error" class="form-error" role="alert" hidden></p><div class="profile-form-footer"><button class="button primary" type="submit">${icon("check")}Lưu thay đổi</button></div></form></div>`;
}

// 9. Native dialog hỗ trợ focus, Escape và thao tác bằng bàn phím.
function openDialog(content) {
  if (dialog.open) dialog.close();
  document.getElementById("dialog-content").innerHTML = content;
  dialog.showModal(); document.body.style.overflow = "hidden";
}
function closeDialog() { if (dialog.open) dialog.close(); document.body.style.overflow = ""; pendingConflict = null; }
function dialogHeader(title, subtitle = "") { return `<div class="dialog-header"><div><h2 id="dialog-title">${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ""}</div><button class="icon-button" data-action="close-dialog" aria-label="Đóng cửa sổ">${icon("close")}</button></div>`; }
function eventForm(existing = null, presetType = "") {
  const selectedType = existing?.type || presetType || "study";
  const values = existing || { date: todayString(), start: "08:00", end: selectedType === "deadline" ? "23:59" : "10:00" };
  openDialog(`<form id="event-form" class="dialog-form" data-id="${escapeHTML(existing?.id || "")}">${dialogHeader(existing ? "Chỉnh sửa lịch" : "Thêm lịch mới", "Ghi lại một kế hoạch cho ngày của bạn.")}<div class="dialog-body"><label class="field">Loại lịch<select name="type" id="event-type">${Object.entries(TYPES).filter(([type]) => !existing || (existing.type === "deadline" ? type === "deadline" : type !== "deadline")).map(([type, info]) => `<option value="${type}" ${type === selectedType ? "selected" : ""}>${info.label}</option>`).join("")}</select></label><label class="field">Tên lịch<input name="title" placeholder="Ví dụ: Lập trình Web hoặc Ca làm Coffee House" value="${escapeHTML(values.title || "")}" maxlength="100" required></label><div class="form-grid"><label class="field">Ngày<input name="date" type="date" value="${values.date}" min="2000-01-01" max="2100-12-31" required></label><label class="field" id="event-location-field">Địa điểm<input name="location" placeholder="Phòng học hoặc địa chỉ" value="${escapeHTML(values.location || "")}" maxlength="140"></label><label class="field" id="event-start-field">Giờ bắt đầu<input name="start" type="time" value="${values.start || "08:00"}" min="07:00" max="22:59" required></label><label class="field"><span id="event-end-label">Giờ kết thúc</span><input name="end" type="time" value="${values.end || "10:00"}" required></label></div><div id="work-fields"><div class="form-grid"><label class="field">Tên nơi làm việc<input name="workplace" value="${escapeHTML(values.workplace || "")}" placeholder="Ví dụ: Coffee House" maxlength="100"></label><label class="field">Mức lương/giờ (không bắt buộc)<input name="wage" type="number" min="0" max="10000000" step="1000" value="${escapeHTML(values.wage ?? "")}" placeholder="Ví dụ: 25000"></label></div></div><label class="field" id="deadline-subject-field">Môn học<input name="subject" value="${escapeHTML(values.subject || "")}" placeholder="Ví dụ: Khởi nghiệp sáng tạo" maxlength="100"></label><label class="field">Ghi chú<textarea name="notes" placeholder="Những điều bạn muốn ghi nhớ…" maxlength="600">${escapeHTML(values.notes || "")}</textarea></label><p class="field-hint" id="event-time-hint">Lịch trong khung 07:00 – 23:00, bắt đầu và kết thúc trong cùng ngày.</p><p id="event-error" class="form-error" role="alert" hidden></p></div><div class="dialog-footer"><button type="button" class="button secondary" data-action="close-dialog">Hủy</button><button class="button primary" type="submit">${icon("check")}Lưu lịch</button></div></form>`);
  updateEventForm(false);
}
function updateEventForm(changed = true) {
  const form = document.getElementById("event-form");
  if (!form) return;
  const type = form.elements.type.value;
  const isDeadline = type === "deadline";
  document.getElementById("work-fields").hidden = type !== "work";
  form.elements.workplace.required = type === "work";
  form.elements.workplace.disabled = type !== "work";
  form.elements.wage.disabled = type !== "work";
  document.getElementById("deadline-subject-field").hidden = !isDeadline;
  form.elements.subject.disabled = !isDeadline;
  document.getElementById("event-start-field").hidden = isDeadline;
  document.getElementById("event-location-field").hidden = isDeadline;
  form.elements.start.disabled = isDeadline;
  form.elements.location.disabled = isDeadline;
  document.getElementById("event-end-label").textContent = isDeadline ? "Giờ đến hạn" : "Giờ kết thúc";
  document.getElementById("event-time-hint").hidden = isDeadline;
  form.elements.end.min = isDeadline ? "00:00" : "07:01";
  form.elements.end.max = isDeadline ? "23:59" : "23:00";
  if (changed && isDeadline) form.elements.end.value = "23:59";
  if (changed && !isDeadline && form.elements.end.value > "23:00") form.elements.end.value = "10:00";
}
function formError(id, message) { const element = document.getElementById(id); element.textContent = message; element.hidden = false; element.scrollIntoView({ block: "nearest" }); }
function validTimes(date, start, end, errorId) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) { formError(errorId, "Vui lòng nhập đầy đủ ngày, giờ bắt đầu và giờ kết thúc."); return false; }
  if (minutes(start) >= minutes(end)) { formError(errorId, "Giờ kết thúc phải sau giờ bắt đầu trong cùng ngày."); return false; }
  if (start < "07:00" || end > "23:00") { formError(errorId, "Vui lòng chọn lịch trong khung giờ 07:00 – 23:00."); return false; }
  return true;
}
function submitEvent(form) {
  const data = new FormData(form);
  const title = data.get("title").trim();
  if (!title) return formError("event-error", "Vui lòng nhập tên lịch.");
  const id = form.dataset.id || uniqueId("event");
  const type = data.get("type");
  const date = data.get("date");
  if (type === "deadline") {
    const existing = state.deadlines.find(deadline => deadline.id === id);
    const deadline = { id, title, subject: (data.get("subject") || "").trim(), date, end: data.get("end"), notes: data.get("notes").trim(), completed: existing?.completed || false, createdAt: existing?.createdAt || Date.now() };
    const index = state.deadlines.findIndex(item => item.id === id);
    if (index >= 0) state.deadlines[index] = deadline; else state.deadlines.push(deadline);
    const saved = saveState(); closeDialog(); render();
    if (saved) toast(index >= 0 ? "Đã cập nhật deadline." : "Đã thêm deadline mới.");
    return;
  }
  if (!validTimes(date, data.get("start"), data.get("end"), "event-error")) return;
  if (type === "work" && !(data.get("workplace") || "").trim()) return formError("event-error", "Vui lòng nhập tên nơi làm việc.");
  const candidate = { id, type, title, date, start: data.get("start"), end: data.get("end"), location: (data.get("location") || "").trim(), notes: data.get("notes").trim(), workplace: type === "work" ? data.get("workplace").trim() : "", wage: type === "work" && data.get("wage") ? Number(data.get("wage")) : "" };
  const conflicts = getConflicts([...state.events.filter(event => event.id !== id), candidate]).filter(pair => pair.work.id === id || pair.school.id === id);
  if (conflicts.length) return showConflict(candidate, conflicts, Boolean(form.dataset.id));
  persistEvent(candidate);
}
function persistEvent(candidate, notify = true) {
  const index = state.events.findIndex(event => event.id === candidate.id);
  if (index >= 0) state.events[index] = candidate; else state.events.push(candidate);
  selectedWeek = getWeekStart(candidate.date);
  const saved = saveState(); closeDialog(); render();
  if (notify && saved) toast(index >= 0 ? "Đã cập nhật lịch. Giờ làm và cảnh báo đã được tính lại." : "Đã thêm lịch mới.");
}
function showConflict(candidate, conflicts, editing) {
  openDialog(`${dialogHeader("Phát hiện xung đột lịch")}<div class="dialog-body"><div class="warning-emblem">${icon("warning")}</div><p class="dialog-paragraph">${candidate.type === "work" ? "Ca làm này bị trùng với:" : "Lịch học hoặc thi này bị trùng với ca làm:"}</p>${conflicts.map(pair => `<div class="conflict-item"><strong>${escapeHTML(candidate.type === "work" ? pair.school.title : pair.work.title)}</strong><br>${shortDate(candidate.date)} · ${candidate.type === "work" ? pair.school.start : pair.work.start} – ${candidate.type === "work" ? pair.school.end : pair.work.end}</div>`).join("")}<p class="dialog-paragraph">Bạn có thể hủy ${editing ? "thay đổi" : "lịch mới"}, hoặc lưu lịch và tìm người hỗ trợ đổi ca. Thông tin ca sẽ được điền sẵn.</p></div><div class="dialog-footer"><button class="button secondary" data-action="close-dialog">Hủy ca</button><button class="button primary" data-action="conflict-swap">${icon("swap")}Tìm người đổi ca</button></div>`);
  pendingConflict = { candidate, conflicts };
}
function showEventDetail(id) {
  const event = state.events.find(item => item.id === id);
  if (!event) return;
  const conflicts = getConflicts().filter(pair => pair.work.id === id || pair.school.id === id);
  openDialog(`${dialogHeader("Chi tiết lịch")}<div class="dialog-body"><span class="badge ${event.type}">${icon(TYPES[event.type].icon)}${TYPES[event.type].label}</span><h3 class="detail-title">${escapeHTML(event.title)}</h3><div class="detail-row">${icon("calendar")}<span><strong>${dayName(event.date)}, ${shortDate(event.date)}</strong><small>Ngày diễn ra</small></span></div><div class="detail-row">${icon("clock")}<span><strong>${event.start} – ${event.end}</strong><small>${number(duration(event))} giờ</small></span></div><div class="detail-row">${icon("location")}<span><strong>${escapeHTML(event.location || "Chưa có địa điểm")}</strong><small>Địa điểm</small></span></div>${event.type === "work" ? `<div class="detail-row">${icon("briefcase")}<span><strong>${escapeHTML(event.workplace || event.title)}</strong>${event.wage !== "" ? `<small>${new Intl.NumberFormat("vi-VN").format(event.wage)} ₫/giờ · Ước tính ${new Intl.NumberFormat("vi-VN").format(event.wage * duration(event))} ₫/ca</small>` : ""}</span></div>` : ""}${event.notes ? `<p class="detail-notes">${escapeHTML(event.notes)}</p>` : ""}${conflicts.length ? `<div class="detail-conflict">${icon("warning")}Trùng với ${conflicts.map(pair => escapeHTML(pair.work.id === id ? pair.school.title : pair.work.title)).join(", ")}.<br><button class="text-button" data-action="swap-event" data-id="${escapeHTML(conflicts[0].work.id)}" style="margin-top:8px">Tìm người đổi ca</button></div>` : ""}</div><div class="dialog-footer"><button class="button danger" data-action="delete-event" data-id="${escapeHTML(id)}">${icon("trash")}Xóa lịch</button>${event.type === "work" && !conflicts.length ? `<button class="button secondary" data-action="swap-event" data-id="${escapeHTML(id)}">Đổi ca</button>` : ""}<button class="button primary" data-action="edit-event" data-id="${escapeHTML(id)}">${icon("edit")}Chỉnh sửa</button></div>`);
}
function showDeadlineDetail(id) {
  const deadline = state.deadlines.find(item => item.id === id);
  if (!deadline) return;
  const status = deadlineStatus(deadline);
  openDialog(`${dialogHeader("Chi tiết deadline")}<div class="dialog-body"><span class="badge ${status.color}">${status.label} · ${status.remaining}</span><h3 class="detail-title">${escapeHTML(deadline.title)}</h3><div class="detail-row">${icon("book")}${escapeHTML(deadline.subject || "Chưa có môn học")}</div><div class="detail-row">${icon("calendar")}${shortDate(deadline.date)} · ${deadline.end}</div>${deadline.notes ? `<p class="detail-notes">${escapeHTML(deadline.notes)}</p>` : ""}</div><div class="dialog-footer"><button class="button danger" data-action="delete-deadline" data-id="${escapeHTML(id)}">Xóa deadline</button><button class="button secondary" data-action="edit-deadline" data-id="${escapeHTML(id)}">Chỉnh sửa</button><button class="button primary" data-action="toggle-deadline" data-id="${escapeHTML(id)}">${deadline.completed ? "Chưa hoàn thành" : "Đánh dấu hoàn thành"}</button></div>`);
}
function confirmDelete(kind, id) {
  const collections = { event: state.events, deadline: state.deadlines, swap: state.swaps };
  const item = collections[kind].find(entry => entry.id === id);
  if (!item) return;
  openDialog(`${dialogHeader(kind === "swap" ? "Xóa bài đăng đổi ca?" : "Xóa lịch này?")}<div class="dialog-body"><p class="dialog-paragraph">Bạn muốn xóa <strong>${escapeHTML(item.title)}</strong>? ${kind === "event" && item.type === "work" ? "Tổng giờ làm sẽ được tính lại." : ""}</p></div><div class="dialog-footer"><button class="button secondary" data-action="close-dialog">Giữ lại</button><button class="button danger" data-action="confirm-delete" data-kind="${kind}" data-id="${escapeHTML(id)}">${icon("trash")}Xóa</button></div>`);
}
function deleteItem(kind, id) {
  if (kind === "event") state.events = state.events.filter(event => event.id !== id);
  if (kind === "deadline") state.deadlines = state.deadlines.filter(deadline => deadline.id !== id);
  if (kind === "swap") state.swaps = state.swaps.filter(swap => swap.id !== id || !isMySwap(swap));
  const saved = saveState(); closeDialog(); render();
  if (saved) toast(kind === "swap" ? "Đã xóa bài đăng đổi ca." : "Đã xóa lịch và cập nhật thống kê.");
}

// 10. Form đổi ca được điền sẵn từ lịch đã chọn.
function openSwapForm(event = null) {
  const values = event || { date: todayString(), start: "18:00", end: "22:00" };
  const conflicts = event ? getConflicts().filter(pair => pair.work.id === event.id) : [];
  openDialog(`<form id="swap-form" class="dialog-form" data-source-id="${escapeHTML(event?.id || "")}">${dialogHeader("Đăng ca cần đổi", event ? "Thông tin ca làm đã được điền sẵn cho bạn." : "Chia sẻ thông tin để tìm người hỗ trợ.")}<div class="dialog-body"><label class="field">Tên công việc<input name="title" value="${escapeHTML(values.title || "")}" placeholder="Ví dụ: Coffee House – Nhân viên phục vụ" maxlength="100" required></label><label class="field">Địa điểm<input name="location" value="${escapeHTML(values.location || "")}" placeholder="Địa chỉ nơi làm việc" maxlength="140" required></label><div class="form-grid"><label class="field span-2">Ngày<input name="date" type="date" value="${values.date}" min="${todayString()}" max="2100-12-31" required></label><label class="field">Giờ bắt đầu<input name="start" type="time" value="${values.start}" min="07:00" max="22:59" required></label><label class="field">Giờ kết thúc<input name="end" type="time" value="${values.end}" min="07:01" max="23:00" required></label></div><label class="field">Lý do đổi ca<input name="reason" value="${conflicts.length ? "Trùng lịch học hoặc lịch thi" : ""}" placeholder="Ví dụ: Cần ôn thi cuối kỳ" maxlength="160" required></label><label class="field">Ghi chú<textarea name="notes" maxlength="600" placeholder="Yêu cầu công việc hoặc thông tin thêm…">${escapeHTML(values.notes || "")}</textarea></label><p class="field-hint">Đăng bài tìm người thay ca chưa làm thay đổi lịch và tổng giờ làm của bạn.</p><p id="swap-error" class="form-error" role="alert" hidden></p></div><div class="dialog-footer"><button class="button secondary" type="button" data-action="close-dialog">Hủy</button><button class="button primary" type="submit">${icon("swap")}Đăng ca cần đổi</button></div></form>`);
}
function swapFromEvent(id) {
  const event = state.events.find(item => item.id === id && item.type === "work");
  if (!event) return;
  closeDialog(); navigate("swaps"); openSwapForm(event);
}
function chooseWorkToSwap() {
  const week = currentPage === "home" ? getWeekStart(todayString()) : selectedWeek;
  const events = state.events.filter(event => event.type === "work" && inWeek(event.date, week)).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  if (!events.length) return toast("Bạn chưa có ca làm trong tuần này.");
  openDialog(`${dialogHeader("Chọn ca cần đổi", "Chọn một ca để điền sẵn thông tin bài đăng.")}<div class="dialog-body">${events.map(event => `<button class="timeline-event" data-action="swap-event" data-id="${escapeHTML(event.id)}"><span class="timeline-marker work"></span><span class="timeline-body"><span class="timeline-time">${dayName(event.date)}, ${shortDate(event.date)} · ${event.start} – ${event.end}</span><strong>${escapeHTML(event.title)}</strong><span class="timeline-place">${icon("location")}${escapeHTML(event.location)}</span></span></button>`).join("")}</div>`);
}
function submitSwap(form) {
  const data = new FormData(form);
  if (!validTimes(data.get("date"), data.get("start"), data.get("end"), "swap-error")) return;
  if (["title", "location", "reason"].some(field => !data.get(field).trim())) return formError("swap-error", "Vui lòng nhập đầy đủ tên công việc, địa điểm và lý do đổi ca.");
  if (new Date(`${data.get("date")}T${data.get("end")}:00+07:00`).getTime() <= Date.now()) return formError("swap-error", "Ca làm đã kết thúc. Hãy chọn một ca sắp tới.");
  if (form.dataset.sourceId && state.swaps.some(swap => swap.sourceEventId === form.dataset.sourceId && isMySwap(swap))) return formError("swap-error", "Bạn đã đăng tìm người đổi ca cho lịch này. Bài đăng nằm trong mục Ca của tôi.");
  state.swaps.unshift({ id: uniqueId("swap"), title: data.get("title").trim(), location: data.get("location").trim(), date: data.get("date"), start: data.get("start"), end: data.get("end"), reason: data.get("reason").trim(), notes: data.get("notes").trim(), author: state.profile.name, authorId: currentStudentId, requestedBy: [], sourceEventId: form.dataset.sourceId || "" });
  const saved = saveState(); closeDialog(); swapFilter = "mine"; navigate("swaps");
  if (saved) toast("Đã đăng ca cần đổi trong cộng đồng mô phỏng.");
}

// 11. Thông báo tự sinh từ dữ liệu; lưu ID để nhớ các mục đã đọc.
function getNotifications() {
  const notifications = [];
  const week = getWeekStart(todayString());
  const metrics = getWeekMetrics(week);
  metrics.conflicts.forEach(pair => notifications.push({ id: `conflict-${pair.work.id}-${pair.school.id}-${pair.work.date}-${pair.work.start}-${pair.school.start}`, icon: "warning", text: `${pair.work.title} trùng với ${pair.school.title}.`, detail: `${dayName(pair.work.date)} · ${pair.school.start} – ${pair.school.end}`, page: "calendar", eventId: pair.work.id }));
  upcomingDeadlines().forEach(deadline => {
    const status = deadlineStatus(deadline);
    if (status.color === "danger" || status.color === "warning") notifications.push({ id: `deadline-${deadline.id}-${deadline.date}-${status.label}`, icon: "deadline", text: `${deadline.title}: ${status.remaining.toLowerCase()}.`, detail: `${shortDate(deadline.date)} · ${deadline.end}`, page: "deadlines" });
  });
  notifications.push({ id: `hours-${week}-${metrics.workHours}`, icon: "clock", text: `Bạn có ${number(metrics.workHours)} giờ làm trong tuần này.`, detail: workloadStatus(metrics.workHours).label, page: "stats" });
  if (metrics.workHours > state.profile.maxHours) notifications.push({ id: `goal-${week}-${metrics.workHours}-${state.profile.maxHours}`, icon: "briefcase", text: `Giờ làm đã vượt mục tiêu cá nhân ${number(state.profile.maxHours)} giờ/tuần.`, detail: "Bạn có thể cân nhắc điều chỉnh ca làm.", page: "calendar" });
  state.swaps.filter(swap => swap.requestedBy.includes(currentStudentId)).forEach(swap => notifications.push({ id: `request-${swap.id}-${currentStudentId}`, icon: "swap", text: `Bạn đã gửi yêu cầu nhận ca ${swap.title}.`, detail: "Yêu cầu mô phỏng đã được lưu trên trình duyệt.", page: "swaps" }));
  return notifications;
}
function updateNotificationBadge() {
  const count = getNotifications().filter(item => !state.readNotifications.includes(item.id)).length;
  const badge = document.getElementById("notification-badge");
  badge.textContent = count > 9 ? "9+" : count; badge.hidden = count === 0;
  document.getElementById("notification-button").setAttribute("aria-label", `Thông báo, ${count} chưa đọc`);
}
function renderNotifications() {
  const notifications = getNotifications();
  document.getElementById("notification-panel").innerHTML = `<div class="panel-heading"><h2>Thông báo</h2><button class="text-button" data-action="read-notifications">Đọc tất cả</button></div><div class="notification-list">${notifications.map(item => `<button class="notification-item ${state.readNotifications.includes(item.id) ? "" : "unread"}" data-notification="${escapeHTML(item.id)}">${icon(item.icon)}<span>${escapeHTML(item.text)}<small>${escapeHTML(item.detail)}</small></span></button>`).join("")}</div>`;
}
function hideNotifications() { document.getElementById("notification-panel").hidden = true; document.getElementById("notification-button").setAttribute("aria-expanded", "false"); }
function toast(message, error = false) {
  clearTimeout(toastTimer);
  const region = document.getElementById("toast-region");
  region.innerHTML = `<div class="toast ${error ? "error" : ""}">${icon(error ? "warning" : "check")}<span>${escapeHTML(message)}</span></div>`;
  toastTimer = setTimeout(() => { region.innerHTML = ""; }, error ? 6500 : 4000);
}

// 12. Event delegation giúp các nút vẫn hoạt động sau mỗi lần render.
document.addEventListener("click", event => {
  const button = event.target.closest("button, a[data-page]");
  if (button && currentStudentId) {
    const { page, action, id } = button.dataset;
    if (page) { event.preventDefault(); navigate(page); return; }
    if (button.dataset.filter) { calendarFilter = button.dataset.filter; render(); return; }
    if (button.dataset.deadlineFilter) { deadlineFilter = button.dataset.deadlineFilter; render(); return; }
    if (button.dataset.swapFilter) { swapFilter = button.dataset.swapFilter; render(); return; }
    if (button.dataset.notification) {
      const item = getNotifications().find(item => item.id === button.dataset.notification);
      if (item) {
        if (!state.readNotifications.includes(item.id)) state.readNotifications.push(item.id);
        saveState();
        if (item.page === "calendar" || item.page === "stats") selectedWeek = getWeekStart(todayString());
        navigate(item.page);
        if (item.eventId) showEventDetail(item.eventId);
      }
      return;
    }
    switch (action) {
      case "add-event": eventForm(null, button.dataset.type); break;
      case "close-dialog": closeDialog(); break;
      case "event-detail": showEventDetail(id); break;
      case "deadline-detail": showDeadlineDetail(id); break;
      case "edit-event": eventForm(state.events.find(item => item.id === id)); break;
      case "edit-deadline": { const deadline = state.deadlines.find(item => item.id === id); if (deadline) eventForm({ ...deadline, type: "deadline" }); break; }
      case "delete-event": confirmDelete("event", id); break;
      case "delete-deadline": confirmDelete("deadline", id); break;
      case "delete-swap": confirmDelete("swap", id); break;
      case "confirm-delete": deleteItem(button.dataset.kind, id); break;
      case "toggle-deadline": { const deadline = state.deadlines.find(item => item.id === id); if (deadline) { closeDialog(); setDeadlineCompleted(id, !deadline.completed); } break; }
      case "prev-week": selectedWeek = addDays(selectedWeek, -7); render(); break;
      case "next-week": selectedWeek = addDays(selectedWeek, 7); render(); break;
      case "this-week": selectedWeek = getWeekStart(todayString()); render(); break;
      case "view-work": calendarFilter = "work"; if (currentPage === "home") selectedWeek = getWeekStart(todayString()); navigate("calendar"); break;
      case "choose-swap": chooseWorkToSwap(); break;
      case "swap-event": swapFromEvent(id); break;
      case "add-swap": openSwapForm(); break;
      case "accept-swap": acceptSwap(id); break;
      case "conflict-swap": {
        if (!pendingConflict) break;
        const candidate = pendingConflict.candidate;
        const work = candidate.type === "work" ? candidate : pendingConflict.conflicts[0].work;
        persistEvent(candidate, false); navigate("swaps"); openSwapForm(work); break;
      }
      case "read-notifications": state.readNotifications = [...new Set([...state.readNotifications, ...getNotifications().map(item => item.id)])]; saveState(); renderNotifications(); updateNotificationBadge(); break;
      case "logout": logout(); break;
    }
  }
  if (!event.target.closest(".notification-wrap")) hideNotifications();
});
document.addEventListener("change", event => {
  if (!currentStudentId) return;
  if (event.target.id === "event-type") updateEventForm();
  if (event.target.dataset.deadlineCheck) setDeadlineCompleted(event.target.dataset.deadlineCheck, event.target.checked);
});
document.addEventListener("submit", event => {
  if (!currentStudentId) return;
  if (event.target.id === "event-form") { event.preventDefault(); submitEvent(event.target); }
  if (event.target.id === "swap-form") { event.preventDefault(); submitSwap(event.target); }
  if (event.target.id === "profile-form") {
    event.preventDefault();
    const data = new FormData(event.target);
    if (["name", "major", "email"].some(key => !data.get(key).trim())) return formError("profile-error", "Vui lòng nhập đầy đủ thông tin, không chỉ khoảng trắng.");
    const maxHours = Number(data.get("maxHours"));
    if (!Number.isFinite(maxHours) || maxHours < 1 || maxHours > 112) return formError("profile-error", "Mục tiêu giờ làm phải từ 1 đến 112 giờ/tuần.");
    state.profile = { name: data.get("name").trim(), email: data.get("email").trim(), major: data.get("major").trim(), year: data.get("year"), maxHours };
    state.swaps.filter(isMySwap).forEach(swap => { swap.author = state.profile.name; });
    const saved = saveState(); render(); if (saved) toast("Đã lưu thông tin cá nhân của bạn.");
  }
});
document.getElementById("login-form").addEventListener("submit", event => {
  event.preventDefault();
  const data = new FormData(event.target);
  const studentId = data.get("studentId").trim();
  if (!studentId || !data.get("password").trim()) return toast("Vui lòng nhập mã sinh viên và mật khẩu.", true);
  login(studentId, data.get("remember") === "on");
});
document.getElementById("demo-login").addEventListener("click", () => login("SV20260001", true));
document.getElementById("logout-button").addEventListener("click", logout);
document.getElementById("toggle-password").addEventListener("click", () => {
  const password = document.getElementById("login-password");
  const show = password.type === "password";
  password.type = show ? "text" : "password";
  document.getElementById("toggle-password").setAttribute("aria-label", show ? "Ẩn mật khẩu" : "Hiện mật khẩu");
});
document.getElementById("notification-button").addEventListener("click", () => {
  const panel = document.getElementById("notification-panel");
  panel.hidden = !panel.hidden;
  document.getElementById("notification-button").setAttribute("aria-expanded", String(!panel.hidden));
  if (!panel.hidden) renderNotifications();
});
dialog.addEventListener("click", event => {
  if (event.target === dialog) {
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeDialog();
  }
});
dialog.addEventListener("close", () => { if (!dialog.open) document.body.style.overflow = ""; });
dialog.addEventListener("cancel", () => { pendingConflict = null; });
document.addEventListener("keydown", event => { if (event.key === "Escape") hideNotifications(); });
window.addEventListener("hashchange", () => { if (currentStudentId) navigate(window.location.hash.slice(1)); });
window.addEventListener("storage", event => { if (event.key === DATA_KEY) { state = loadState(); if (currentStudentId) render(); } });
document.addEventListener("visibilitychange", () => { if (!document.hidden && currentStudentId) render(); });
setInterval(() => { if (!document.hidden && currentStudentId && !dialog.open) render(); }, 60000);

// Khôi phục phiên khi mở lại trang. Nếu không ghi nhớ, chỉ giữ trong tab hiện tại.
try {
  const session = JSON.parse(localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY) || "null");
  if (session?.studentId) { currentStudentId = session.studentId; showApp(); }
} catch (error) { console.warn("Không khôi phục được phiên đăng nhập.", error); }
