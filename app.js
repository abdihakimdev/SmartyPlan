const SUPABASE_URL = "https://nstrhxhxoinaakcswzzc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_A1x5m7pgLd0r8VlM1tCSTQ_zAR2hiFb";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

let currentUser = null;
let db = {
    courses: [],
    lessons: [],
    checks: {}
};
let currentPage = "dashboard";

const $ = id => document.getElementById(id);

function localDate(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}
const today = () => localDate();

function esc(v) {
    return String(v ?? "").replace(/[&<>"']/g, m => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
        }[m]));
        }
        function course(id) { return db.courses.find(c => c.id === id); }
        function lessons(id) { return db.lessons.filter(l => l.course_id === id); }
        function completed(id) { return lessons(id).filter(l => l.done).length; }
        function pct(id) {
        const c = course(id);
        return c ? Math.min(100, Math.round(completed(id) / c.total_lessons * 100)): 0;
        }
        function totalLessons() { return db.courses.reduce((a, c) => a + c.total_lessons, 0); }
        function completedAll() { return db.lessons.filter(l => l.done).length; }
        function totalMinutes() { return db.lessons.reduce((a, l) => a + (Number(l.minutes) || 0), 0); }
        function formatMin(m) {
        m = Number(m) || 0;
        return m < 60 ? `${m}m`: `${Math.floor(m/60)}h ${m%60}m`;
        }
        function streak() {
        const dates = new Set(db.lessons.filter(l => l.done).map(l => l.lesson_date));
        let n = 0;
        const d = new Date();
        while (dates.has(localDate(d))) {
            n++;
            d.setDate(d.getDate() - 1);
        }
        return n;
        }

        function toast(message, type = "success") {
        const old = document.querySelector(".toast");
        if (old) old.remove();
        const el = document.createElement("div");
        el.className = `toast ${type}`;
        el.innerHTML = `<i class="ph-fill ${type === "error" ? "ph-warning-circle": "ph-check-circle"}"></i><span>${esc(message)}</span>`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 3600);
        }

        function setAuthMessage(message = "", type = "") {
        const el = $("authMessage");
        el.textContent = message;
        el.className = `auth-message ${type}`.trim();
        }

        function setLoading(button, loading, text) {
        if (!button) return;
        if (loading) {
            button.dataset.originalText = button.innerHTML;
            button.disabled = true;
            button.innerHTML = `<i class="ph-bold ph-spinner ph-spin"></i> ${text}`;
        } else {
            button.disabled = false;
            button.innerHTML = button.dataset.originalText || text;
        }
        }

        function showAuth() {
        $("authScreen").classList.remove("hidden");
        $("appShell").classList.add("hidden");
        $("loginPassword").value = "";
        $("loginPassword").type = "password";
        syncEyes();
        setAuthMessage("");
        }

        function showApp() {
        $("authScreen").classList.add("hidden");
        $("appShell").classList.remove("hidden");
        $("userEmail").textContent = currentUser?.email || "";
        }

        async function loadData() {
        if (!currentUser) return;

        const [coursesRes,
            lessonsRes,
            checksRes] = await Promise.all([
                supabase.from("courses").select("*").eq("user_id", currentUser.id).order("created_at", {
                    ascending: true
                }),
                supabase.from("lessons").select("*").eq("user_id", currentUser.id).order("lesson_date", {
                    ascending: false
                }).order("day", {
                    ascending: false
                }),
                supabase.from("daily_checks").select("*").eq("user_id", currentUser.id)
            ]);

        const error = coursesRes.error || lessonsRes.error || checksRes.error;
        if (error) {
            console.error(error);
            toast(`Database connection error: ${error.message}`, "error");
            return;
        }

        db.courses = coursesRes.data || [];
        db.lessons = lessonsRes.data || [];
        db.checks = Object.fromEntries((checksRes.data || []).map(x => [x.check_date, x]));
        renderAll();
        }

        async function signIn(email, password) {
        const {
            data,
            error
        } = await supabase.auth.signInWithPassword({
                email, password
            });
        if (error) throw error;
        currentUser = data.user;
        showApp();
        await loadData();
        }

        async function signOut() {
        const {
            error
        } = await supabase.auth.signOut();
        if (error) {
            toast(error.message, "error");
            return;
        }
        currentUser = null;
        db = {
            courses: [],
            lessons: [],
            checks: {}
        };
        showAuth();
        }

        // ---------- Login (email + password, with attempt limiter) ----------
        const LOCK_KEY = "smartyplan_login_lock";
        function getLock() {
        try {
            return JSON.parse(localStorage.getItem(LOCK_KEY)) || {
                fails: 0,
                until: 0
            };
        }
        catch {
            return {
                fails: 0,
                until: 0
            };
        }
        }
        function setLock(v) { try {
            localStorage.setItem(LOCK_KEY, JSON.stringify(v));
        } catch {} }

        $("loginForm").onsubmit = async e => {
        e.preventDefault();
        setAuthMessage("");
        const email = $("loginEmail").value.trim().toLowerCase();
        const password = $("loginPassword").value;
        if (!email || !password) {
            setAuthMessage("Enter your email and password.", "error");
            return;
        }
        const lock = getLock();
        if (lock.until > Date.now()) {
            const s = Math.ceil((lock.until - Date.now()) / 1000);
            setAuthMessage(`Too many failed attempts. Try again in ${s}s.`, "error");
            return;
        }
        const button = e.submitter;
        setLoading(button, true, "Signing in...");
        try {
            await signIn(email, password);
            setLock({
                fails: 0, until: 0
            });
        } catch (error) {
            const fails = (lock.fails || 0) + 1;
            // after 5 failures: 30s lockout, doubling each further failure (max 15 min)
            const wait = fails >= 5 ? Math.min(30 * 2 ** (fails - 5), 900) * 1000: 0;
            setLock({
                fails, until: wait ? Date.now() + wait: 0
            });
            const msg = /invalid login/i.test(error.message || "")
            ? "Incorrect email or password.": (error.message || "Sign in failed.");
            setAuthMessage(wait ? `${msg} Locked for ${Math.round(wait / 1000)}s.`: msg, "error");
        } finally {
            setLoading(button, false, "Sign in");
        }
        };

        // ---------- Show / hide password (eye icon) ----------
        function syncEyes() {
        document.querySelectorAll(".pw-eye").forEach(btn => {
            const input = $(btn.dataset.eye);
            const shown = input && input.type === "text";
            btn.innerHTML = `<i class="ph-bold ${shown ? "ph-eye-slash": "ph-eye"}"></i>`;
            btn.setAttribute("aria-label", shown ? "Hide password": "Show password");
        });
        }
        document.querySelectorAll(".pw-eye").forEach(btn => {
        btn.addEventListener("click", () => {
            const input = $(btn.dataset.eye);
            input.type = input.type === "password" ? "text": "password";
            syncEyes();
            input.focus();
        });
        });

        $("logoutBtn").onclick = signOut;

        document.querySelectorAll(".nav-item").forEach(btn =>
        btn.addEventListener("click", () => go(btn.dataset.page))
        );
        document.querySelectorAll("[data-go]").forEach(btn =>
        btn.addEventListener("click", () => go(btn.dataset.go))
        );

        function go(page) {
        currentPage = page;
        document.querySelectorAll(".page").forEach(x => x.classList.remove("active"));
        const target = $("page-" + page);
        if (target) target.classList.add("active");
        document.querySelectorAll(".nav-item").forEach(x =>
            x.classList.toggle("active", x.dataset.page === page)
        );
        const names = {
            dashboard: "Dashboard",
            courses: "Courses",
            today: "Today's Lessons",
            notes: "Lesson Notes",
            progress: "Daily Progress",
            streak: "Learning Streak",
            time: "Time Tracking",
            goals: "Learning Goals",
            check: "Daily Check",
            settings: "Settings"
        };
        $("pageTitle").textContent = names[page] || "Dashboard";
        $("pageSubtitle").textContent = page === "dashboard" ? "Your learning overview": page === "settings" ? "Account, security & data": "Manage your learning";
        closeMenu();
        renderAll();
        }

        $("menuBtn").onclick = () => {
        $("sidebar").classList.add("open");
        $("overlay").classList.add("show");
        };
        $("overlay").onclick = closeMenu;
        function closeMenu() {
        $("sidebar").classList.remove("open");
        $("overlay").classList.remove("show");
        }

        function setDarkIcon() {
        $("darkBtn").innerHTML = document.body.classList.contains("dark")
        ? '<i class="ph-bold ph-sun"></i>': '<i class="ph-bold ph-moon"></i>';
        }
        $("darkBtn").onclick = () => {
        document.body.classList.toggle("dark");
        localStorage.setItem("smaryplan_dark", document.body.classList.contains("dark"));
        setDarkIcon();
        };
        if (localStorage.getItem("smaryplan_dark") === "true") {
        document.body.classList.add("dark");
        setDarkIcon();
        }

        $("courseForm").onsubmit = async e => {
        e.preventDefault();
        if (!currentUser) return showAuth();

        const button = e.submitter;
        const payload = {
            user_id: currentUser.id,
            name: $("courseName").value.trim(),
            type: $("courseType").value,
            skill: $("skillName").value.trim(),
            total_lessons: Number($("totalLessons").value),
            start_date: $("startDate").value || null,
            target_date: $("targetDate").value || null,
            goal: $("courseGoal").value.trim() || null
        };

        setLoading(button, true, "Saving...");
        const {
            error
        } = await supabase.from("courses").insert(payload);
        setLoading(button, false, "Create Course");
        if (error) {
            toast(error.message, "error");
            return;
        }
        e.target.reset();
        await loadData();
        toast("Course created successfully.");
        };

        $("lessonCourse").onchange = populateLessonNumbers;
        function populateLessonNumbers() {
        const id = $("lessonCourse").value;
        const c = course(id);
        $("lessonNumber").innerHTML = "";
        if (!c) return;
        for (let i = 1; i <= c.total_lessons; i++) {
            const used = db.lessons.some(l => l.course_id === id && l.day === i);
            $("lessonNumber").insertAdjacentHTML(
                "beforeend",
                `<option value="${i}" ${used ? "disabled": ""}>Day ${i}${used ? " — recorded": " — available"}</option>`
            );
        }
        }

        $("lessonForm").onsubmit = async e => {
        e.preventDefault();
        if (!currentUser) return showAuth();

        const courseId = $("lessonCourse").value;
        const day = Number($("lessonNumber").value);
        if (!courseId || !day) {
            toast("Select a course and lesson first.", "error");
            return;
        }

        if (db.lessons.some(l => l.course_id === courseId && l.day === day)) {
            toast("This lesson is already recorded.", "error");
            return;
        }

        const payload = {
            user_id: currentUser.id,
            course_id: courseId,
            day,
            title: $("lessonTitle").value.trim(),
            topic: $("lessonTopic").value.trim() || null,
            lesson_date: $("lessonDate").value || today(),
            minutes: Number($("lessonMinutes").value) || 0,
            notes: $("lessonNotes").value.trim() || null,
            practice: $("practiceDone").checked,
            quiz: $("quizDone").checked,
            done: $("lessonDone").checked
        };

        const button = e.submitter;
        setLoading(button, true, "Saving...");
        const {
            error
        } = await supabase.from("lessons").insert(payload);
        setLoading(button, false, "Save Today's Lesson");
        if (error) {
            toast(error.message, "error");
            return;
        }

        e.target.reset();
        $("lessonDate").value = today();
        await loadData();
        populateLessonNumbers();
        toast("Lesson saved.");
        };

        $("saveCheck").onclick = async () => {
        if (!currentUser) return showAuth();
        const payload = {
            user_id: currentUser.id,
            check_date: today(),
            study: $("checkStudy").checked,
            practice: $("checkPractice").checked,
            review: $("checkReview").checked,
            notes: $("checkNotes").checked
        };
        const button = $("saveCheck");
        setLoading(button, true, "Saving...");
        const {
            error
        } = await supabase.from("daily_checks").upsert(payload, {
                onConflict: "user_id,check_date"
            });
        setLoading(button, false, "Save Daily Check");
        if (error) {
            toast(error.message, "error");
            return;
        }
        await loadData();
        toast("Daily check saved.");
        };

        function renderDashboard() {
        $("dashCourses").textContent = db.courses.length;
        $("dashLessons").textContent = `${completedAll()}/${totalLessons()}`;
        $("dashProgress").textContent = `${totalLessons() ? Math.round(completedAll()/totalLessons()*100): 0}%`;
        $("dashStreak").textContent = `${streak()} days`;
        $("dashTime").textContent = formatMin(totalMinutes());

        const goalTotal = db.courses.filter(c => c.goal).length;
        const goalDone = db.courses.filter(c => c.goal && pct(c.id) >= 100).length;
        $("dashGoals").textContent = `${goalDone}/${goalTotal}`;

        const ts = db.lessons.filter(l => l.lesson_date === today());
        $("dashToday").innerHTML = ts.length ? ts.map(lessonHTML).join(""): '<div class="empty">No lesson recorded for today.</div>';

        const ch = db.checks[today()] || {};
        $("dashCheck").innerHTML = `
        <p>${ch.study ? '<i class="ph-fill ph-check-circle on"></i>': '<i class="ph ph-circle off"></i>'} Studied today</p>
        <p>${ch.practice ? '<i class="ph-fill ph-check-circle on"></i>': '<i class="ph ph-circle off"></i>'} Practiced</p>
        <p>${ch.review ? '<i class="ph-fill ph-check-circle on"></i>': '<i class="ph ph-circle off"></i>'} Reviewed previous lesson</p>
        <p>${ch.notes ? '<i class="ph-fill ph-check-circle on"></i>': '<i class="ph ph-circle off"></i>'} Wrote notes</p>`;

        $("dashCoursesList").innerHTML = db.courses.length
        ? db.courses.map(courseHTML).join(""): '<div class="empty">Create your first course.</div>';
        }

        function courseHTML(c) {
        const p = pct(c.id),
        n = completed(c.id);
        return `<div class="course">
        <h4>${esc(c.name)}</h4>
        <small>${esc(c.type || "Other")} · ${esc(c.skill || "—")}</small>
        <div class="progress-wrap"><div class="progress-bar"><span style="width:${p}%"></span></div><span class="progress-text">${p}%</span></div>
        <small>${n}/${c.total_lessons} lessons completed</small>
        ${c.goal ? `<p><small>Goal: ${esc(c.goal)}</small></p>`: ""}
        <div class="course-actions">
        <button class="btn primary small" onclick="openCourse('${c.id}')"><i class="ph-bold ph-arrow-square-out"></i> Open</button>
        <button class="btn secondary small danger" onclick="deleteCourse('${c.id}')"><i class="ph-bold ph-trash"></i> Delete</button>
        </div>
        </div>`;
        }

        function lessonHTML(l) {
        return `<div class="lesson">
        <div class="day">Day ${l.day}</div>
        <div><h4>${l.done ? '<i class="ph-fill ph-check-circle on"></i>': '<i class="ph ph-circle off"></i>'} ${esc(l.title)}</h4>
        <p>${esc(l.topic || "No topic")} · ${l.lesson_date} · ${formatMin(l.minutes)} ${l.practice ? "· Practice ✓": ""} ${l.quiz ? "· Quiz ✓": ""}</p></div>
        <button class="btn secondary small danger" onclick="deleteLesson('${l.id}')"><i class="ph-bold ph-trash"></i> Delete</button>
        </div>`;
        }

        window.openCourse = function(id) {
        $("lessonCourse").value = id;
        populateLessonNumbers();
        go("today");
        };

        window.deleteCourse = async function(id) {
        if (!confirm("Delete this course and all its lessons?")) return;
        const {
            error
        } = await supabase.from("courses").delete().eq("id", id).eq("user_id", currentUser.id);
        if (error) {
            toast(error.message, "error");
            return;
        }
        await loadData();
        toast("Course deleted.");
        };

        window.deleteLesson = async function(id) {
        if (!confirm("Delete this lesson?")) return;
        const {
            error
        } = await supabase.from("lessons").delete().eq("id", id).eq("user_id", currentUser.id);
        if (error) {
            toast(error.message, "error");
            return;
        }
        await loadData();
        populateLessonNumbers();
        toast("Lesson deleted.");
        };

        function renderCourses() {
        $("courseList").innerHTML = db.courses.length
        ? db.courses.map(courseHTML).join(""): '<div class="empty">No courses yet.</div>';
        }

        function renderToday() {
        const selected = $("lessonCourse").value;
        $("lessonCourse").innerHTML = db.courses.length
        ? '<option value="">Select course</option>' + db.courses.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join(""): '<option value="">Create a course first</option>';
        if (selected && course(selected)) $("lessonCourse").value = selected;
        if (!$("lessonDate").value) $("lessonDate").value = today();
        populateLessonNumbers();

        const list = [...db.lessons].sort((a, b) => b.lesson_date.localeCompare(a.lesson_date) || b.day - a.day);
        $("lessonHistory").innerHTML = list.length ? list.map(lessonHTML).join(""): '<div class="empty">No lessons yet.</div>';
        }

        function renderNotes() {
        const list = db.lessons.filter(l => l.notes).sort((a, b) => b.lesson_date.localeCompare(a.lesson_date));
        $("notesList").innerHTML = list.length ? list.map(l => {
            const c = course(l.course_id);
            return `<div class="note"><h4>${esc(c?.name || "Course")} — Day ${l.day}: ${esc(l.title)}</h4><p>${esc(l.notes)}</p><small>${l.lesson_date}</small></div>`;
        }).join(""): '<div class="empty">No lesson notes yet.</div>';
        }

        function renderProgress() {
        const groups = {};
        db.lessons.forEach(l => (groups[l.lesson_date] ||= []).push(l));
        const dates = Object.keys(groups).sort().reverse();
        $("dailyProgressList").innerHTML = dates.length ? dates.map(d => {
            const group = groups[d];
            return `<div class="note"><h4>${d}</h4><p>${group.filter(x => x.done).length} lessons completed · ${formatMin(group.reduce((a, x)=>a+(Number(x.minutes) || 0), 0))} studied</p></div>`;
        }).join(""): '<div class="empty">No daily progress yet.</div>';
        }

        function renderStreak() {
        $("bigStreak").textContent = streak();
        const dates = [...new Set(db.lessons.map(l => l.lesson_date))].sort().reverse();
        $("activityList").innerHTML = dates.length ? dates.slice(0, 30).map(d => {
            const items = db.lessons.filter(l => l.lesson_date === d);
            return `<div class="note"><strong>${d}</strong><p>${items.length} lesson(s) · ${formatMin(items.reduce((a, x)=>a+(Number(x.minutes) || 0), 0))}</p></div>`;
        }).join(""): '<div class="empty">No activity yet.</div>';
        }

        function renderTime() {
        const t = today();
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - 6);
        const start = localDate(weekStart);
        $("timeToday").textContent = formatMin(db.lessons.filter(l => l.lesson_date === t).reduce((a, l)=>a+(Number(l.minutes) || 0), 0));
        $("timeWeek").textContent = formatMin(db.lessons.filter(l => l.lesson_date >= start && l.lesson_date <= t).reduce((a, l)=>a+(Number(l.minutes) || 0), 0));
        $("timeTotal").textContent = formatMin(totalMinutes());
        $("timeList").innerHTML = db.lessons.length ? [...db.lessons].sort((a, b) => b.lesson_date.localeCompare(a.lesson_date)).map(l =>
            `<div class="note"><strong>${l.lesson_date} — Day ${l.day}</strong><p>${esc(course(l.course_id)?.name || "Course")} · ${formatMin(l.minutes)}</p></div>`
        ).join(""): '<div class="empty">No time records yet.</div>';
        }

        function renderGoals() {
        $("goalsList").innerHTML = db.courses.length ? db.courses.map(c =>
            `<div class="note"><h4>${esc(c.name)}</h4><p>${esc(c.goal || "No goal added.")}</p>
            <div class="progress-wrap"><div class="progress-bar"><span style="width:${pct(c.id)}%"></span></div><span class="progress-text">${pct(c.id)}%</span></div></div>`
        ).join(""): '<div class="empty">No learning goals yet.</div>';
        }

        function renderCheck() {
        $("checkDate").textContent = `Daily Check — ${today()}`;
        const c = db.checks[today()] || {};
        $("checkStudy").checked = !!c.study;
        $("checkPractice").checked = !!c.practice;
        $("checkReview").checked = !!c.review;
        $("checkNotes").checked = !!c.notes;
        }

        function renderAll() {
        renderDashboard();
        renderCourses();
        renderToday();
        renderNotes();
        renderProgress();
        renderStreak();
        renderTime();
        renderGoals();
        renderCheck();
        renderSettings();
        }

        // ============================================================
        // SETTINGS: account, password, email, sessions, data
        // ============================================================
        function fmtDateTime(v) {
        if (!v) return "—";
        const d = new Date(v);
        return isNaN(d) ? "—": d.toLocaleString(undefined, {
            dateStyle: "medium", timeStyle: "short"
        });
        }

        function renderSettings() {
        if (!currentUser) return;
        $("setEmail").textContent = currentUser.email || "—";
        $("setCreated").textContent = fmtDateTime(currentUser.created_at);
        $("setLastSign").textContent = fmtDateTime(currentUser.last_sign_in_at);
        }

        function setFormMsg(id, text = "", type = "") {
        const el = $(id);
        el.textContent = text;
        el.className = `form-msg ${type}`.trim();
        }

        // password strength: 0-4
        function pwScore(p) {
        let s = 0;
        if (p.length >= 8) s++;
        if (p.length >= 12) s++;
        if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
        if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
        if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) s = Math.min(s, 1);
        return Math.min(s, 4);
        }
        $("newPassword").addEventListener("input", () => {
        const p = $("newPassword").value;
        const s = p ? Math.max(1, pwScore(p)): 0;
        const labels = ["Password strength",
            "Weak",
            "Fair",
            "Good",
            "Strong"];
        const wrap = $("pwStrength");
        wrap.dataset.level = s;
        wrap.querySelector("span").style.width = (s * 25) + "%";
        $("pwStrengthText").textContent = labels[s];
        });

        // Verify the current password by re-authenticating, then update.
        async function verifyPassword(password) {
        const {
            error
        } = await supabase.auth.signInWithPassword({
                email: currentUser.email, password
            });
        return !error;
        }

        $("passwordForm").onsubmit = async e => {
        e.preventDefault();
        setFormMsg("passwordMsg");
        const cur = $("curPassword").value;
        const next = $("newPassword").value;
        const conf = $("confirmPassword").value;

        if (!cur || !next || !conf) return setFormMsg("passwordMsg", "Fill in all three fields.", "error");
        if (next.length < 8) return setFormMsg("passwordMsg", "New password must be at least 8 characters.", "error");
        if (!/[A-Za-z]/.test(next) || !/\d/.test(next)) return setFormMsg("passwordMsg", "Use both letters and numbers.", "error");
        if (next !== conf) return setFormMsg("passwordMsg", "New passwords do not match.", "error");
        if (next === cur) return setFormMsg("passwordMsg", "New password must be different from the current one.", "error");

        const button = e.submitter;
        setLoading(button, true, "Updating...");
        try {
            if (!(await verifyPassword(cur))) {
                setFormMsg("passwordMsg", "Current password is incorrect.", "error");
                return;
            }
            const {
                error
            } = await supabase.auth.updateUser({
                    password: next
                });
            if (error) {
                setFormMsg("passwordMsg", error.message, "error");
                return;
            }
            // end every other session so a stolen old session stops working
            await supabase.auth.signOut({
                scope: "others"
            });
            e.target.reset();
            $("pwStrength").dataset.level = 0;
            $("pwStrength").querySelector("span").style.width = "0%";
            $("pwStrengthText").textContent = "Password strength";
            document.querySelectorAll("#passwordForm .pw-field input").forEach(i => (i.type = "password"));
            syncEyes();
            toast("Password updated. Other devices were signed out.");
        } finally {
            setLoading(button, false, "Update Password");
        }
        };

        $("emailForm").onsubmit = async e => {
        e.preventDefault();
        setFormMsg("emailMsg");
        const email = $("newEmail").value.trim().toLowerCase();
        const pass = $("emailPassword").value;
        if (!email || !pass) return setFormMsg("emailMsg", "Enter the new email and your password.", "error");
        if (email === (currentUser.email || "").toLowerCase()) return setFormMsg("emailMsg", "That is already your email.", "error");

        const button = e.submitter;
        setLoading(button, true, "Updating...");
        try {
            if (!(await verifyPassword(pass))) {
                setFormMsg("emailMsg", "Password is incorrect.", "error");
                return;
            }
            const redirectTo = window.location.href.split("#")[0].split("?")[0];
            const {
                error
            } = await supabase.auth.updateUser({
                    email
                }, {
                    emailRedirectTo: redirectTo
                });
            if (error) {
                setFormMsg("emailMsg", error.message, "error");
                return;
            }
            e.target.reset();
            document.querySelectorAll("#emailForm .pw-field input").forEach(i => (i.type = "password"));
            syncEyes();
            setFormMsg("emailMsg", "Confirmation link sent. Open it to finish changing your email.", "success");
        } finally {
            setLoading(button, false, "Update Email");
        }
        };

        $("signOutOthers").onclick = async () => {
        const {
            error
        } = await supabase.auth.signOut({
                scope: "others"
            });
        error ? toast(error.message, "error"): toast("All other devices were signed out.");
        };
        $("signOutAll").onclick = async () => {
        if (!confirm("Sign out from every device, including this one?")) return;
        const {
            error
        } = await supabase.auth.signOut({
                scope: "global"
            });
        if (error) toast(error.message, "error");
        };

        $("exportData").onclick = () => {
        const backup = {
            exported_at: new Date().toISOString(),
            courses: db.courses,
            lessons: db.lessons,
            daily_checks: Object.values(db.checks)
        };
        const blob = new Blob([JSON.stringify(backup, null, 2)], {
            type: "application/json"
        });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `smartyplan-backup-${today()}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        toast("Backup downloaded.");
        };

        $("wipeData").onclick = async () => {
        if ($("wipeConfirm").value.trim() !== "DELETE") {
            toast('Type DELETE in the box to confirm.', "error");
            return;
        }
        if (!confirm("This permanently erases all your data. Continue?")) return;
        const button = $("wipeData");
        setLoading(button, true, "Erasing...");
        const uid = currentUser.id;
        const steps = ["lessons",
            "daily_checks",
            "courses"];
        for (const table of steps) {
            const {
                error
            } = await supabase.from(table).delete().eq("user_id", uid);
            if (error) {
                setLoading(button, false, "Erase all data");
                toast(error.message, "error");
                return;
            }
        }
        setLoading(button, false, "Erase all data");
        $("wipeConfirm").value = "";
        await loadData();
        toast("All data erased.");
        };


        async function boot() {
        setDarkIcon();
        showAuth();

        const {
            data,
            error
        } = await supabase.auth.getSession();
        if (error) {
            setAuthMessage(error.message, "error");
            return;
        }
        if (data.session?.user) {
            currentUser = data.session.user;
            showApp();
            await loadData();
        }

        supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === "SIGNED_OUT") {
                currentUser = null;
                db = {
                    courses: [],
                    lessons: [],
                    checks: {}
                };
                showAuth();
                return;
            }
            if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session?.user) {
                currentUser = session.user;
                showApp();
                await loadData();
            }
        });
        }

        boot();