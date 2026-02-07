/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState({ open: false });

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      setState({
        open: true,
        title: options?.title || "Emin misin?",
        description:
          options?.description || "Devam etmek için lütfen onaylayın.",
        confirmText: options?.confirmText || "Onayla",
        cancelText: options?.cancelText || "Vazgeç",
        tone: options?.tone || "danger",
        resolve,
      });
    });
  }, []);

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    close();
  }, [state, close]);

  const handleCancel = useCallback(() => {
    state.resolve?.(false);
    close();
  }, [state, close]);

  const value = useMemo(
    () => ({ confirm }),
    [confirm]
  );

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {state.open &&
        createPortal(
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-md rounded-2xl border border-border bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h2 className="text-lg font-semibold text-primary">{state.title}</h2>
                <button
                  onClick={handleCancel}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-hover"
                >
                  <X className="h-4 w-4 text-secondary" />
                </button>
              </div>
              <div className="px-5 py-4 text-sm text-secondary">
                {state.description}
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-4">
                <button
                  onClick={handleCancel}
                  className="rounded-full border border-border px-4 py-2 text-sm text-secondary hover:bg-surface-hover"
                >
                  {state.cancelText}
                </button>
                <button
                  onClick={handleConfirm}
                  className={`rounded-full px-4 py-2 text-sm font-semibold text-white ${
                    state.tone === "danger"
                      ? "bg-rose-600 hover:bg-rose-700"
                      : "bg-accent hover:bg-accent-hover"
                  }`}
                >
                  {state.confirmText}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx.confirm;
}
