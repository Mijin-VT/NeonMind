import React, { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Link } from "../db";
import { Language, translations } from "../translations";

interface LinkModalProps {
  isOpen: boolean;
  lang: Language;
  onClose: () => void;
  onSave: (linkData: Omit<Link, "id" | "created_at"> & { id?: number }) => Promise<void>;
  linkToEdit?: Link | null;
  existingCategories: string[];
  parentIdForNewSubLink?: number | null;
  allLinks: Link[];
}

export default function LinkModal({
  isOpen,
  lang,
  onClose,
  onSave,
  linkToEdit,
  existingCategories,
  parentIdForNewSubLink,
  allLinks,
}: LinkModalProps) {
  const t = (key: keyof typeof translations["es"]) => translations[lang][key];
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");
  const [customCategory, setCustomCategory] = useState("");
  const [useCustomCategory, setUseCustomCategory] = useState(false);
  const [parentId, setParentId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const defaultCategories = ["General", "Trabajo", "Estudios", "Personal", "Entretenimiento", "Utilidades"];
  const categoriesList = Array.from(
    new Set([...defaultCategories, ...existingCategories.filter(Boolean)])
  );

  useEffect(() => {
    if (linkToEdit) {
      setTitle(linkToEdit.title);
      setUrl(linkToEdit.url);
      setDescription(linkToEdit.description || "");
      setParentId(linkToEdit.parent_id || null);
      if (defaultCategories.includes(linkToEdit.category)) {
        setCategory(linkToEdit.category);
        setUseCustomCategory(false);
      } else {
        setCategory("Custom");
        setCustomCategory(linkToEdit.category);
        setUseCustomCategory(true);
      }
    } else {
      setTitle("");
      setUrl("");
      setDescription("");
      setParentId(parentIdForNewSubLink || null);
      setCategory("General");
      setCustomCategory("");
      setUseCustomCategory(false);
    }
    setError("");
  }, [linkToEdit, isOpen, parentIdForNewSubLink]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!url.trim()) {
      setError(lang === "es" ? "La URL es obligatoria." : "URL is required.");
      return;
    }

    // Add protocol if missing
    let formattedUrl = url.trim();
    
    // Check if it is a local file/folder path (Windows drive, UNC share, or file:///)
    const isLocalPath = 
      /^[a-zA-Z]:\\/i.test(formattedUrl) || 
      /^[a-zA-Z]:\//i.test(formattedUrl) || 
      formattedUrl.startsWith("\\\\") || 
      formattedUrl.startsWith("file:///");
      
    // Check if it has a scheme (like mailto:, steam:, magnet:, http:, https:, etc.)
    // Avoid prepending if the colon is followed by a port number (e.g. localhost:3000)
    const hasScheme = /^[a-zA-Z][a-zA-Z0-9+-.]*:(?!\d+)/i.test(formattedUrl);

    if (!isLocalPath && !hasScheme) {
      formattedUrl = `https://${formattedUrl}`;
    }

    let finalTitle = title.trim();
    if (!finalTitle) {
      // Auto-fill title with domain name or directory name if empty
      try {
        if (isLocalPath) {
          const parts = formattedUrl.split(/[/\\]/);
          finalTitle = parts.filter(Boolean).pop() || formattedUrl;
        } else {
          const parsed = new URL(formattedUrl);
          finalTitle = parsed.hostname.replace("www.", "");
        }
      } catch {
        finalTitle = formattedUrl;
      }
    }

    const finalCategory = useCustomCategory
      ? customCategory.trim() || "General"
      : category;

    await onSave({
      id: linkToEdit?.id,
      title: finalTitle,
      url: formattedUrl,
      description: description.trim(),
      category: finalCategory,
      favorite: linkToEdit?.favorite || 0,
      parent_id: parentId,
    });

    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal forceMount>
            {/* Modal Overlay */}
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
              >
                {/* Modal Content */}
                <Dialog.Content asChild>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 15 }}
                    transition={{ type: "spring", duration: 0.4 }}
                    className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100 focus:outline-none"
                  >
                    <Dialog.Title className="text-xl font-semibold text-slate-50 flex items-center gap-2">
                      {linkToEdit ? t("modal_edit_title") : t("modal_add_title")}
                    </Dialog.Title>
                    <Dialog.Description className="text-sm text-slate-400 mt-1 mb-6">
                      {lang === "es" ? "Rellena la información del enlace. Los links se guardan de forma segura localmente en tu sistema." : "Fill in the link details. Links are saved securely locally on your system."}
                    </Dialog.Description>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      {error && (
                        <div className="text-sm font-medium text-rose-400 bg-rose-950/40 border border-rose-900/50 p-3 rounded-lg">
                          {error}
                        </div>
                      )}

                      {/* URL input */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          {t("modal_field_url")} *
                        </label>
                        <input
                          type="text"
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          placeholder="ej. github.com o https://google.com"
                          className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-600 transition-colors"
                          required
                        />
                      </div>

                      {/* Title input */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          {t("modal_field_title")} ({lang === "es" ? "Opcional" : "Optional"})
                        </label>
                        <input
                          type="text"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="ej. Repositorio del proyecto"
                          className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-600 transition-colors"
                        />
                      </div>

                      {/* Description input */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          {t("modal_field_description")} ({lang === "es" ? "Opcional" : "Optional"})
                        </label>
                        <textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="ej. Notas rápidas sobre lo que contiene este link..."
                          rows={3}
                          className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 resize-none focus:outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-600 transition-colors"
                        />
                      </div>

                      {/* Category selector */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          {t("modal_field_category")}
                        </label>
                        <div className="flex gap-2">
                          {!useCustomCategory ? (
                            <select
                              value={category}
                              onChange={(e) => {
                                if (e.target.value === "Custom") {
                                  setUseCustomCategory(true);
                                } else {
                                  setCategory(e.target.value);
                                }
                              }}
                              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-600 transition-colors"
                            >
                              {categoriesList.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                              <option value="Custom">{lang === "es" ? "+ Nueva Categoría..." : "+ New Category..."}</option>
                            </select>
                          ) : (
                            <div className="flex gap-2 w-full">
                              <input
                                type="text"
                                value={customCategory}
                                onChange={(e) => setCustomCategory(e.target.value)}
                                placeholder={lang === "es" ? "Nombre de categoría" : "Category name"}
                                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-600 transition-colors"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => setUseCustomCategory(false)}
                                className="px-3 bg-slate-800 border border-slate-700 hover:bg-slate-750 text-slate-300 rounded-lg text-sm transition-colors"
                              >
                                {t("modal_cancel")}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Parent selection (Folder) */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          {lang === "es" ? "Ubicación (Carpeta contenedora)" : "Location (Container Folder)"}
                        </label>
                        <select
                          value={parentId || ""}
                          onChange={(e) => setParentId(e.target.value ? parseInt(e.target.value) : null)}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-600 transition-colors"
                        >
                          <option value="">{lang === "es" ? "Principal (Ninguna)" : "Main (None)"}</option>
                          {allLinks.filter(l => !l.parent_id && l.id !== linkToEdit?.id).map((p) => (
                            <option key={p.id} value={p.id}>
                              📁 {p.title || p.url}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Actions */}
                      <div className="flex justify-end gap-3 pt-4">
                        <Dialog.Close asChild>
                          <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                          >
                            {t("modal_cancel")}
                          </button>
                        </Dialog.Close>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-lg text-sm font-medium transition-all shadow-md cursor-pointer"
                        >
                          {t("modal_save")}
                        </button>
                      </div>
                    </form>

                    {/* Close button icon */}
                    <Dialog.Close asChild>
                      <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all cursor-pointer"
                        aria-label={lang === "es" ? "Cerrar" : "Close"}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </Dialog.Close>
                  </motion.div>
                </Dialog.Content>
              </motion.div>
            </Dialog.Overlay>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
