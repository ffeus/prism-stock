import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, CircleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const FeedbackContext = createContext<(message: string, failed?: boolean) => void>(() => {});
export const useFeedback = () => useContext(FeedbackContext);
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<{ message: string; failed: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const notify = useCallback((message: string, failed = false) => { clearTimeout(timer.current); setNotice({ message, failed }); timer.current = setTimeout(() => setNotice(null), failed ? 10000 : 4500); }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return <FeedbackContext.Provider value={notify}>{children}<div className="feedback-region" role="status" aria-live="polite">{notice && <div className={`feedback-toast ${notice.failed ? "feedback-error" : ""}`}>
    {notice.failed ? <CircleAlert size={17} /> : <CheckCircle2 size={17} />}<span>{notice.message}</span><Button variant="ghost" size="icon-sm" aria-label="关闭提示" onClick={() => setNotice(null)}><X /></Button>
  </div>}</div></FeedbackContext.Provider>;
}

export function PageHeading({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return <div className="page-heading"><div><h1>{title}</h1><p>{description}</p></div>{actions && <div className="page-actions">{actions}</div>}</div>;
}
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-state-symbol" aria-hidden="true">◇</div><h3>{title}</h3><p>{description}</p>{action}</div>;
}
export function Panel({ title, description, children, actions, className = "" }: { title: string; description?: string; children: ReactNode; actions?: ReactNode; className?: string }) {
  return <section className={`surface-panel ${className}`}><div className="panel-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{actions}</div>{children}</section>;
}
