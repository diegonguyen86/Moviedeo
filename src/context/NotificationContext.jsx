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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#111] border border-white/10 p-6 md:p-8 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.8)] max-w-sm w-full animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-yellow-500/10 text-yellow-500 rounded-full flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-3xl">help</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Xác nhận</h3>
              <p className="text-zinc-400 text-sm mb-8">{confirmDialog.message}</p>
              <div className="flex gap-3 w-full">
                <button 
                  onClick={confirmDialog.onCancel}
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-sm bg-white/5 text-white hover:bg-white/10 transition-colors border border-white/10"
                >
                  HỦY BỎ
                </button>
                <button 
                  onClick={confirmDialog.onConfirm}
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-sm bg-yellow-500 text-black hover:bg-yellow-400 transition-colors shadow-[0_0_15px_rgba(234,179,8,0.3)]"
                >
                  ĐỒNG Ý
                </button>
              </div>
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
      default: return <span className="material-symbols-outlined text-blue-400">info</span>;
    }
  };

  const getBorderColor = () => {
    switch(type) {
      case 'success': return 'border-green-500/30';
      case 'error': return 'border-red-500/30';
      default: return 'border-white/10';
    }
  };

  return (
    <div className={`pointer-events-auto flex items-center gap-3 bg-black/80 backdrop-blur-xl border ${getBorderColor()} px-4 py-3 rounded-xl shadow-2xl animate-in slide-in-from-right-8 fade-in duration-300 min-w-[250px] max-w-[350px]`}>
      {getIcon()}
      <p className="text-white text-sm font-medium flex-1 mr-2">{message}</p>
      <button onClick={() => onRemove(id)} className="text-zinc-500 hover:text-white transition-colors">
        <span className="material-symbols-outlined text-sm">close</span>
      </button>
    </div>
  );
};
