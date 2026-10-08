import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import * as faceapi from "@vladmandic/face-api";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Download,
  ImagePlus,
  LayoutDashboard,
  LogOut,
  Power,
  PowerOff,
  RefreshCw,
  Settings,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UserPlus,
  Users,
  XCircle
} from "lucide-react";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");
const FACE_THRESHOLD = 0.5;

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

function todayInputValue() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function formatTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("uz-UZ", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit"
  });
}

function statusLabel(status) {
  if (status === "present") return "Keldi";
  if (status === "left") return "Ketdi";
  return "Kelmagan";
}

function App() {
  const [mode, setMode] = useState("scanner");
  const [token, setToken] = useState(() => localStorage.getItem("face_id_token") || "");
  const [modelsState, setModelsState] = useState({ ready: false, loading: true, error: "" });

  useEffect(() => {
    let mounted = true;

    async function loadModels() {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
          faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
          faceapi.nets.faceRecognitionNet.loadFromUri("/models")
        ]);

        if (mounted) setModelsState({ ready: true, loading: false, error: "" });
      } catch (error) {
        if (mounted) {
          setModelsState({
            ready: false,
            loading: false,
            error: "Face ID modellari yuklanmadi. npm install yoki npm run prepare:models buyrug'ini qayta ishlating."
          });
        }
      }
    }

    loadModels();
    return () => {
      mounted = false;
    };
  }, []);

  function saveToken(nextToken) {
    setToken(nextToken);
    if (nextToken) localStorage.setItem("face_id_token", nextToken);
    else localStorage.removeItem("face_id_token");
  }

  function logoutAdmin() {
    saveToken("");
    setMode("scanner");
  }

  return (
    <div className={mode === "admin" ? "app admin-view" : "app"}>
      <header className="topbar">
        <button className="brand" onClick={() => (mode === "admin" ? null : setMode("scanner"))}>
          <span className="brand-mark">
            <ShieldCheck size={20} />
          </span>
          <span>
            <strong>Face ID Davomat</strong>
            <small>Admin va foydalanuvchi paneli</small>
          </span>
        </button>

        {mode !== "admin" ? (
          <nav className="mode-switch">
            <button onClick={() => setMode("admin")}>
              <ShieldCheck size={17} /> Admin panel
            </button>
          </nav>
        ) : (
          <span className="admin-mode-badge">Admin panel</span>
        )}
      </header>

      <main className={mode === "admin" ? "admin-main" : ""}>
        {mode === "scanner" ? (
          <Scanner modelsState={modelsState} />
        ) : token ? (
          <AdminPanel token={token} onLogout={logoutAdmin} modelsState={modelsState} />
        ) : (
          <Login onLogin={saveToken} onBack={() => setMode("scanner")} />
        )}
      </main>
    </div>
  );
}

function Login({ onLogin, onBack }) {
  const [form, setForm] = useState({ login: "admin", password: "admin123" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data } = await axios.post(`${API_URL}/api/auth/login`, form);
      onLogin(data.token);
    } catch (err) {
      setError(err.response?.data?.message || "Kirishda xatolik bor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="login-card">
      <div className="panel-heading">
        <span className="icon-badge">
          <ShieldCheck size={22} />
        </span>
        <div>
          <h1>Admin panel</h1>
          <p>O'quvchi qo'shish va davomatni nazorat qilish uchun kiring.</p>
        </div>
      </div>

      <form onSubmit={submit} className="form-grid">
        <label>
          Login
          <input value={form.login} onChange={(event) => setForm({ ...form, login: event.target.value })} />
        </label>
        <label>
          Parol
          <input
            type="password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />
        </label>
        {error && <div className="alert danger">{error}</div>}
        <button className="primary-btn" type="submit" disabled={loading}>
          {loading ? "Tekshirilmoqda..." : "Kirish"}
        </button>
        <button className="back-btn" type="button" onClick={onBack}>
          <ArrowLeft size={17} /> Ortga qaytish
        </button>
      </form>
    </section>
  );
}

function AdminPanel({ token, onLogout, modelsState }) {
  const [view, setView] = useState("dashboard");
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({ date: todayInputValue(), rows: [] });
  const [settings, setSettings] = useState({ scannerEnabled: true });
  const [loading, setLoading] = useState(true);

  async function loadAll(date = attendance.date) {
    setLoading(true);
    try {
      const [studentsRes, attendanceRes, settingsRes] = await Promise.all([
        axios.get(`${API_URL}/api/students`, { headers: authHeaders(token) }),
        axios.get(`${API_URL}/api/attendance/today?date=${date}`, { headers: authHeaders(token) }),
        axios.get(`${API_URL}/api/settings`)
      ]);

      setStudents(studentsRes.data);
      setAttendance(attendanceRes.data);
      setSettings(settingsRes.data);
    } finally {
      setLoading(false);
    }
  }

  async function updateScannerEnabled(scannerEnabled) {
    const { data } = await axios.put(
      `${API_URL}/api/settings`,
      { scannerEnabled },
      { headers: authHeaders(token) }
    );
    setSettings(data);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    const present = attendance.rows.filter((row) => row.status === "present").length;
    const left = attendance.rows.filter((row) => row.status === "left").length;
    const absent = attendance.rows.filter((row) => row.status === "absent").length;
    return { present, left, absent, total: students.length };
  }, [attendance.rows, students.length]);

  const menu = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "create", label: "O'quvchi yaratish", icon: UserPlus },
    { key: "students", label: "O'quvchilar", icon: Users },
    { key: "attendance", label: "Davomat", icon: CheckCircle2 },
    { key: "settings", label: "Sozlamalar", icon: Settings }
  ];

  return (
    <section className="admin-shell">
      <aside className="sidebar">
        <div className="sidebar-profile">
          <span className="sidebar-avatar">A</span>
          <div>
            <strong>Admin</strong>
            <small>Face ID boshqaruv</small>
          </div>
        </div>
        <div className={`sidebar-status ${settings.scannerEnabled ? "online" : "offline"}`}>
          <span />
          {settings.scannerEnabled ? "Face ID panel yoqilgan" : "Face ID panel o'chirilgan"}
        </div>
        <div className="sidebar-nav">
          {menu.map((item, index) => {
            const Icon = item.icon;
            return (
              <button key={item.key} className={view === item.key ? "active" : ""} onClick={() => setView(item.key)}>
                <Icon size={18} />
                <span>{item.label}</span>
                <small>{String(index + 1).padStart(2, "0")}</small>
              </button>
            );
          })}
        </div>
        <div className="sidebar-bottom-card">
          <div>
            <strong>Panel holati</strong>
            <small>{settings.scannerEnabled ? "Skaner ochiq" : "Skaner yopiq"}</small>
          </div>
          <Settings size={18} />
        </div>
        <button className="logout-btn" onClick={onLogout}>
          <LogOut size={18} />
          <span>Chiqish</span>
        </button>
      </aside>

      <div className="admin-content">
        {view === "dashboard" && <Dashboard counts={counts} loading={loading} settings={settings} />}
        {view === "create" && (
          <CreateStudent token={token} modelsState={modelsState} onCreated={() => loadAll()} />
        )}
        {view === "students" && <Students token={token} students={students} onChanged={() => loadAll()} />}
        {view === "attendance" && (
          <Attendance
            token={token}
            attendance={attendance}
            loading={loading}
            onDateChange={(date) => {
              setAttendance((current) => ({ ...current, date }));
              loadAll(date);
            }}
          />
        )}
        {view === "settings" && <SettingsPanel settings={settings} onToggle={updateScannerEnabled} />}
      </div>
    </section>
  );
}

function Dashboard({ counts, loading, settings }) {
  const cards = [
    { label: "Jami o'quvchi", value: counts.total, tone: "green" },
    { label: "Bugun keldi", value: counts.present, tone: "mint" },
    { label: "Ketdi", value: counts.left, tone: "yellow" },
    { label: "Kelmagan", value: counts.absent, tone: "red" },
    { label: "Face ID panel", value: settings.scannerEnabled ? "Yoniq" : "O'chiq", tone: settings.scannerEnabled ? "mint" : "red" }
  ];

  return (
    <div className="content-block">
      <div className="content-title">
        <h1>Dashboard</h1>
        <p>Bugungi davomat holati shu yerda ko'rinadi.</p>
      </div>

      <div className="stats-grid">
        {cards.map((card) => (
          <article className={`stat-card ${card.tone}`} key={card.label}>
            <span>{card.label}</span>
            <strong>{loading ? "..." : card.value}</strong>
          </article>
        ))}
      </div>
    </div>
  );
}

function SettingsPanel({ settings, onToggle }) {
  const [saving, setSaving] = useState(false);
  const enabled = settings.scannerEnabled !== false;

  async function toggle() {
    setSaving(true);
    try {
      await onToggle(!enabled);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="content-block">
      <div className="content-title">
        <div>
          <h1>Sozlamalar</h1>
          <p>Foydalanuvchi panelidagi Face ID skanerni admin shu yerdan boshqaradi.</p>
        </div>
      </div>

      <article className="setting-card">
        <div>
          <span className={`setting-icon ${enabled ? "on" : "off"}`}>
            {enabled ? <Power size={22} /> : <PowerOff size={22} />}
          </span>
        </div>
        <div>
          <strong>Foydalanuvchi Face ID paneli</strong>
          <p>
            {enabled
              ? "Hozir foydalanuvchilar kamerani yoqib davomat qilishi mumkin."
              : "Hozir foydalanuvchi paneli yopiq, skaner ishlamaydi."}
          </p>
        </div>
        <button className={`toggle-btn ${enabled ? "on" : "off"}`} onClick={toggle} disabled={saving}>
          {saving ? "Saqlanmoqda..." : enabled ? "O'chirish" : "Yoqish"}
        </button>
      </article>
    </div>
  );
}

function CreateStudent({ token, modelsState, onCreated }) {
  const captureVideoRef = useRef(null);
  const captureStreamRef = useRef(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", photo: null });
  const [preview, setPreview] = useState("");
  const [photoMode, setPhotoMode] = useState("camera");
  const [captureOn, setCaptureOn] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => () => stopCaptureCamera(), []);

  function onPhotoChange(file) {
    setForm((current) => ({ ...current, photo: file }));
    setMessage("");
    if (preview) URL.revokeObjectURL(preview);
    setPreview(file ? URL.createObjectURL(file) : "");
  }

  async function startCaptureCamera() {
    setMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 900 }, height: { ideal: 900 } },
        audio: false
      });

      captureStreamRef.current = stream;
      captureVideoRef.current.srcObject = stream;
      setCaptureOn(true);
      if (preview) {
        URL.revokeObjectURL(preview);
        setPreview("");
      }
      setForm((current) => ({ ...current, photo: null }));
    } catch {
      setMessage("Kamera ochilmadi. Brauzerdan kameraga ruxsat bering yoki rasm biriktiring.");
    }
  }

  function stopCaptureCamera() {
    captureStreamRef.current?.getTracks().forEach((track) => track.stop());
    captureStreamRef.current = null;
    setCaptureOn(false);
  }

  async function capturePhoto() {
    if (!captureVideoRef.current || captureVideoRef.current.readyState < 2) {
      setMessage("Kamera hali tayyor emas");
      return;
    }

    const video = captureVideoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext("2d");
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) {
      setMessage("Rasm olishda xatolik bo'ldi");
      return;
    }

    const file = new File([blob], `student-${Date.now()}.jpg`, { type: "image/jpeg" });
    onPhotoChange(file);
    stopCaptureCamera();
  }

  async function createDescriptor(file) {
    const image = await faceapi.bufferToImage(file);
    const detection = await faceapi
      .detectSingleFace(image, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      throw new Error("Rasmda aniq yuz topilmadi. Yuz old tomondan, yorug' joyda ko'rinsin.");
    }

    return Array.from(detection.descriptor);
  }

  async function submit(event) {
    event.preventDefault();
    setMessage("");

    if (!modelsState.ready) {
      setMessage(modelsState.error || "Face ID modellari hali tayyor emas");
      return;
    }

    if (!form.photo) {
      setMessage("O'quvchi rasmi tanlang");
      return;
    }

    setLoading(true);
    try {
      const descriptor = await createDescriptor(form.photo);
      const body = new FormData();
      body.append("firstName", form.firstName);
      body.append("lastName", form.lastName);
      body.append("descriptor", JSON.stringify(descriptor));
      body.append("photo", form.photo);

      await axios.post(`${API_URL}/api/students`, body, {
        headers: { ...authHeaders(token), "Content-Type": "multipart/form-data" }
      });

      // Saqlangandan keyin forma butunlay tozalanadi.
      setForm({ firstName: "", lastName: "", photo: null });
      setPreview("");
      setMessage("");
      const fileInput = document.querySelector('.upload-box input[type="file"]');
      if (fileInput) fileInput.value = "";
      onCreated();
    } catch (err) {
      setMessage(err.response?.data?.message || err.message || "Saqlashda xatolik");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="content-block">
      <div className="content-title">
        <h1>O'quvchi yaratish</h1>
        <p>Ism, familiya va bitta aniq rasm kiriting. Rasm Face ID uchun saqlanadi.</p>
      </div>

      <form className="student-form" onSubmit={submit}>
        <div className="photo-panel">
          <div className="photo-tabs">
            <button
              type="button"
              className={photoMode === "camera" ? "active" : ""}
              onClick={() => setPhotoMode("camera")}
            >
              <Camera size={16} /> Kameradan olish
            </button>
            <button
              type="button"
              className={photoMode === "upload" ? "active" : ""}
              onClick={() => {
                stopCaptureCamera();
                setPhotoMode("upload");
              }}
            >
              <ImagePlus size={16} /> Rasm biriktirish
            </button>
          </div>

          {photoMode === "camera" ? (
            <div className="capture-box">
              {preview ? (
                <img src={preview} alt="Olingan o'quvchi rasmi" />
              ) : (
                <>
                  <video ref={captureVideoRef} autoPlay muted playsInline />
                  {!captureOn && (
                    <div className="capture-placeholder">
                      <Camera size={42} />
                      <strong>O'quvchi yuzini kameradan rasmga oling</strong>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="upload-box">
              {preview ? <img src={preview} alt="Tanlangan o'quvchi" /> : <UploadCloud size={42} />}
              <input type="file" accept="image/*" onChange={(event) => onPhotoChange(event.target.files?.[0] || null)} />
              <span>{preview ? "Rasm tanlandi" : "Rasm yuklash"}</span>
            </div>
          )}

          {photoMode === "camera" && (
            <div className="photo-actions">
              <button type="button" className="secondary-btn" onClick={startCaptureCamera} disabled={captureOn}>
                <Camera size={17} /> Kamerani ochish
              </button>
              <button type="button" className="primary-btn" onClick={capturePhoto} disabled={!captureOn}>
                Rasmga olish
              </button>
              {preview && (
                <button type="button" className="secondary-btn" onClick={startCaptureCamera}>
                  <RefreshCw size={17} /> Qayta olish
                </button>
              )}
            </div>
          )}
        </div>

        <div className="form-grid grow">
          <label>
            Ism
            <input
              required
              value={form.firstName}
              onChange={(event) => setForm({ ...form, firstName: event.target.value })}
              placeholder="Masalan: Dilmurod"
            />
          </label>
          <label>
            Familiya
            <input
              required
              value={form.lastName}
              onChange={(event) => setForm({ ...form, lastName: event.target.value })}
              placeholder="Masalan: Mo'minov"
            />
          </label>
          {message && <div className={`alert ${message.includes("saqlandi") ? "success" : "danger"}`}>{message}</div>}
          <button className="primary-btn" disabled={loading || modelsState.loading} type="submit">
            {loading ? "Saqlanmoqda..." : modelsState.loading ? "Model yuklanmoqda..." : "O'quvchini saqlash"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Students({ token, students, onChanged }) {
  async function removeStudent(id) {
    if (!confirm("O'quvchini o'chirasizmi?")) return;
    await axios.delete(`${API_URL}/api/students/${id}`, { headers: authHeaders(token) });
    onChanged();
  }

  return (
    <div className="content-block">
      <div className="content-title">
        <h1>O'quvchilar</h1>
        <p>Admin yaratgan barcha o'quvchilar shu bo'limda alohida ko'rinadi.</p>
      </div>

      <div className="student-list">
        {students.length === 0 && <div className="empty">Hali o'quvchi qo'shilmagan.</div>}
        {students.map((student) => (
          <article className="student-card" key={student.id}>
            <img src={`${API_URL}${student.imageUrl}`} alt={student.fullName} />
            <div>
              <strong>{student.fullName}</strong>
              <span className={`pill ${student.todayStatus}`}>{statusLabel(student.todayStatus)}</span>
            </div>
            <button className="icon-btn danger" onClick={() => removeStudent(student.id)} aria-label="O'chirish">
              <Trash2 size={18} />
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

function Attendance({ token, attendance, loading, onDateChange }) {
  async function downloadExcel() {
    const response = await fetch(`${API_URL}/api/attendance/export?date=${attendance.date}`, {
      headers: authHeaders(token)
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `davomat-${attendance.date}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="content-block">
      <div className="content-title split">
        <div>
          <h1>Davomat</h1>
          <p>Tanlangan kun bo'yicha keldi, ketdi yoki kelmagan holatini ko'ring.</p>
        </div>
        <div className="attendance-actions">
          <input type="date" value={attendance.date} onChange={(event) => onDateChange(event.target.value)} />
          <button className="secondary-btn" onClick={downloadExcel}>
            <Download size={17} /> Excel
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>№</th>
              <th>Ism familiya</th>
              <th>Holat</th>
              <th>Birinchi ko'rindi</th>
              <th>Oxirgi ko'rindi</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="5">Yuklanmoqda...</td>
              </tr>
            )}
            {!loading &&
              attendance.rows.map((row) => (
                <tr key={row.studentId}>
                  <td>{row.number}</td>
                  <td>{row.fullName}</td>
                  <td>
                    <span className={`pill ${row.status}`}>{statusLabel(row.status)}</span>
                  </td>
                  <td>{formatTime(row.firstSeenAt)}</td>
                  <td>{formatTime(row.lastSeenAt)}</td>
                </tr>
              ))}
            {!loading && attendance.rows.length === 0 && (
              <tr>
                <td colSpan="5">Ma'lumot yo'q</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Scanner({ modelsState }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const busyRef = useRef(false);
  const lastSentRef = useRef({ id: "", at: 0 });
  const [students, setStudents] = useState([]);
  const [scannerEnabled, setScannerEnabled] = useState(true);
  const [cameraOn, setCameraOn] = useState(false);
  const [message, setMessage] = useState({ type: "idle", text: "Kamera ochilgach yuz skaner qilinadi." });
  const [scanning, setScanning] = useState(false);

  async function loadSettings() {
    const { data } = await axios.get(`${API_URL}/api/settings`);
    const enabled = data.scannerEnabled !== false;
    setScannerEnabled(enabled);

    if (!enabled) {
      stopCamera();
      setMessage({ type: "danger", text: "Face ID panel admin tomonidan o'chirilgan" });
    }

    return enabled;
  }

  async function loadStudents() {
    try {
      const enabled = await loadSettings();
      if (!enabled) {
        setStudents([]);
        return false;
      }

      const { data } = await axios.get(`${API_URL}/api/scanner/students`);
      setStudents(data.filter((student) => Array.isArray(student.descriptor)));
      return true;
    } catch (err) {
      if (err.response?.status === 423) {
        setScannerEnabled(false);
        setStudents([]);
        setMessage({ type: "danger", text: "Face ID panel admin tomonidan o'chirilgan" });
      }
      return false;
    }
  }

  useEffect(() => {
    loadStudents();
    const timer = setInterval(() => {
      loadSettings().catch(() => null);
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  async function startCamera() {
    if (!scannerEnabled) {
      setMessage({ type: "danger", text: "Face ID panel admin tomonidan o'chirilgan" });
      return;
    }

    try {
      const enabled = await loadStudents();
      if (!enabled) return;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      setCameraOn(true);
      setMessage({ type: "idle", text: "Kamera tayyor. Yuzingizni markazga olib keling." });
    } catch {
      setMessage({ type: "danger", text: "Kameraga ruxsat berilmadi yoki brauzer kamerani topmadi." });
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  useEffect(() => {
    if (!cameraOn || !modelsState.ready || !scannerEnabled) return;
    const timer = setInterval(async () => {
      if (!videoRef.current || busyRef.current) return;
      if (videoRef.current.readyState < 2) return;

      busyRef.current = true;
      setScanning(true);

      try {
        const detection = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detection) {
          setMessage({ type: "idle", text: "Yuz kameraga aniq tushmadi." });
          return;
        }

        let best = null;
        for (const student of students) {
          const distance = faceapi.euclideanDistance(detection.descriptor, new Float32Array(student.descriptor));
          if (!best || distance < best.distance) {
            best = { student, distance };
          }
        }

        if (!best || best.distance > FACE_THRESHOLD) {
          setMessage({ type: "danger", text: "Yuz mos kelmadi" });
          return;
        }

        const now = Date.now();
        if (lastSentRef.current.id === best.student.id && now - lastSentRef.current.at < 8000) {
          setMessage({ type: "success", text: `${best.student.fullName} aniqlandi` });
          return;
        }

        lastSentRef.current = { id: best.student.id, at: now };
        const { data } = await axios.post(`${API_URL}/api/attendance/scan`, {
          studentId: best.student.id,
          distance: best.distance
        });
        setMessage({ type: data.action === "ketdi" ? "warning" : "success", text: data.message });
      } catch (err) {
        if (err.response?.status === 423) {
          setScannerEnabled(false);
          stopCamera();
          setMessage({ type: "danger", text: "Face ID panel admin tomonidan o'chirilgan" });
        } else {
          setMessage({ type: "danger", text: "Skanerda xatolik yuz berdi" });
        }
      } finally {
        busyRef.current = false;
        setScanning(false);
      }
    }, 1400);

    return () => clearInterval(timer);
  }, [cameraOn, modelsState.ready, scannerEnabled, students]);

  useEffect(() => () => stopCamera(), []);

  return (
    <section className="scanner-layout">
      <div className="scanner-copy">
        <span className={`eyebrow ${scannerEnabled ? "" : "off"}`}>
          {scannerEnabled ? "Foydalanuvchi paneli" : "Panel o'chirilgan"}
        </span>
        <h1>Yuzni skaner qiling</h1>
        <p>Admin qo'shgan o'quvchi kameraga qarasa, tizim uni aniqlab davomatni belgilaydi.</p>

        <div className={`scan-result ${message.type}`}>
          {message.type === "danger" ? <XCircle size={24} /> : <CheckCircle2 size={24} />}
          <strong>{modelsState.loading ? "Face ID modellari yuklanmoqda..." : message.text}</strong>
        </div>

        {modelsState.error && <div className="alert danger">{modelsState.error}</div>}

        <div className="scanner-actions">
          <button className="primary-btn" onClick={startCamera} disabled={cameraOn || !modelsState.ready || !scannerEnabled}>
            <Camera size={18} /> Kamerani yoqish
          </button>
          <button className="secondary-btn" onClick={stopCamera} disabled={!cameraOn}>
            To'xtatish
          </button>
          {!scannerEnabled && (
            <button className="secondary-btn" onClick={loadStudents}>
              <RefreshCw size={17} /> Qayta tekshirish
            </button>
          )}
        </div>
      </div>

      <div className="camera-card">
        <video ref={videoRef} autoPlay muted playsInline />
        <div className={`scan-ring ${scanning ? "active" : ""}`} />
        <div className="camera-footer">
          <span>{cameraOn ? "Kamera ishlayapti" : "Kamera o'chirilgan"}</span>
          <span>{scannerEnabled ? `${students.length} ta yuz bazada` : "Admin paneldan yoqing"}</span>
        </div>
      </div>
    </section>
  );
}

export default App;
