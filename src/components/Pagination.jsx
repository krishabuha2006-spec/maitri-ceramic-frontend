import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

/**
 * Reusable Pagination component for table listings.
 */
export const Pagination = ({
  currentPage = 1,
  totalItems = 0,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100]
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  
  if (totalItems <= 0) return null;

  const startItem = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers with ellipses
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      let startPage = Math.max(1, currentPage - 1);
      let endPage = Math.min(totalPages, currentPage + 1);

      if (currentPage <= 3) {
        startPage = 1;
        endPage = 4;
      } else if (currentPage >= totalPages - 2) {
        startPage = totalPages - 3;
        endPage = totalPages;
      }

      if (startPage > 1) {
        pages.push(1);
        if (startPage > 2) pages.push('...');
      }

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }

      if (endPage < totalPages) {
        if (endPage < totalPages - 1) pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const handlePageClick = (page) => {
    if (typeof page === 'number' && page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '0.75rem',
      padding: '0.75rem 1rem',
      backgroundColor: '#ffffff',
      borderTop: '1px solid #e2e8f0',
      borderBottomLeftRadius: '8px',
      borderBottomRightRadius: '8px',
      fontSize: '0.8125rem',
      color: '#475569'
    }}>
      {/* Left: Info & Rows per page */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <span>
          Showing <strong>{startItem}</strong> to <strong>{endItem}</strong> of <strong>{totalItems}</strong> entries
        </span>

        {onPageSizeChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ color: '#64748b' }}>Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1); // Reset to page 1 on page size change
              }}
              style={{
                padding: '0.2rem 0.5rem',
                fontSize: '0.8125rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                backgroundColor: '#f8fafc',
                color: '#334155',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              {pageSizeOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Page Navigation Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        {/* First Page */}
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => handlePageClick(1)}
          title="First Page"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            backgroundColor: currentPage === 1 ? '#f1f5f9' : '#ffffff',
            color: currentPage === 1 ? '#94a3b8' : '#334155',
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <ChevronsLeft size={15} />
        </button>

        {/* Previous Page */}
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => handlePageClick(currentPage - 1)}
          title="Previous Page"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            backgroundColor: currentPage === 1 ? '#f1f5f9' : '#ffffff',
            color: currentPage === 1 ? '#94a3b8' : '#334155',
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <ChevronLeft size={15} />
        </button>

        {/* Page Numbers */}
        {getPageNumbers().map((p, idx) => {
          if (p === '...') {
            return (
              <span key={`ellipsis-${idx}`} style={{ padding: '0 0.25rem', color: '#94a3b8' }}>
                ...
              </span>
            );
          }

          const isActive = p === currentPage;
          return (
            <button
              key={p}
              type="button"
              onClick={() => handlePageClick(p)}
              style={{
                minWidth: '28px',
                height: '28px',
                padding: '0 0.4rem',
                borderRadius: '6px',
                border: isActive ? '1px solid #2563eb' : '1px solid #cbd5e1',
                backgroundColor: isActive ? '#2563eb' : '#ffffff',
                color: isActive ? '#ffffff' : '#334155',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {p}
            </button>
          );
        })}

        {/* Next Page */}
        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => handlePageClick(currentPage + 1)}
          title="Next Page"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            backgroundColor: currentPage === totalPages ? '#f1f5f9' : '#ffffff',
            color: currentPage === totalPages ? '#94a3b8' : '#334155',
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <ChevronRight size={15} />
        </button>

        {/* Last Page */}
        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => handlePageClick(totalPages)}
          title="Last Page"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            backgroundColor: currentPage === totalPages ? '#f1f5f9' : '#ffffff',
            color: currentPage === totalPages ? '#94a3b8' : '#334155',
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <ChevronsRight size={15} />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
