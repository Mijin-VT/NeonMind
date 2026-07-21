import { useEffect, useState } from "react";
import {
  Link,
  getLinks,
  addLink,
  updateLink,
  deleteLink,
  toggleFavorite,
} from "./db";
import LinkCard from "./components/LinkCard";
import LinkModal from "./components/LinkModal";
import Pagination from "./components/Pagination";
import {
  Search,
  Plus,
  Heart,
  Folder,
  ArrowLeft,
  Sparkles,
  Link2,
  Download,
  Upload,
  BrainCircuit,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { save, open as openDialog } from "@tauri-apps/plugin-dialog";
import MentalNotes from "./components/MentalNotes";
import LilyChat from "./components/LilyChat";
import { Language, translations } from "./translations";
import "./App.css";

export default function App() {
  const [links, setLinks] = useState<Link[]>([]);
  const [lang, setLang] = useState<Language>(() => (localStorage.getItem("app_lang") as Language) ?? "es");
  const t = (key: keyof typeof translations["es"]) => translations[lang][key];

  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [linkToEdit, setLinkToEdit] = useState<Link | null>(null);
  const [parentIdForNewSubLink, setParentIdForNewSubLink] = useState<number | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentFolderPage, setCurrentFolderPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"boveda" | "notes" | "lily">(() => {
    const saved = localStorage.getItem("app_active_tab");
    return (saved as any) ?? "lily";
  });

  // Load links from SQLite on mount
  useEffect(() => {
    loadLinks();
  }, []);

  // Reset pages when query, category, or folder changes
  useEffect(() => {
    setCurrentPage(1);
    setCurrentFolderPage(1);
  }, [searchQuery, selectedCategory, currentFolderId]);

  // Persist active tab to prevent losing focus on reload/HMR
  useEffect(() => {
    localStorage.setItem("app_active_tab", activeTab);
  }, [activeTab]);

  const loadLinks = async () => {
    const data = await getLinks();
    setLinks(data);
  };

  const handleSaveLink = async (linkData: Omit<Link, "id" | "created_at"> & { id?: number }) => {
    let success = false;
    if (linkData.id !== undefined) {
      // Update link
      const existing = links.find((l) => l.id === linkData.id);
      if (existing) {
        success = await updateLink({
          ...existing,
          ...linkData,
          id: linkData.id,
        });
      }
    } else {
      // Add new link
      success = await addLink({
        title: linkData.title,
        url: linkData.url,
        description: linkData.description,
        category: linkData.category,
        favorite: linkData.favorite,
        parent_id: linkData.parent_id,
      });
    }

    if (success) {
      await loadLinks();
    }
  };

  const handleDeleteLink = async (id: number) => {
    if (confirm(t("confirm_delete_link"))) {
      // Programmatically delete sub-links first to prevent orphans (ensures cascade delete works even if PRAGMA foreign_keys is off)
      const subLinks = links.filter((l) => l.parent_id === id);
      for (const sub of subLinks) {
        if (sub.id !== undefined) {
          await deleteLink(sub.id);
        }
      }
      const success = await deleteLink(id);
      if (success) {
        await loadLinks();
      }
    }
  };

  const handleToggleFavorite = async (id: number, favorite: boolean) => {
    const success = await toggleFavorite(id, favorite);
    if (success) {
      await loadLinks();
    }
  };

  const handleEditLink = (link: Link) => {
    setLinkToEdit(link);
    setIsModalOpen(true);
  };

  const handleExportDb = async () => {
    try {
      const filePath = await save({
        title: t("export_db"),
        defaultPath: "respaldo_links.db",
        filters: [{
          name: "SQLite Database",
          extensions: ["db"]
        }]
      });

      if (filePath) {
        await invoke("export_database", { destPath: filePath });
        alert(t("export_success"));
      }
    } catch (err) {
      console.error("Error exporting database:", err);
      alert("Error: " + err);
    }
  };

  const handleImportDb = async () => {
    try {
      const filePath = await openDialog({
        title: t("import_db"),
        multiple: false,
        directory: false,
        filters: [{
          name: "SQLite Database",
          extensions: ["db"]
        }]
      });

      if (filePath && !Array.isArray(filePath)) {
        if (confirm(t("confirm_import"))) {
          await invoke("import_database", { srcPath: filePath });
          alert(t("import_success"));
          window.location.reload();
        }
      }
    } catch (err) {
      console.error("Error importing database:", err);
      alert("Error: " + err);
    }
  };

  // Get dynamic categories list from existing links
  const existingCategories = Array.from(
    new Set(links.map((link) => link.category).filter(Boolean))
  );

  // Filter links based on sidebar selection and search query
  const filteredLinks = links.filter((link) => {
    // Only display top-level links in the main grid
    if (link.parent_id) return false;

    const subLinks = links.filter((l) => l.parent_id === link.id);

    // 1. Sidebar category filter
    const matchesCategory =
      selectedCategory === "Todos" ||
      (selectedCategory === "Favoritos" && (link.favorite === 1 || subLinks.some(sl => sl.favorite === 1))) ||
      link.category === selectedCategory ||
      subLinks.some(sl => sl.category === selectedCategory);

    // 2. Search query filter
    const cleanQuery = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !cleanQuery ||
      link.title.toLowerCase().includes(cleanQuery) ||
      link.url.toLowerCase().includes(cleanQuery) ||
      (link.description && link.description.toLowerCase().includes(cleanQuery)) ||
      subLinks.some(sl => 
        sl.title.toLowerCase().includes(cleanQuery) ||
        sl.url.toLowerCase().includes(cleanQuery) ||
        (sl.description && sl.description.toLowerCase().includes(cleanQuery))
      );

    return matchesCategory && matchesSearch;
  });

  // Paginate standard view links
  const totalPages = Math.max(1, Math.ceil(filteredLinks.length / 15));
  const paginatedLinks = filteredLinks.slice(
    (currentPage - 1) * 15,
    currentPage * 15
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [filteredLinks.length, totalPages, currentPage]);

  // Paginate folder sub-links
  const folderSubLinks = links
    .filter((l) => l.parent_id === currentFolderId)
    .filter((link) => {
      const cleanQuery = searchQuery.toLowerCase().trim();
      return (
        !cleanQuery ||
        link.title.toLowerCase().includes(cleanQuery) ||
        link.url.toLowerCase().includes(cleanQuery) ||
        (link.description && link.description.toLowerCase().includes(cleanQuery))
      );
    });

  const totalFolderPages = Math.max(1, Math.ceil(folderSubLinks.length / 15));
  const paginatedFolderLinks = folderSubLinks.slice(
    (currentFolderPage - 1) * 15,
    currentFolderPage * 15
  );

  useEffect(() => {
    if (currentFolderPage > totalFolderPages) {
      setCurrentFolderPage(totalFolderPages);
    }
  }, [folderSubLinks.length, totalFolderPages, currentFolderPage]);

  // Calculate counts for sidebar categories
  const getCategoryCount = (cat: string) => {
    if (cat === "Todos") return links.length;
    if (cat === "Favoritos") return links.filter((l) => l.favorite === 1).length;
    return links.filter((l) => l.category === cat).length;
  };

  return (
    <div className="min-h-screen flex text-slate-100 bg-[#0B0F19] font-sans antialiased overflow-hidden selection:bg-violet-500/35 selection:text-white">
      {/* SIDEBAR */}
      <aside className="w-56 lg:w-64 bg-[#070A12] border-r border-slate-900 flex flex-col justify-between flex-shrink-0">
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Logo & Title */}
          <div className="p-6 flex items-center gap-2.5 border-b border-slate-900/60">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Link2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-extrabold text-slate-100 text-sm tracking-wide leading-none uppercase">
                NeonMind
              </h1>
              <p className="text-3xs text-slate-500 font-semibold tracking-wider uppercase mt-1">
                Bóveda & AI
              </p>
            </div>
          </div>

          {/* Secciones (Tabs) */}
          <div className="px-4 py-4 border-b border-slate-900/40">
            <h2 className="px-3 text-3xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              {t("sections")}
            </h2>
            <div className="space-y-1">
              <button
                onClick={() => { setActiveTab("lily"); setCurrentFolderId(null); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all border cursor-pointer ${
                  activeTab === "lily"
                    ? "bg-violet-600/15 text-violet-300 border-violet-600/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900 border-transparent"
                }`}
              >
                <Sparkles className="h-4 w-4 text-violet-400" />
                {t("tab_lily")}
              </button>
              <button
                onClick={() => { setActiveTab("boveda"); setCurrentFolderId(null); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all border cursor-pointer ${
                  activeTab === "boveda"
                    ? "bg-violet-600/15 text-violet-300 border-violet-600/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900 border-transparent"
                }`}
              >
                <Link2 className="h-4 w-4" />
                {t("tab_boveda")}
              </button>
              <button
                onClick={() => { setActiveTab("notes"); setCurrentFolderId(null); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all border cursor-pointer ${
                  activeTab === "notes"
                    ? "bg-violet-600/15 text-violet-300 border-violet-600/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900 border-transparent"
                }`}
              >
                <BrainCircuit className="h-4 w-4" />
                {t("tab_notes")}
              </button>
            </div>
          </div>

          {activeTab === "boveda" && (
            <>
              {/* Quick Filters */}
              <div className="px-4 py-4 space-y-1">
                <h2 className="px-3 text-3xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  {t("sections")}
                </h2>
                <button
                  onClick={() => { setSelectedCategory("Todos"); setCurrentFolderId(null); }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                    selectedCategory === "Todos" && activeTab === "boveda"
                      ? "bg-violet-600/15 text-violet-300 border border-violet-600/20"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Folder className="h-4 w-4 text-violet-400" />
                    {t("cat_all")}
                  </span>
                  <span className="text-xs bg-slate-950 border border-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
                    {getCategoryCount("Todos")}
                  </span>
                </button>

                <button
                  onClick={() => { setSelectedCategory("Favoritos"); setCurrentFolderId(null); }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                    selectedCategory === "Favoritos"
                      ? "bg-rose-500/10 text-rose-300 border border-rose-500/20"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Heart className="h-4 w-4" />
                    {t("cat_favorites")}
                  </span>
                  <span className="text-xs bg-slate-950 border border-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
                    {getCategoryCount("Favoritos")}
                  </span>
                </button>
              </div>



              {/* Backup Section */}
              <div className="px-4 py-3 border-t border-slate-900/40">
                <h2 className="px-3 text-3xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  {t("db_section")}
                </h2>
                <div className="space-y-1">
                  <button
                    onClick={handleExportDb}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 transition-all border border-transparent cursor-pointer text-left"
                  >
                    <Download className="h-3.5 w-3.5 text-violet-400" />
                    {t("export_db")}
                  </button>
                  <button
                    onClick={handleImportDb}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 transition-all border border-transparent cursor-pointer text-left"
                  >
                    <Upload className="h-3.5 w-3.5 text-violet-400" />
                    {t("import_db")}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Sidebar */}
        <div className="p-4 border-t border-slate-900/60 bg-[#06080F]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-850 flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-4 w-4 text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-300 truncate">
                Tauri 2 + SQLite
              </p>
              <p className="text-3xs text-slate-500 truncate">
                {t("active_persistence")}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className={`flex-1 flex min-w-0 ${activeTab === "notes" ? "" : "hidden"}`}>
        <MentalNotes lang={lang} />
      </div>

      <div className={`flex-1 flex min-w-0 ${activeTab === "lily" ? "" : "hidden"}`}>
        <LilyChat lang={lang} setLang={setLang} />
      </div>

      <main className={`flex-1 flex flex-col min-w-0 bg-[#0B0F19] ${activeTab === "boveda" ? "" : "hidden"}`}>
        {currentFolderId === null ? (
          <>
            {/* HEADER BAR */}
            <header className="h-18 border-b border-slate-900/60 px-6 sm:px-8 flex items-center justify-between gap-4 flex-shrink-0 bg-[#090C15]/40 backdrop-blur-md">
              {/* Search bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("search_placeholder")}
                  className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-850 hover:border-slate-800 focus:border-violet-600 focus:ring-1 focus:ring-violet-600 text-slate-100 placeholder-slate-550 rounded-xl text-sm transition-colors focus:outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {t("clear")}
                  </button>
                )}
              </div>

              {/* Add Link Button */}
              <button
                onClick={() => {
                  setLinkToEdit(null);
                  setParentIdForNewSubLink(null);
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium py-2 px-4 rounded-xl text-sm transition-all shadow-md shadow-violet-950/20 active:scale-98 cursor-pointer flex-shrink-0"
              >
                <Plus className="h-4 w-4" />
                {t("add_link_btn")}
              </button>
            </header>

            {/* CONTAINER FOR GRID */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar">
              {/* Section title & Category Badge */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                    {selectedCategory === "Todos" ? t("cat_all") : selectedCategory === "Favoritos" ? t("cat_favorites") : selectedCategory}
                    <span className="text-xs bg-slate-900 border border-slate-800 text-slate-400 font-normal px-2.5 py-0.5 rounded-full">
                      {filteredLinks.length} {filteredLinks.length === 1 ? "link" : "links"}
                    </span>
                  </h2>
                </div>
              </div>

              {/* links Grid */}
              <AnimatePresence mode="popLayout">
                {filteredLinks.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-[350px] flex flex-col items-center justify-center text-center border border-dashed border-slate-800/80 rounded-3xl bg-slate-900/10 p-8"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-855 flex items-center justify-center mb-4 text-slate-500">
                      <Link2 className="h-6 w-6" />
                    </div>
                    <h3 className="font-semibold text-slate-300">
                      {t("no_links_found")}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 max-w-sm mt-1.5">
                      {searchQuery || selectedCategory !== "Todos"
                        ? t("search_no_results")
                        : t("create_first_link_desc")}
                    </p>
                    {!searchQuery && selectedCategory === "Todos" && (
                      <button
                        onClick={() => {
                          setLinkToEdit(null);
                          setParentIdForNewSubLink(null);
                          setIsModalOpen(true);
                        }}
                        className="mt-5 text-xs text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {t("create_initial_link")}
                      </button>
                    )}
                  </motion.div>
                ) : (
                  <>
                    <div className="grid grid-cols-[repeat(auto-fill,190px)] gap-6">
                      {paginatedLinks.map((link) => (
                        <LinkCard
                          key={link.id}
                          link={link}
                          lang={lang}
                          subLinks={links.filter((l) => l.parent_id === link.id)}
                          onAddSubLink={(parentId) => {
                            setLinkToEdit(null);
                            setParentIdForNewSubLink(parentId);
                            setIsModalOpen(true);
                          }}
                          onOpenFolder={(folderId) => {
                            setCurrentFolderId(folderId);
                          }}
                          onDelete={handleDeleteLink}
                          onToggleFavorite={handleToggleFavorite}
                          onEdit={handleEditLink}
                        />
                      ))}
                    </div>
                    <Pagination
                      currentPage={currentPage}
                      totalItems={filteredLinks.length}
                      itemsPerPage={15}
                      onPageChange={setCurrentPage}
                      lang={lang}
                    />
                  </>
                )}
              </AnimatePresence>
            </div>
          </>
        ) : (
          <>
            {/* DRILL-DOWN FOLDER VIEW */}
            <header className="h-18 border-b border-slate-900/60 px-6 sm:px-8 flex items-center justify-between gap-4 flex-shrink-0 bg-[#090C15]/40 backdrop-blur-md">
              <div className="flex items-center gap-4 min-w-0">
                <button
                  onClick={() => setCurrentFolderId(null)}
                  className="p-2 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl transition-all cursor-pointer flex items-center justify-center"
                  title={lang === "es" ? "Volver" : "Back"}
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-slate-100 truncate">
                    {links.find(l => l.id === currentFolderId)?.title || "Carpeta"}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase mt-0.5">
                    {lang === "es" ? "Sub-enlaces" : "Sub-links"}
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setLinkToEdit(null);
                  setParentIdForNewSubLink(currentFolderId);
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium py-2 px-4 rounded-xl text-sm transition-all shadow-md shadow-violet-950/20 active:scale-98 cursor-pointer flex-shrink-0"
              >
                <Plus className="h-4 w-4" />
                {lang === "es" ? "Agregar" : "Add"}
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar flex flex-col justify-between">
              <div>
                <div className="grid grid-cols-[repeat(auto-fill,190px)] gap-6">
                  {paginatedFolderLinks.map((link) => (
                    <LinkCard
                      key={link.id}
                      link={link}
                      lang={lang}
                      onDelete={handleDeleteLink}
                      onToggleFavorite={handleToggleFavorite}
                      onEdit={handleEditLink}
                    />
                  ))}
                </div>
              </div>
              
              <Pagination
                currentPage={currentFolderPage}
                totalItems={folderSubLinks.length}
                itemsPerPage={15}
                onPageChange={setCurrentFolderPage}
                lang={lang}
              />
            </div>
          </>
        )}
      </main>

      {/* DIALOG MODAL */}
      <LinkModal
        isOpen={isModalOpen}
        lang={lang}
        onClose={() => {
          setIsModalOpen(false);
          setLinkToEdit(null);
          setParentIdForNewSubLink(null);
        }}
        onSave={handleSaveLink}
        linkToEdit={linkToEdit}
        existingCategories={existingCategories}
        parentIdForNewSubLink={parentIdForNewSubLink}
        allLinks={links}
      />
    </div>
  );
}
