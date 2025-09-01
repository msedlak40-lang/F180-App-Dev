import React from 'react';

type Toast = { id: number; text: string; kind: 'success'|'error'|'info' };
const Ctx = React.createContext<{ show: (text: string, kind?: Toast['kind']) => void } | null>(null);

export function F180ToastProvider({ children }: { children: React.ReactNode }) {
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
          <div
            key={t.id}
            className="rounded-xl border px-3 py-2 shadow-sm text-sm"
            style={{
              background: 'hsl(var(--card))',
              color: 'hsl(var(--foreground))',
              borderColor:
                t.kind === 'success'
                  ? 'hsla(142, 70%, 45%, 0.35)'
                  : t.kind === 'error'
                  ? 'hsla(0, 75%, 50%, 0.35)'
                  : 'hsl(var(--border))',
            }}
          >
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useF180Toast() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error('useF180Toast must be used within F180ToastProvider');
  return ctx;
}
