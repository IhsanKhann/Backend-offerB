import express from "express";
const router = express.Router();

console.log("📦 debug.routes.js LOADED");

router.post("/ping", (req, res) => {
  console.log("🏓 PING controller HIT");
  res.json({ ok: true, body: req.body });
});

export default router;