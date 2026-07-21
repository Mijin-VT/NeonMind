import React, { useState, useEffect } from "react";
import {
  BrainCircuit,
  Plus,
  Search,
  Trash2,
  Edit2,
  Calendar,
  Save,
  X,
  Sparkles,
} from "lucide-react";
import { Note, getNotes, addNote, updateNote, deleteNote } from "../db";
import { Language, translations } from "../translations";
import Pagination from "./Pagination";

const colorsConfig: Record<string, { bg: string; border: string; text: string; dot: string; label: string }> = {
  yellow: {
    bg: "bg-yellow-500/5 hover:bg-yellow-500/10",
    border: "border-yellow-500/20 hover:border-yellow-500/40",
    text: "text-yellow-200",
    dot: "bg-yellow-500",
    label: "Amarillo",
  },
  blue: {
    bg: "bg-blue-500/5 hover:bg-blue-500/10",
    border: "border-blue-500/20 hover:border-blue-500/40",
    text: "text-blue-200",
    dot: "bg-blue-500",
    label: "Azul",
  },
  green: {
    bg: "bg-emerald-500/5 hover:bg-emerald-500/10",
    border: "border-emerald-500/20 hover:border-emerald-500/40",
    text: "text-emerald-200",
    dot: "bg-emerald-500",
    label: "Verde",
  },
  purple: {
    bg: "bg-purple-500/5 hover:bg-purple-500/10",
    border: "border-purple-500/20 hover:border-purple-500/40",
    text: "text-purple-200",
    dot: "bg-purple-500",
    label: "Violeta",
  },
  red: {
    bg: "bg-rose-500/5 hover:bg-rose-500/10",
    border: "border-rose-500/20 hover:border-rose-500/40",
    text: "text-rose-200",
    dot: "bg-rose-500",
    label: "Rosa",
  },
};

export default function MentalNotes({ lang }: { lang: Language }) {
  const t = (key: keyof typeof translations["es"]) => translations[lang][key];
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Editor states
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editNote, setEditNote] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedColor, setSelectedColor] = useState("yellow");

  useEffect(() => {
    loadNotes();
  }, []);

  // Reset page on search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const loadNotes = async () => {
    const data = await getNotes();
    setNotes(data);
  };

  const handleOpenNewEditor = () => {
    setEditNote(null);
    setTitle("");
    setContent("");
    setSelectedColor("yellow");
    setIsEditorOpen(true);
  };

  const handleOpenEditEditor = (note: Note) => {
    setEditNote(note);
    setTitle(note.title);
    setContent(note.content);
    setSelectedColor(note.color || "yellow");
    setIsEditorOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    let success = false;
    if (editNote?.id !== undefined) {
      // Update
      success = await updateNote({
        ...editNote,
        title: title.trim(),
        content: content.trim(),
        color: selectedColor,
      });
    } else {
      // Add
      success = await addNote({
        title: title.trim(),
        content: content.trim(),
        color: selectedColor,
      });
    }

    if (success) {
      setIsEditorOpen(false);
      loadNotes();
    } else {
      alert(lang === "es" ? "Error al guardar la nota mental." : "Error saving mental note.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t("notes_delete_confirm"))) return;
    const success = await deleteNote(id);
    if (success) {
      loadNotes();
    } else {
      alert(lang === "es" ? "Error al eliminar la nota." : "Error deleting note.");
    }
  };

  // Filter notes locally
  const filteredNotes = notes.filter((n) => {
    const cleanQuery = searchQuery.toLowerCase().trim();
    return (
      !cleanQuery ||
      n.title.toLowerCase().includes(cleanQuery) ||
      n.content.toLowerCase().includes(cleanQuery)
    );
  });

  // Paginate notes list
  const paginatedNotes = filteredNotes.slice(
    (currentPage - 1) * 15,
    currentPage * 15
  );

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(lang === "es" ? "es-ES" : "en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0B0F19]">
      {/* Header Panel */}
      <div className="h-20 border-b border-slate-900/60 px-6 sm:px-8 flex items-center justify-between gap-4 flex-shrink-0 bg-[#090C15]/40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <BrainCircuit className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-slate-100 text-sm sm:text-base leading-none">
              {t("notes_title")}
            </h2>
            <span className="text-3xs font-semibold text-slate-500 tracking-wider uppercase mt-1 block">
              {lang === "es" ? "Memos Rápidos y Pósits" : "Quick Memos & Post-its"}
            </span>
          </div>
        </div>

        {/* Search Notes & Create Button */}
        <div className="flex items-center gap-3 flex-1 max-w-lg justify-end">
          {/* Search Input */}
          <div className="relative flex-1 max-w-xs hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-550" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("notes_search")}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950/80 border border-slate-850 focus:border-violet-600 text-slate-200 placeholder-slate-600 rounded-xl text-xs focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-4xs text-slate-500 hover:text-slate-300"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <button
            onClick={handleOpenNewEditor}
            className="flex items-center gap-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium py-1.5 px-3 rounded-xl text-xs transition-all shadow-md cursor-pointer flex-shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("notes_new_btn")}
          </button>
        </div>
      </div>

      {/* Mobile Search Bar */}
      <div className="p-4 sm:hidden border-b border-slate-900/40 bg-slate-950/20">
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-650" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("notes_search")}
            className="w-full pl-10 pr-8 py-2 bg-slate-900 border border-slate-800 text-slate-200 placeholder-slate-650 rounded-xl text-sm focus:outline-none"
          />
        </div>
      </div>

      {/* Sticky Notes Grid Board */}
      <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar">
        {filteredNotes.length === 0 ? (
          <div className="h-[350px] flex flex-col items-center justify-center text-center border border-dashed border-slate-800/80 rounded-3xl bg-slate-900/10 p-8">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-855 flex items-center justify-center mb-4 text-slate-500">
              <BrainCircuit className="h-6 w-6" />
            </div>
            <h3 className="font-semibold text-slate-300">
              {lang === "es" ? "No hay notas mentales" : "No mental notes"}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-sm mt-1.5">
              {searchQuery
                ? (lang === "es" ? "Ninguna nota coincide con tu búsqueda." : "No notes match your search.")
                : (lang === "es" ? "Agrega tu primera nota rápida presionando el botón 'Nueva Nota' arriba." : "Add your first quick note by pressing the 'New Note' button above.")}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {paginatedNotes.map((note) => {
                const theme = colorsConfig[note.color || "yellow"] || colorsConfig.yellow;
                return (
                  <div
                    key={note.id}
                    className={`group flex flex-col justify-between p-5 rounded-2xl border transition-all duration-300 shadow-md ${theme.bg} ${theme.border}`}
                  >
                    <div>
                      {/* Sticky Note Top */}
                      <div className="flex items-start justify-between gap-3 mb-2.5">
                        <h3 className="font-bold text-slate-100 group-hover:text-violet-300 transition-colors line-clamp-2 text-sm leading-snug">
                          {note.title || t("notes_untitled")}
                        </h3>
                        {/* Color marker dot */}
                        <span className={`w-2 h-2 rounded-full ${theme.dot} flex-shrink-0 mt-1.5`}></span>
                      </div>

                      {/* Content text */}
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-wrap break-words line-clamp-8 mb-4">
                        {note.content || t("notes_no_content")}
                      </p>
                    </div>

                    {/* Note Footer Info & Edit/Delete actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-800/40">
                      <span className="text-3xs text-slate-500 flex items-center gap-1 font-mono">
                        <Calendar className="h-3 w-3" />
                        {formatDate(note.created_at)}
                      </span>
                      <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleOpenEditEditor(note)}
                          className="p-1 rounded text-slate-400 hover:text-violet-400 hover:bg-slate-800 transition-all cursor-pointer"
                          title={lang === "es" ? "Editar nota" : "Edit note"}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(note.id!)}
                          className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-slate-800 transition-all cursor-pointer"
                          title={lang === "es" ? "Eliminar nota" : "Delete note"}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <Pagination
              currentPage={currentPage}
              totalItems={filteredNotes.length}
              itemsPerPage={15}
              onPageChange={setCurrentPage}
              lang={lang}
            />
          </>
        )}
      </div>

      {/* Editor Sidebar / Modal Overlay */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/40 mb-4">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-violet-400" />
                {editNote ? (lang === "es" ? "Editar Nota Mental" : "Edit Mental Note") : (lang === "es" ? "Nueva Nota Mental" : "New Mental Note")}
              </h3>
              <button
                onClick={() => setIsEditorOpen(false)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-850 transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col gap-4">
              {/* Title input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{t("notes_field_title")}:</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={lang === "es" ? "ej. Ideas de negocio o Lista de compras" : "e.g. Business ideas or Shopping list"}
                  required
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-violet-500/50"
                />
              </div>

              {/* Content textarea */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{lang === "es" ? "Contenido de la nota:" : "Note content:"}</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={lang === "es" ? "Escribe tus notas, recordatorios o tareas pendientes aquí..." : "Write your notes, reminders or pending tasks here..."}
                  required
                  rows={6}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-violet-500/50 resize-none"
                />
              </div>

              {/* Color selector picker */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{t("notes_select_color")}:</label>
                <div className="flex gap-2">
                  {Object.keys(colorsConfig).map((c) => {
                    const cfg = colorsConfig[c];
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSelectedColor(c)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all border-2 cursor-pointer ${
                          selectedColor === c ? "border-slate-100 scale-110" : "border-transparent"
                        } ${cfg.dot}`}
                        title={lang === "es" ? cfg.label : c.charAt(0).toUpperCase() + c.slice(1)}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Actions submit */}
              <div className="flex gap-2 justify-end pt-3 border-t border-slate-800/40 mt-2">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 border border-slate-800 hover:bg-slate-850 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
                >
                  {t("modal_cancel")}
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer shadow-md shadow-violet-950/20"
                >
                  <Save className="h-3.5 w-3.5" />
                  {t("modal_save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
