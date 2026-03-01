import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";

const db = new Database("takwim.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS programs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    name TEXT NOT NULL,
    time TEXT,
    location TEXT,
    category TEXT,
    purpose TEXT,
    year INTEGER NOT NULL
  )
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/programs", (req, res) => {
    const { year } = req.query;
    let query = "SELECT * FROM programs";
    const params = [];
    
    if (year) {
      query += " WHERE year = ?";
      params.push(year);
    }
    
    const programs = db.prepare(query).all(...params);
    res.json(programs);
  });

  app.post("/api/programs", (req, res) => {
    const { date, name, time, location, category, purpose, year } = req.body;
    const info = db.prepare(
      "INSERT INTO programs (date, name, time, location, category, purpose, year) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(date, name, time, location, category, purpose, year);
    res.json({ id: info.lastInsertRowid });
  });

  app.put("/api/programs/:id", (req, res) => {
    const { id } = req.params;
    const { date, name, time, location, category, purpose, year } = req.body;
    db.prepare(
      "UPDATE programs SET date = ?, name = ?, time = ?, location = ?, category = ?, purpose = ?, year = ? WHERE id = ?"
    ).run(date, name, time, location, category, purpose, year, id);
    res.json({ success: true });
  });

  app.delete("/api/programs/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM programs WHERE id = ?").run(id);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
