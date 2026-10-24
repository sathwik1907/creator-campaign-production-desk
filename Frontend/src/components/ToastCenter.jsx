import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export function ToastCenter() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    function onNotify(event) {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((items) => [...items.slice(-3), { id, ...event.detail }]);
      const timeout = window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 5500);
      return () => clearTimeout(timeout);
    }
    window.addEventListener('creatordesk:notify', onNotify);
    return () => window.removeEventListener('creatordesk:notify', onNotify);
  }, []);
  return <div className="toast-stack" role="status" aria-live="polite">
    {toasts.map(({ id, message, type }) => <div className={`toast-item toast-${type}`} key={id}>
      {type === 'error' ? <AlertCircle size={17} /> : type === 'success' ? <CheckCircle2 size={17} /> : <Info size={17} />}
      <span>{message}</span>
      <button type="button" aria-label="Dismiss notification" onClick={() => setToasts((items) => items.filter((t) => t.id !== id))}><X size={15} /></button>
    </div>)}
  </div>;
}
