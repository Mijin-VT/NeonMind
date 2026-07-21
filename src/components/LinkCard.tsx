import { useState } from "react";
import { Heart, Trash2, Edit2, Copy, ExternalLink, Calendar, FolderOpen, FolderPlus } from "lucide-react";
import { Link } from "../db";
import { openUrl, openPath } from "@tauri-apps/plugin-opener";
import { Language, translations } from "../translations";

interface LinkCardProps {
  link: Link;
  lang: Language;
  onDelete: (id: number) => Promise<void>;
  onToggleFavorite: (id: number, favorite: boolean) => Promise<void>;
  onEdit: (link: Link) => void;
  isSubLink?: boolean;
  subLinks?: Link[];
  onAddSubLink?: (parentId: number) => void;
  onOpenFolder?: (id: number) => void;
}

export default function LinkCard({
  link,
  lang,
  onDelete,
  onToggleFavorite,
  onEdit,
  isSubLink = false,
  subLinks = [],
  onAddSubLink,
  onOpenFolder,
}: LinkCardProps) {
  const t = (key: keyof typeof translations["es"]) => translations[lang][key];
  const [copied, setCopied] = useState(false);

  // Extract domain for favicon and clean URL display
  let domain = "";
  let isLocal = false;
  try {
    isLocal = 
      /^[a-zA-Z]:\\/i.test(link.url) || 
      /^[a-zA-Z]:\//i.test(link.url) || 
      link.url.startsWith("\\\\") || 
      link.url.startsWith("file:///");
      
    if (isLocal) {
      domain = lang === "es" ? "Ruta local" : "Local path";
    } else {
      const urlObj = new URL(link.url);
      domain = urlObj.hostname;
    }
  } catch {
    domain = link.url;
  }

  const handleOpenLink = async () => {
    try {
      if (isLocal) {
        let cleanPath = link.url.trim();
        if (cleanPath.startsWith("file:///")) {
          cleanPath = decodeURIComponent(cleanPath.replace("file:///", ""));
        }
        await openPath(cleanPath);
      } else {
        await openUrl(link.url);
      }
    } catch (err) {
      console.error("Failed to open link:", err);
    }
  };

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  // Nice tag colors based on category string hash
  const getCategoryColor = (cat: string) => {
    const c = cat.toLowerCase().trim();
    if (c === "trabajo") return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    if (c === "estudios") return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    if (c === "personal") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (c === "entretenimiento") return "bg-pink-500/10 text-pink-400 border-pink-500/20";
    if (c === "utilidades") return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
    return "bg-violet-500/10 text-violet-400 border-violet-500/20";
  };

  // Format date readable
  const formattedDate = () => {
    try {
      const date = new Date(link.created_at);
      return date.toLocaleDateString(lang === "es" ? "es-ES" : "en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  return (
    <div
      onClick={() => {
        if (!isSubLink && subLinks.length > 0 && onOpenFolder) {
          onOpenFolder(link.id!);
        }
      }}
      className={`group relative bg-slate-900 border rounded-2xl flex flex-col justify-between transition-all duration-300 select-none ${
        isSubLink 
          ? "p-3 border-slate-800/40 hover:border-violet-500/20 bg-slate-950/20 w-[150px] min-w-[150px] max-w-[150px]" 
          : subLinks.length > 0
            ? "p-3.5 border-slate-800/80 hover:border-violet-600/45 hover:shadow-xl hover:shadow-violet-950/30 cursor-pointer w-[190px] h-[190px] min-w-[190px] max-w-[190px] min-h-[190px] max-h-[190px]"
            : "p-3.5 border-slate-800/80 hover:border-violet-500/40 hover:shadow-xl hover:shadow-violet-950/20 w-[190px] h-[190px] min-w-[190px] max-w-[190px] min-h-[190px] max-h-[190px]"
      }`}
    >
      <div>
        {/* Top Header Card */}
        <div className={`flex items-start justify-between gap-1 mb-1.5`}>
          <div className="flex items-center gap-1.5 min-w-0">
            {/* Favicon Icon */}
            <div className={`rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center flex-shrink-0 overflow-hidden ${isSubLink ? "w-6 h-6" : "w-7.5 h-7.5"}`}>
              {isLocal ? (
                <FolderOpen className={isSubLink ? "h-3 w-3 text-violet-400" : "h-4 w-4 text-violet-400"} />
              ) : (
                <img
                  src={`https://www.google.com/s2/favicons?sz=64&domain=${domain}`}
                  alt=""
                  className={`${isSubLink ? "w-3 h-3" : "w-4.5 h-4.5"} object-contain fallback-image`}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/vite.svg"; // Fallback icon
                  }}
                />
              )}
            </div>
            <div className="min-w-0">
              <h3 className={`font-bold text-slate-100 group-hover:text-violet-300 transition-colors truncate leading-tight ${isSubLink ? "text-2xs" : "text-xs"}`}>
                {link.title}
              </h3>
              <p className="text-[8px] text-slate-500 truncate mt-0.5">{domain}</p>
            </div>
          </div>

          {/* Action Row right */}
          <div className="flex items-center opacity-65 group-hover:opacity-100 transition-opacity gap-0.5">
            {!isSubLink && onAddSubLink && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddSubLink(link.id!);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-violet-400 hover:bg-slate-800 transition-colors cursor-pointer"
                title={lang === "es" ? "Agregar sub-link" : "Add sub-link"}
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(link.id!, link.favorite === 0);
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-800 transition-colors cursor-pointer"
              title={link.favorite ? (lang === "es" ? "Quitar de favoritos" : "Remove from favorites") : (lang === "es" ? "Marcar como favorito" : "Mark as favorite")}
            >
              <Heart
                className={`transition-transform active:scale-125 h-3.5 w-3.5 ${
                  link.favorite ? "fill-rose-500 text-rose-500" : ""
                }`}
              />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(link);
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-violet-400 hover:bg-slate-800 transition-colors cursor-pointer"
              title={lang === "es" ? "Editar link" : "Edit link"}
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(link.id!);
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
              title={lang === "es" ? "Eliminar link" : "Delete link"}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Category & Date */}
        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
          <span
            className={`font-medium rounded-full border ${getCategoryColor(
              link.category
            )} text-[8px] px-1.5 py-0`}
          >
            {link.category}
          </span>
          {formattedDate() && (
            <span className="text-slate-500 flex items-center gap-0.5 text-[8px]">
              <Calendar className="h-2.5 w-2.5" />
              {formattedDate()}
            </span>
          )}
        </div>

        {/* Description */}
        <p className={`text-slate-400 leading-normal break-words ${isSubLink ? "text-[8px] line-clamp-1 mb-1.5 min-h-0" : "text-[10px] line-clamp-1 mb-2.5 min-h-0"}`}>
          {link.description || (
            <span className="italic text-slate-600 text-[9px]">{t("no_description")}...</span>
          )}
        </p>

        {/* Folder 2x2 Thumbnail Grid Preview */}
        {!isSubLink && subLinks && subLinks.length > 0 && (
          <div className="mt-1.5 pt-1.5 border-t border-slate-800/40 space-y-1.5">
            <div className="grid grid-cols-2 gap-1 w-16 h-16 mx-auto bg-slate-950/40 p-1 rounded-xl border border-slate-900/60 shadow-inner">
              {subLinks.slice(0, 3).map((sub) => {
                let subDomain = "";
                try {
                  subDomain = new URL(sub.url).hostname.replace("www.", "");
                } catch {
                  subDomain = "vite.svg";
                }
                return (
                  <div key={sub.id} className="bg-slate-900 border border-slate-850/40 rounded-lg flex items-center justify-center overflow-hidden p-0.5 shadow-sm">
                    <img
                      src={`https://www.google.com/s2/favicons?sz=64&domain=${subDomain}`}
                      alt=""
                      className="w-3.5 h-3.5 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/vite.svg";
                      }}
                    />
                  </div>
                );
              })}
              {subLinks.length > 3 ? (
                <div className="bg-slate-900 border border-slate-850/40 rounded-lg flex items-center justify-center text-slate-400 font-extrabold text-[8px] select-none">
                  +{subLinks.length - 3}
                </div>
              ) : subLinks[3] ? (
                <div className="bg-slate-900 border border-slate-850/40 rounded-lg flex items-center justify-center overflow-hidden p-0.5 shadow-sm">
                  <img
                    src={`https://www.google.com/s2/favicons?sz=64&domain=${(() => {
                      try { return new URL(subLinks[3].url).hostname.replace("www.", ""); } catch { return "vite.svg"; }
                    })()}`}
                    alt=""
                    className="w-3.5 h-3.5 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/vite.svg";
                    }}
                  />
                </div>
              ) : (
                <div className="bg-slate-900/20 border border-dashed border-slate-855/40 rounded-lg flex items-center justify-center text-slate-700 font-semibold text-[8px] select-none">
                  -
                </div>
              )}
            </div>
            <div className="text-center text-[8px] font-bold text-violet-400 group-hover:text-violet-300 transition-colors uppercase tracking-wider flex items-center justify-center gap-0.5">
              {lang === "es" ? "Ver contenido" : "View content"} →
            </div>
          </div>
        )}
      </div>

      {/* Footer / Buttons */}
      <div className={`flex items-center gap-1.5 pt-2 border-t border-slate-800/40`}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleOpenLink();
          }}
          className={`flex-1 flex items-center justify-center gap-1 bg-slate-950 hover:bg-slate-900 border border-slate-800/60 hover:border-violet-600/30 text-slate-200 hover:text-white font-semibold py-1 px-2 rounded-lg transition-all cursor-pointer shadow-inner text-[10px]`}
        >
          <ExternalLink className="h-3 w-3" />
          {t("visit")}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleCopyLink(e);
          }}
          className={`flex-shrink-0 flex items-center justify-center p-1 rounded-lg border font-semibold transition-all cursor-pointer ${
            copied
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-slate-950 hover:bg-slate-900 border-slate-800/60 text-slate-400 hover:text-slate-200"
          } text-[10px]`}
          title={lang === "es" ? "Copiar URL al portapapeles" : "Copy URL to clipboard"}
        >
          <Copy className="h-3 w-3" />
          {copied && <span className="ml-1 text-[9px] hidden sm:inline">{lang === "es" ? "¡Copiado!" : "Copied!"}</span>}
        </button>
      </div>
    </div>
  );
}
