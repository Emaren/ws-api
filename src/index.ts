import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const serviceName = process.env.SERVICE_NAME || "ws-api";
const startedAt = Date.now();

app.get("/", (_req, res) => {
  return res.json({ service: serviceName, ok: true });
});

app.get("/health", (_req, res) => {
  return res.json({
    status: "ok",
    service: serviceName,
    uptime_s: Math.floor((Date.now() - startedAt) / 1000),
  });
});

app.get("/ping", (_req, res) => {
  return res.json({ status: "ok" });
});

const users: { email: string; password: string }[] = []; // TEMP user store

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email && u.password === password);

  if (user) {
    return res.json({
      id: "1",
      name: "Tony Blum",
      email: user.email,
      role: "admin"
    });
  }

  return res.status(401).json({ error: "Invalid credentials" });
});

app.post("/api/register", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const exists = users.find((u) => u.email === email);
  if (exists) {
    return res.status(409).json({ message: "User already exists" });
  }

  users.push({ email, password }); // Replace with DB + hash later
  return res.status(200).json({ message: "User created" });
});

const PORT = process.env.PORT || 3012;
app.listen(PORT, () => console.log(`🛡️ ws-api running on port ${PORT}`));
