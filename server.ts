import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";

let db: Database.Database;
try {
  db = new Database("takwim.db");
  console.log("Database initialized successfully at takwim.db");
} catch (error) {
  console.error("CRITICAL: Failed to initialize database:", error);
  // Fallback to in-memory if file fails (useful for some environments, though data won't persist)
  db = new Database(":memory:");
  console.warn("Using in-memory database as fallback. Data will NOT persist!");
}

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

db.exec(`
  CREATE TABLE IF NOT EXISTS category_colors (
    category TEXT PRIMARY KEY,
    color TEXT NOT NULL
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

  app.get("/api/category-colors", (req, res) => {
    const colors = db.prepare("SELECT * FROM category_colors").all();
    const colorMap = colors.reduce((acc: any, curr: any) => {
      acc[curr.category] = curr.color;
      return acc;
    }, {});
    res.json(colorMap);
  });

  app.post("/api/category-colors", (req, res) => {
    const { category, color } = req.body;
    db.prepare("INSERT OR REPLACE INTO category_colors (category, color) VALUES (?, ?)").run(category, color);
    res.json({ success: true });
  });

  app.delete("/api/programs", (req, res) => {
    const { year } = req.query;
    console.log(`Clearing programs for year: ${year || 'ALL'}`);
    try {
      let result;
      if (year) {
        result = db.prepare("DELETE FROM programs WHERE year = ?").run(year);
      } else {
        result = db.prepare("DELETE FROM programs").run();
      }
      console.log(`Bulk delete result: ${result.changes} rows affected`);
      res.json({ success: true, changes: result.changes });
    } catch (error) {
      console.error("Clear error:", error);
      res.status(500).json({ error: "Failed to clear programs" });
    }
  });

  app.delete("/api/programs/:id", (req, res) => {
    const { id } = req.params;
    console.log(`[DELETE] Request received for ID: ${id} (Type: ${typeof id})`);
    try {
      const programId = parseInt(id);
      if (isNaN(programId)) {
        console.error(`[DELETE] Invalid ID format: ${id}`);
        return res.status(400).json({ error: "Invalid ID format" });
      }
      
      const result = db.prepare("DELETE FROM programs WHERE id = ?").run(programId);
      console.log(`[DELETE] Success. ID ${programId}: ${result.changes} rows affected`);
      
      if (result.changes === 0) {
        console.warn(`[DELETE] No program found with ID ${programId}`);
      }
      
      res.json({ success: true, changes: result.changes });
    } catch (error) {
      console.error("[DELETE] Error:", error);
      res.status(500).json({ error: "Failed to delete program" });
    }
  });

  app.post("/api/programs", (req, res) => {
    console.log("[POST] Received program data:", req.body);
    try {
      const { date, name, time, location, category, purpose, year } = req.body;
      
      if (!date || !name || year === undefined) {
        console.error("[POST] Missing required fields:", { date, name, year });
        return res.status(400).json({ error: "Missing required fields (date, name, year)" });
      }

      const info = db.prepare(
        "INSERT INTO programs (date, name, time, location, category, purpose, year) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(date, name, time, location, category, purpose, year);
      
      console.log("[POST] Program saved successfully, ID:", info.lastInsertRowid);
      res.json({ id: info.lastInsertRowid });
    } catch (error) {
      console.error("[POST] Error saving program:", error);
      res.status(500).json({ error: "Internal Server Error", message: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put("/api/programs/:id", (req, res) => {
    const { id } = req.params;
    console.log(`[PUT] Received update for ID: ${id}`, req.body);
    try {
      const { date, name, time, location, category, purpose, year } = req.body;
      
      const result = db.prepare(
        "UPDATE programs SET date = ?, name = ?, time = ?, location = ?, category = ?, purpose = ?, year = ? WHERE id = ?"
      ).run(date, name, time, location, category, purpose, year, id);
      
      if (result.changes === 0) {
        console.warn(`[PUT] No program found with ID ${id}`);
        return res.status(404).json({ error: "Program not found" });
      }

      console.log(`[PUT] Program ${id} updated successfully`);
      res.json({ success: true });
    } catch (error) {
      console.error(`[PUT] Error updating program ${id}:`, error);
      res.status(500).json({ error: "Internal Server Error", message: error instanceof Error ? error.message : String(error) });
    }
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
