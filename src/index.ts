import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  // Replace this with DB lookup or other auth logic
  if (email === "tony@wheatandstone.ca" && password === "secret123") {
    return res.json({
      id: "1",
      name: "Tony Blum",
      email,
      role: "admin"
    });
  }

  return res.status(401).json({ error: "Invalid credentials" });
});

const PORT = process.env.PORT || 3012;
app.listen(PORT, () => console.log(`🛡️ ws-api running on port ${PORT}`));
