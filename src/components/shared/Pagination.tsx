"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

const PAGE_SIZE_OPTIONS = [15, 30, 50] as const;
const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0];
const pageSizeListeners = new Map<string, Set<() => void>>();

type UsePaginationOptions<T> = {
  items: T[];
  storageKey: string;
  resetKey?: string;
};

type PaginationProps = {
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

function getStoredPageSize(storageKey: string) {
  if (typeof window === "undefined") return DEFAULT_PAGE_SIZE;

  const stored = Number(window.localStorage.getItem(storageKey));
  return PAGE_SIZE_OPTIONS.find((option) => option === stored) ?? DEFAULT_PAGE_SIZE;
}

function subscribePageSize(storageKey: string, callback: () => void) {
  const listeners = pageSizeListeners.get(storageKey) ?? new Set<() => void>();
  listeners.add(callback);
  pageSizeListeners.set(storageKey, listeners);

  return () => {
    listeners.delete(callback);
    if (listeners.size === 0) pageSizeListeners.delete(storageKey);
  };
}

function setStoredPageSize(storageKey: string, pageSize: number) {
  window.localStorage.setItem(storageKey, String(pageSize));
  pageSizeListeners.get(storageKey)?.forEach((listener) => listener());
}

function getVisiblePages(page: number, totalPages: number) {
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  return Array.from(pages)
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b);
}

export function usePagination<T>({ items, storageKey, resetKey }: UsePaginationOptions<T>) {
  const [pagination, setPagination] = useState(() => ({
    page: 1,
    resetKey,
  }));
  const pageSize = useSyncExternalStore(
    (callback) => subscribePageSize(storageKey, callback),
    () => getStoredPageSize(storageKey),
    () => DEFAULT_PAGE_SIZE
  );

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const activePage = pagination.resetKey === resetKey ? pagination.page : 1;
  const page = Math.min(activePage, totalPages);
  const startIndex = items.length === 0 ? 0 : (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, items.length);

  const paginatedItems = useMemo(
    () => items.slice(startIndex, endIndex),
    [items, startIndex, endIndex]
  );

  const setPage = (nextPage: number) => {
    setPagination((current) => ({
      ...current,
      page: Math.min(Math.max(nextPage, 1), totalPages),
      resetKey,
    }));
  };

  const setPageSize = (nextPageSize: number) => {
    if (PAGE_SIZE_OPTIONS.some((option) => option === nextPageSize)) {
      setStoredPageSize(storageKey, nextPageSize);
      setPagination((current) => ({
        ...current,
        page: 1,
        resetKey,
      }));
    }
  };

  return {
    page,
    pageSize,
    totalPages,
    startItem: items.length === 0 ? 0 : startIndex + 1,
    endItem: endIndex,
    paginatedItems,
    setPage,
    setPageSize,
  };
}

export function Pagination({
  totalItems,
  page,
  pageSize,
  totalPages,
  itemLabel,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  if (totalItems === 0) return null;

  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalItems);
  const visiblePages = getVisiblePages(page, totalPages);

  return (
    <div className="pagination-footer">
      <div className="pagination-summary">
        Mostrando {startItem}-{endItem} de {totalItems} {itemLabel}
      </div>
      <div className="pagination-controls">
        <label className="pagination-size-label" htmlFor={`page-size-${itemLabel}`}>
          Ver
        </label>
        
        <button
          type="button"
          className="btn-page"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="Página anterior"
        >
          &lt;
        </button>
        {visiblePages.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            className={`btn-page ${pageNumber === page ? "active" : ""}`}
            onClick={() => onPageChange(pageNumber)}
            aria-current={pageNumber === page ? "page" : undefined}
          >
            {pageNumber}
          </button>
        ))}
        <button
          type="button"
          className="btn-page"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          aria-label="Página siguiente"
        >
          &gt;
        </button>
        <select
          id={`page-size-${itemLabel}`}
          className="pagination-size"
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
        >
          {PAGE_SIZE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <style jsx>{`
        .pagination-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          border-top: 1px solid var(--border);
          padding: 1rem 0.5rem 0.25rem 0.5rem;
          margin-top: 1rem;
          color: var(--text-muted);
          font-size: 0.75rem;
          font-weight: 600;
          flex-wrap: wrap;
        }

        .pagination-controls {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          flex-wrap: wrap;
        }

        .pagination-size-label {
          color: var(--text-subtle);
          font-size: 0.6875rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .pagination-size {
          height: 28px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--bg-subtle);
          color: var(--text);
          padding: 0 1.75rem 0 0.5rem;
          font-size: 0.75rem;
          font-weight: 700;
          outline: none;
        }

        .btn-page {
          min-width: 28px;
          height: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: transparent;
          color: var(--text-muted);
          font-family: var(--font-mono);
          font-size: 0.6875rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 150ms var(--ease-out);
        }

        .btn-page.active {
          background: var(--accent);
          border-color: var(--accent);
          color: var(--accent-fg);
        }

        .btn-page:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .btn-page:not(:disabled, .active):hover {
          background: var(--surface-hover);
          border-color: var(--border-strong);
          color: var(--text);
        }
      `}</style>
    </div>
  );
}
