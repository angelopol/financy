import { useEffect, useRef, type ReactNode } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  X,
  Inbox,
  LoaderCircle,
  Pencil,
  Trash2,
  Repeat2,
  Split,
} from 'lucide-react';
import { accountLabel, dateLabel, usd } from './api';
export function Empty({
  title = 'Todo listo para empezar',
  description = 'Añade tu primer movimiento y empieza a ver tus finanzas con claridad.',
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span>
        <Inbox size={30} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" /> Cargando tus finanzas…
    </div>
  );
}
export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => previous?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
      aria-labelledby="modal-title"
    >
      <div className="modal-head">
        <div>
          <span className="eyebrow">UN PASO MÁS CERCA</span>
          <h2 id="modal-title">{title}</h2>
        </div>
        <button className="icon-button" aria-label="Cerrar" onClick={close}>
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function EntryRows({
  items,
  onEdit,
  onDelete,
  onClaim,
  onSplit,
}: {
  items: any[];
  onEdit?: (e: any) => void;
  onDelete?: (e: any) => void;
  onClaim?: (e: any) => void;
  onSplit?: (e: any) => void;
}) {
  if (!items.length) return <Empty />;
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Movimiento</th>
            <th>Cuenta</th>
            <th>Fecha</th>
            <th className="align-right">Importe</th>
            {onEdit && (
              <th>
                <span className="sr-only">Acciones</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((e) => {
            const income = e.type === 'earning' || e.type === 'earnings';
            return (
              <tr key={`${e.type}-${e.id}`}>
                <td>
                  <div className="entry-name">
                    <span className={'entry-icon ' + (income ? 'positive-bg' : 'expense-bg')}>
                      {income ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                    </span>
                    <div>
                      <strong>{e.description}</strong>
                      <small>
                        {e.term || e.claim_day ? (
                          <>
                            <Repeat2 size={11} />{' '}
                            {e.claim_day ? `Día ${e.claim_day} de cada mes` : `Cada ${e.term} días`}
                          </>
                        ) : (
                          e.slug || 'Movimiento único'
                        )}
                      </small>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="badge">{accountLabel(e.provider)}</span>
                </td>
                <td className="muted">{dateLabel(e.due_at || e.created_at)}</td>
                <td className={'align-right amount ' + (income ? 'positive' : '')}>
                  {income ? '+' : '−'}
                  {e.currency && e.currency !== '$' ? `${e.amount} ${e.currency}` : usd(e.amount)}
                </td>
                {onEdit && (
                  <td>
                    <div className="row-actions">
                      {e.due_at && onClaim && (
                        <button className="small-button" onClick={() => onClaim(e)}>
                          {income ? 'Cobrar' : 'Pagar'}
                        </button>
                      )}
                      <button
                        className="icon-button"
                        aria-label={'Editar ' + e.description}
                        onClick={() => onEdit(e)}
                      >
                        <Pencil size={15} />
                      </button>
                      {!income && onSplit && (
                        <button
                          className="icon-button"
                          aria-label={'Dividir ' + e.description}
                          onClick={() => onSplit(e)}
                        >
                          <Split size={15} />
                        </button>
                      )}
                      <button
                        className="icon-button danger"
                        aria-label={'Eliminar ' + e.description}
                        onClick={() => onDelete?.(e)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
export function Progress({ value }: { value: number }) {
  return (
    <div
      className={'progress ' + (value >= 100 ? 'over' : '')}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
