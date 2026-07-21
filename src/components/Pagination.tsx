import { Language } from "../translations";

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  lang: Language;
}

export default function Pagination({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  lang,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  if (totalItems === 0) return null;

  const getPages = () => {
    const pages: (number | string)[] = [];
    
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, "...", totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="bg-[#070A13]/80 border border-slate-900 px-4 py-2 rounded-2xl flex items-center gap-1.5 justify-center mt-6 w-fit mx-auto shadow-lg shadow-black/20 select-none">
      {/* Previous Button */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3.5 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1 active:scale-98"
      >
        <span>&lt;</span>
        <span>{lang === "es" ? "Anterior" : "Previous"}</span>
      </button>

      {/* Page Numbers */}
      {getPages().map((page, idx) => {
        if (page === "...") {
          return (
            <span
              key={`ellipsis-${idx}`}
              className="w-9 h-9 flex items-center justify-center text-xs text-slate-500 font-semibold select-none"
            >
              ...
            </span>
          );
        }

        const isPageActive = page === currentPage;

        return (
          <button
            key={`page-${page}`}
            onClick={() => onPageChange(page as number)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all cursor-pointer active:scale-95 ${
              isPageActive
                ? "text-white bg-violet-600 border border-violet-500 shadow-md shadow-violet-950/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-800 hover:border-slate-700"
            }`}
          >
            {page}
          </button>
        );
      })}

      {/* Next Button */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3.5 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1 active:scale-98"
      >
        <span>{lang === "es" ? "Siguiente" : "Next"}</span>
        <span>&gt;</span>
      </button>
    </div>
  );
}
