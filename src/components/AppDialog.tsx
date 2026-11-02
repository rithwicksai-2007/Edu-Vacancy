import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppDialogContext } from "./AppDialogContext";

type PendingDialog = {
  id: number;
  message: string;
  resolve: () => void;
};

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const [dialogs, setDialogs] = useState<PendingDialog[]>([]);
  const nextId = useRef(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const currentDialog = dialogs[0];

  const showAlert = useCallback(
    (message: string) =>
      new Promise<void>((resolve) => {
        setDialogs((current) => [
          ...current,
          { id: nextId.current++, message, resolve },
        ]);
      }),
    [],
  );

  const closeAlert = useCallback(() => {
    currentDialog?.resolve();
    setDialogs((current) => current.slice(1));
  }, [currentDialog]);

  useEffect(() => {
    if (!currentDialog) return;

    buttonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAlert();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeAlert, currentDialog]);

  return (
    <AppDialogContext.Provider value={{ showAlert }}>
      {children}
      {currentDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <section
            aria-labelledby="app-dialog-title"
            aria-describedby="app-dialog-message"
            aria-modal="true"
            role="alertdialog"
            className="w-full max-w-md rounded-2xl bg-white p-6 text-left shadow-2xl sm:p-7"
          >
            <h2
              id="app-dialog-title"
              className="!m-0 !text-xl !font-bold !tracking-normal !text-slate-900"
            >
              EduVacancy
            </h2>
            <p
              id="app-dialog-message"
              className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600"
            >
              {currentDialog.message}
            </p>
            <div className="mt-6 flex justify-end">
              <button
                ref={buttonRef}
                type="button"
                onClick={closeAlert}
                className="rounded-xl bg-violet-600 px-5 py-2.5 font-semibold text-white transition hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200"
              >
                OK
              </button>
            </div>
          </section>
        </div>
      )}
    </AppDialogContext.Provider>
  );
}
