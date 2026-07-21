import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";

export interface Link {
  id?: number;
  title: string;
  url: string;
  description: string;
  category: string;
  favorite: number; // 0 or 1
  created_at: string;
  parent_id?: number | null;
}

export interface Note {
  id?: number;
  title: string;
  content: string;
  color?: string; // yellow, blue, green, purple, red, etc.
  created_at: string;
}

let dbInstance: Database | null = null;

export async function getDb(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }
  try {
    // Fetch absolute path dynamically from the Rust backend
    const dbPath = await invoke<string>("get_db_path");
    console.log("Loading DB from path:", dbPath);
    dbInstance = await Database.load(dbPath);
    return dbInstance;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    alert("Error en getDb(): " + errorMsg);
    throw error;
  }
}

export async function getLinks(): Promise<Link[]> {
  try {
    const db = await getDb();
    // Return all links ordered by creation date (newest first)
    const links = await db.select<Link[]>(
      "SELECT * FROM links ORDER BY created_at DESC"
    );
    return links;
  } catch (error) {
    console.error("Error fetching links from DB:", error);
    return [];
  }
}

export async function addLink(
  link: Omit<Link, "id" | "created_at">
): Promise<boolean> {
  try {
    const db = await getDb();
    const createdAt = new Date().toISOString();
    await db.execute(
      `INSERT INTO links (title, url, description, category, favorite, created_at, parent_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        link.title,
        link.url,
        link.description,
        link.category || "General",
        link.favorite ? 1 : 0,
        createdAt,
        link.parent_id !== undefined ? link.parent_id : null,
      ]
    );
    return true;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    alert("Error en addLink(): " + errorMsg);
    console.error("Error adding link to DB:", error);
    return false;
  }
}

export async function updateLink(link: Link): Promise<boolean> {
  if (link.id === undefined) return false;
  try {
    const db = await getDb();
    await db.execute(
      `UPDATE links 
       SET title = $1, url = $2, description = $3, category = $4, favorite = $5, parent_id = $6
       WHERE id = $7`,
      [
        link.title,
        link.url,
        link.description,
        link.category || "General",
        link.favorite ? 1 : 0,
        link.parent_id !== undefined ? link.parent_id : null,
        link.id,
      ]
    );
    return true;
  } catch (error) {
    console.error("Error updating link in DB:", error);
    return false;
  }
}

export async function deleteLink(id: number): Promise<boolean> {
  try {
    const db = await getDb();
    await db.execute("DELETE FROM links WHERE id = $1", [id]);
    return true;
  } catch (error) {
    console.error("Error deleting link from DB:", error);
    return false;
  }
}

export async function toggleFavorite(id: number, favorite: boolean): Promise<boolean> {
  try {
    const db = await getDb();
    await db.execute("UPDATE links SET favorite = $1 WHERE id = $2", [
      favorite ? 1 : 0,
      id,
    ]);
    return true;
  } catch (error) {
    console.error("Error toggling favorite in DB:", error);
    return false;
  }
}

// ===================================
// CRUD OPERATORS FOR MENTAL NOTES
// ===================================

export async function getNotes(): Promise<Note[]> {
  try {
    const db = await getDb();
    const notes = await db.select<Note[]>(
      "SELECT * FROM notes ORDER BY created_at DESC"
    );
    return notes;
  } catch (error) {
    console.error("Error fetching notes from DB:", error);
    return [];
  }
}

export async function addNote(
  note: Omit<Note, "id" | "created_at">
): Promise<boolean> {
  try {
    const db = await getDb();
    const createdAt = new Date().toISOString();
    await db.execute(
      `INSERT INTO notes (title, content, color, created_at)
       VALUES ($1, $2, $3, $4)`,
      [note.title, note.content, note.color || "yellow", createdAt]
    );
    return true;
  } catch (error) {
    console.error("Error adding note to DB:", error);
    return false;
  }
}

export async function updateNote(note: Note): Promise<boolean> {
  if (note.id === undefined) return false;
  try {
    const db = await getDb();
    await db.execute(
      `UPDATE notes 
       SET title = $1, content = $2, color = $3 
       WHERE id = $4`,
      [note.title, note.content, note.color || "yellow", note.id]
    );
    return true;
  } catch (error) {
    console.error("Error updating note in DB:", error);
    return false;
  }
}

export async function deleteNote(id: number): Promise<boolean> {
  try {
    const db = await getDb();
    await db.execute("DELETE FROM notes WHERE id = $1", [id]);
    return true;
  } catch (error) {
    console.error("Error deleting note from DB:", error);
    return false;
  }
}
