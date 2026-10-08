require("dotenv").config();

const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const cors = require("cors");
const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");

const app = express();
const PORT = Number(process.env.PORT || 5000);
const ROOT = path.resolve(__dirname, "..");
// Railway Volume uchun DATA_DIR ni /data qilib berish mumkin.
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, "data"));
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const DB_PATH = path.join(DATA_DIR, "db.json");
const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Tashkent";
const COOLDOWN_MS = Number(process.env.ATTENDANCE_COOLDOWN_SECONDS || 90) * 1000;

const allowedOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin.replace(/\/$/, ""))) {
        return callback(null, true);
      }
      return callback(new Error("CORS: bu frontend manziliga ruxsat berilmagan"));
    },
    credentials: true
  })
);
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(UPLOAD_DIR));

async function ensureStorage() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.writeFile(DB_PATH, JSON.stringify({ students: [], attendance: [] }, null, 2));
  }
}

async function readDb() {
  await ensureStorage();
  const content = await fs.readFile(DB_PATH, "utf8");
  const db = JSON.parse(content || "{}");
  return {
    students: Array.isArray(db.students) ? db.students : [],
    attendance: Array.isArray(db.attendance) ? db.attendance : [],
    settings: {
      scannerEnabled: db.settings?.scannerEnabled !== false
    }
  };
}

async function writeDb(db) {
  await ensureStorage();
  const tempPath = `${DB_PATH}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(db, null, 2));
  await fs.rename(tempPath, DB_PATH);
}

function getToday() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  })
    .formatToParts(new Date())
    .reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function fullName(student) {
  return `${student.firstName} ${student.lastName}`.replace(/\s+/g, " ").trim();
}

function signToken(payload) {
  const body = Buffer.from(
    JSON.stringify({
      ...payload,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7
    })
  ).toString("base64url");
  const signature = crypto.createHmac("sha256", process.env.JWT_SECRET || "dev-secret").update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verifyToken(token) {
  try {
    if (!token || !token.includes(".")) return null;
    const [body, signature] = token.split(".");
    if (!body || !signature) return null;
    const expected = crypto.createHmac("sha256", process.env.JWT_SECRET || "dev-secret").update(body).digest("base64url");

    if (Buffer.byteLength(signature) !== Buffer.byteLength(expected)) return null;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const payload = verifyToken(token);

  if (!payload?.role || payload.role !== "admin") {
    return res.status(401).json({ message: "Admin panelga kirish kerak" });
  }

  req.admin = payload;
  next();
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || ".jpg").toLowerCase() || ".jpg";
      cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
    }
  }),
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Faqat rasm yuklash mumkin"));
    }
    cb(null, true);
  }
});

function publicStudent(student, attendance = []) {
  const todayRecord = attendance.find((item) => item.studentId === student.id && item.date === getToday());
  return {
    id: student.id,
    firstName: student.firstName,
    lastName: student.lastName,
    fullName: fullName(student),
    imageUrl: student.imagePath ? `/uploads/${student.imagePath}` : null,
    createdAt: student.createdAt,
    todayStatus: todayRecord?.status || "absent",
    firstSeenAt: todayRecord?.firstSeenAt || null,
    lastSeenAt: todayRecord?.lastSeenAt || null
  };
}

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "face-id-davomat-backend" });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "face-id-davomat", timezone: APP_TIMEZONE });
});

app.get("/api/settings", async (_req, res) => {
  const db = await readDb();
  res.json(db.settings);
});

app.put("/api/settings", requireAdmin, async (req, res) => {
  const db = await readDb();
  db.settings = {
    ...db.settings,
    scannerEnabled: req.body?.scannerEnabled !== false
  };
  await writeDb(db);
  res.json(db.settings);
});

app.post("/api/auth/login", (req, res) => {
  const { login, password } = req.body || {};
  const adminLogin = process.env.ADMIN_LOGIN || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

  if (login !== adminLogin || password !== adminPassword) {
    return res.status(401).json({ message: "Login yoki parol noto'g'ri" });
  }

  res.json({
    token: signToken({ role: "admin", login: adminLogin }),
    user: { login: adminLogin, role: "admin" }
  });
});

app.get("/api/students", requireAdmin, async (_req, res) => {
  const db = await readDb();
  res.json(db.students.map((student) => publicStudent(student, db.attendance)));
});

app.get("/api/scanner/students", async (_req, res) => {
  const db = await readDb();

  if (!db.settings.scannerEnabled) {
    return res.status(423).json({ message: "Face ID panel admin tomonidan o'chirilgan", scannerEnabled: false });
  }

  res.json(
    db.students.map((student) => ({
      id: student.id,
      fullName: fullName(student),
      descriptor: student.descriptor
    }))
  );
});

app.post("/api/students", requireAdmin, upload.single("photo"), async (req, res) => {
  const { firstName = "", lastName = "", descriptor = "" } = req.body || {};

  if (!firstName.trim() || !lastName.trim()) {
    return res.status(400).json({ message: "Ism va familiya kiritilishi kerak" });
  }

  if (!req.file) {
    return res.status(400).json({ message: "O'quvchi rasmi kerak" });
  }

  let parsedDescriptor;
  try {
    parsedDescriptor = JSON.parse(descriptor);
  } catch {
    return res.status(400).json({ message: "Face ID ma'lumoti noto'g'ri" });
  }

  if (!Array.isArray(parsedDescriptor) || parsedDescriptor.length < 64) {
    return res.status(400).json({ message: "Rasmda yuz aniqlanmadi" });
  }

  const db = await readDb();
  const student = {
    id: crypto.randomUUID(),
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    imagePath: req.file.filename,
    descriptor: parsedDescriptor.map(Number),
    createdAt: new Date().toISOString()
  };

  db.students.unshift(student);
  await writeDb(db);
  res.status(201).json(publicStudent(student, db.attendance));
});

app.delete("/api/students/:id", requireAdmin, async (req, res) => {
  const db = await readDb();
  const student = db.students.find((item) => item.id === req.params.id);

  if (!student) {
    return res.status(404).json({ message: "O'quvchi topilmadi" });
  }

  const nextDb = {
    students: db.students.filter((item) => item.id !== req.params.id),
    attendance: db.attendance.filter((item) => item.studentId !== req.params.id)
  };

  await writeDb(nextDb);

  if (student.imagePath) {
    await fs.rm(path.join(UPLOAD_DIR, student.imagePath), { force: true });
  }

  res.json({ ok: true });
});

app.get("/api/attendance/today", requireAdmin, async (req, res) => {
  const date = req.query.date || getToday();
  const db = await readDb();
  const rows = db.students.map((student, index) => {
    const record = db.attendance.find((item) => item.studentId === student.id && item.date === date);
    return {
      number: index + 1,
      studentId: student.id,
      fullName: fullName(student),
      status: record?.status || "absent",
      firstSeenAt: record?.firstSeenAt || null,
      lastSeenAt: record?.lastSeenAt || null,
      events: record?.events || []
    };
  });

  res.json({ date, rows });
});

app.post("/api/attendance/scan", async (req, res) => {
  const { studentId, distance } = req.body || {};
  const db = await readDb();

  if (!db.settings.scannerEnabled) {
    return res.status(423).json({ message: "Face ID panel admin tomonidan o'chirilgan", scannerEnabled: false });
  }

  const student = db.students.find((item) => item.id === studentId);

  if (!student) {
    return res.status(404).json({ message: "O'quvchi topilmadi" });
  }

  const now = new Date();
  const today = getToday();
  let record = db.attendance.find((item) => item.studentId === student.id && item.date === today);

  if (record && now.getTime() - new Date(record.lastSeenAt).getTime() < COOLDOWN_MS) {
    return res.json({
      action: "cooldown",
      status: record.status,
      message: `${fullName(student)} allaqachon belgilangan`,
      student: publicStudent(student, db.attendance)
    });
  }

  const nextAction = !record || record.status === "left" ? "keldi" : "ketdi";
  const nextStatus = nextAction === "keldi" ? "present" : "left";
  const event = {
    type: nextAction,
    at: now.toISOString(),
    distance: Number(distance || 0)
  };

  if (!record) {
    record = {
      id: crypto.randomUUID(),
      studentId: student.id,
      date: today,
      status: nextStatus,
      firstSeenAt: now.toISOString(),
      lastSeenAt: now.toISOString(),
      events: [event]
    };
    db.attendance.unshift(record);
  } else {
    record.status = nextStatus;
    record.lastSeenAt = now.toISOString();
    record.events.push(event);
  }

  await writeDb(db);

  res.json({
    action: nextAction,
    status: record.status,
    message: `${fullName(student)} ${nextAction}`,
    student: publicStudent(student, db.attendance)
  });
});

app.get("/api/attendance/export", requireAdmin, async (req, res) => {
  const date = req.query.date || getToday();
  const db = await readDb();
  const rows = db.students.map((student, index) => {
    const record = db.attendance.find((item) => item.studentId === student.id && item.date === date);
    const keldi = record?.events?.find((event) => event.type === "keldi");
    const ketdi = [...(record?.events || [])].reverse().find((event) => event.type === "ketdi");

    return {
      "№": index + 1,
      "Ism": student.firstName,
      "Familiya": student.lastName,
      "Holat": record ? (record.status === "present" ? "Keldi" : "Ketdi") : "Kelmagan",
      "Keldi vaqti": keldi ? new Date(keldi.at).toLocaleString("uz-UZ", { timeZone: APP_TIMEZONE }) : "",
      "Ketdi vaqti": ketdi ? new Date(ketdi.at).toLocaleString("uz-UZ", { timeZone: APP_TIMEZONE }) : "",
      "Oxirgi ko'rindi": record?.lastSeenAt ? new Date(record.lastSeenAt).toLocaleString("uz-UZ", { timeZone: APP_TIMEZONE }) : ""
    };
  });

  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Davomat");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Disposition", `attachment; filename="davomat-${date}.xlsx"`);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.send(buffer);
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: err.message || "Server xatosi" });
});

ensureStorage().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Face ID backend ${PORT}-portda ishlayapti`);
    console.log(`Data directory: ${DATA_DIR}`);
  });
});
