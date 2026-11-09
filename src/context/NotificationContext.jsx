import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const NotificationContext = createContext();

export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Thêm Toast mới
  const showToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  }, []);

  // Gọi Dialog Xác Nhận
  const showConfirm = useCallback((message, onConfirm, onCancel = null) => {
    setConfirmDialog({
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmDialog(null);
      },
      onCancel: () => {
        if (onCancel) onCancel();
        setConfirmDialog(null);
      }
    });
  }, []);

  // Xóa Toast
  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{ showToast, showConfirm }}>
      {children}
      
      {/* KHU VỰC HIỂN THỊ TOAST */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>

      {/* KHU VỰC HIỂN THỊ CONFIRM DIALOG */}
      {confirmDialog && (
        // Hộp xác nhận: các chỗ đang dùng đều là xoá (lịch sử xem, bình luận) nên dùng kiểu nguy hiểm (evon I4: nền đỏ mờ)
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4" onClick={confirmDialog.onCancel}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-sm rounded-2xl border border-line bg-raised p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex size-10 items-center justify-center rounded-full bg-red-500/15 text-red-400">
              <span className="material-symbols-outlined text-[22px]">delete</span>
            </div>
            <h3 id="confirm-title" className="text-base font-semibold text-fg">{confirmDialog.message}</h3>
            <p className="mt-1 text-sm text-fg-2">Thao tác này không hoàn tác được.</p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={confirmDialog.onCancel}
                className="h-10 rounded-lg border border-line-strong px-4 text-sm font-medium text-fg transition-colors hover:bg-white/5"
              >
                Huỷ
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                autoFocus
                className="h-10 rounded-lg bg-red-500/15 px-4 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/25"
              >
                Xoá
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};

// Component con hiển thị từng Toast
const ToastItem = ({ toast, onRemove }) => {
  const { id, message, type, duration } = toast;
  
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(id);
    }, duration);
    return () => clearTimeout(timer);
  }, [id, duration, onRemove]);

  const getIcon = () => {
    switch(type) {
      case 'success': return <span className="material-symbols-outlined text-green-400">check_circle</span>;
      case 'error': return <span className="material-symbols-outlined text-red-400">error</span>;
      default: return <span className="material-symbols-outlined text-fg-2">info</span>;
    }
  };

  const getBorderColor = () => {
    switch(type) {
      case 'success': return 'border-green-500/30';
      case 'error': return 'border-red-500/30';
      default: return 'border-line';
    }
  };

  return (
    <div role={type === 'error' ? 'alert' : 'status'} className={`animate-fade-in pointer-events-auto flex min-w-[260px] max-w-[360px] items-center gap-3 rounded-xl border bg-raised px-4 py-3 shadow-2xl ${getBorderColor()}`}>
      {getIcon()}
      <p className="mr-1 flex-1 text-sm text-fg">{message}</p>
      <button onClick={() => onRemove(id)} className="flex size-7 items-center justify-center rounded-md text-fg-3 transition-colors hover:bg-white/5 hover:text-fg" aria-label="Đóng thông báo">
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>
  );
};
