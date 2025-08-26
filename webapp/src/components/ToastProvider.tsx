import React from 'react';

type Toast = { id: number; text: string; kind: 'success'|'error'|'info' };
const Ctx = React.createContext<{ show: (text: string, kind?: Toast['kind']) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const show = (text: string, kind: Toast['kind']='info') => {
    const id = Date.now()+Math.random();
    setToasts(t => [...t, { id, text, kind }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  };
  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div className="fixed right-4 top-4 space-y-2 z-50">
        {toasts.map(t => (
          <div key={t.id}
               className={`rounded-xl border px-3 py-2 shadow-sm bg-white text-sm ${
                 t.kind==='success' ? 'border-green-200' : t.kind==='error' ? 'border-red-200' : 'border-gray-200'
               }`}>
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
