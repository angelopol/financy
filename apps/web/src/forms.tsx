import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api, suggestTags, usd } from './api';
export function Form({
  children,
  onSubmit,
  label = 'Guardar',
  onDone,
}: {
  children: ReactNode;
  onSubmit: (data: any) => Promise<any>;
  label?: string;
  onDone: () => void;
}) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSubmit(Object.fromEntries(new FormData(e.currentTarget)));
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="form">
      {children}
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <button disabled={busy} className="primary" type="submit">
        {busy ? 'Guardando…' : label}
      </button>
    </form>
  );
}
export function Currency({ value = '$' }: { value?: string }) {
  return (
    <label>
      Moneda
      <select name="currency" defaultValue={value}>
        <option value="$">USD · Dólares</option>
        <option value="bs">Bs · Tasa paralelo</option>
        <option value="$bcv">USD · Tasa BCV</option>
        <option value="EUR_PARALLEL">EUR · Tasa paralelo</option>
        <option value="€">EUR · Tasa BCV</option>
      </select>
      <small>Todo se convierte a USD al valor del dólar paralelo.</small>
    </label>
  );
}
export function Provider({
  value = 'box',
  name = 'provider',
  auto = true,
  credit = true,
}: {
  value?: string;
  name?: string;
  auto?: boolean;
  credit?: boolean;
}) {
  const [balances, setBalances] = useState<{ box: string; savings: string } | null>(null);
  useEffect(() => {
    let active = true;
    api('/accounts/balances')
      .then((b) => active && setBalances(b))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return (
    <label>
      Cuenta
      <select name={name} defaultValue={value}>
        <option value="box">Caja · Disponible{balances ? ' · ' + usd(balances.box) : ''}</option>
        <option value="savings">Ahorros{balances ? ' · ' + usd(balances.savings) : ''}</option>
        {auto && (
          <option value="auto">
            {credit ? 'Automática · Mayor saldo' : 'Automática · Menor saldo'}
          </option>
        )}
      </select>
    </label>
  );
}
export function Amount({ value }: { value?: string }) {
  return (
    <label>
      Importe
      <input
        name="amount"
        type="number"
        min="0.01"
        max="9999999999.99"
        step="0.01"
        placeholder="0,00"
        defaultValue={value}
        required
      />
    </label>
  );
}
export function EntryForm({ type, item, done }: { type: string; item?: any; done: () => void }) {
  const [recurrence, setRecurrence] = useState(
    item ? (item.claim_day ? 'monthly' : item.term ? 'days' : 'one_time') : 'one_time',
  );
  // Live preview of the tags the server would auto-generate on save when left blank
  // (see words() in domain.ts). Stops overriding as soon as the user types their own
  // tags; clearing the field back to empty resumes following the description.
  const [slug, setSlug] = useState(item?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(Boolean(item?.slug));
  return (
    <Form
      onDone={done}
      onSubmit={(v) =>
        api('/entries/' + type + (item ? '/' + item.id : ''), item ? 'PATCH' : 'POST', {
          ...v,
          term: v.term ? Number(v.term) : null,
          claim_day: v.claim_day ? Number(v.claim_day) : null,
          auto_claim: v.auto_claim === 'on',
        })
      }
    >
      <label>
        Descripción
        <input
          name="description"
          autoFocus
          defaultValue={item?.description}
          onChange={(e) => {
            if (!slugTouched) setSlug(suggestTags(e.target.value).join(' '));
          }}
          placeholder={
            type === 'earnings' ? 'Ej. Salario de septiembre' : 'Ej. Compra del supermercado'
          }
          maxLength={500}
          required
        />
      </label>
      <div className="form-grid">
        <Amount value={item?.amount} />
        <Currency value={item?.currency} />
      </div>
      <Provider value={item?.provider ?? 'auto'} credit={type === 'earnings'} />
      <label>
        Frecuencia
        <select
          name="recurrence_type"
          value={recurrence}
          onChange={(e) => setRecurrence(e.target.value)}
        >
          <option value="one_time" disabled={!!item && (!!item.term || !!item.claim_day)}>
            Una sola vez
          </option>
          <option value="days" disabled={!!item && !item.term && !item.claim_day}>
            Cada cierto número de días
          </option>
          <option value="monthly" disabled={!!item && !item.term && !item.claim_day}>
            Un día de cada mes
          </option>
        </select>
      </label>
      {recurrence === 'days' && (
        <label>
          Intervalo en días
          <input
            name="term"
            type="number"
            min="1"
            max="3650"
            defaultValue={item?.term || 15}
            required
          />
        </label>
      )}
      {recurrence === 'monthly' && (
        <label>
          Día del mes
          <input
            name="claim_day"
            type="number"
            min="1"
            max="31"
            defaultValue={item?.claim_day || 1}
            required
          />
          <small>Si el mes es más corto, se usa su último día.</small>
        </label>
      )}
      {recurrence !== 'one_time' && (
        <label className="checkbox">
          <input type="checkbox" name="auto_claim" defaultChecked={item?.auto_claim ?? false} />{' '}
          Registrar automáticamente al vencer
        </label>
      )}
      <label>
        Etiquetas
        <input
          aria-label="Etiquetas"
          name="slug"
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setSlugTouched(e.target.value.trim() !== '');
          }}
          placeholder="Ej. hogar alimentación mercado"
        />
        <small>
          Se generan solas a partir de la descripción; edítalas si quieres afinarlas. Vinculan tus
          gastos con las categorías del presupuesto.
        </small>
      </label>
      <p className="form-note">
        {recurrence === 'one_time'
          ? 'El saldo se actualizará al guardar.'
          : 'El saldo se actualizará al registrar cada vencimiento.'}
      </p>
    </Form>
  );
}
export function ShopForm({ item, done }: { item?: any; done: () => void }) {
  return (
    <Form
      onDone={done}
      onSubmit={(v) => api('/shopping' + (item ? '/' + item.id : ''), item ? 'PATCH' : 'POST', v)}
    >
      <label>
        ¿Qué quieres comprar?
        <input
          name="description"
          autoFocus
          defaultValue={item?.description}
          maxLength={500}
          required
        />
      </label>
      <div className="form-grid">
        <Amount value={item?.amount} />
        <Currency />
      </div>
    </Form>
  );
}
export function BudgetForm({ month, item, done }: { month: string; item?: any; done: () => void }) {
  return (
    <Form
      onDone={done}
      onSubmit={(v) =>
        api('/budgets' + (item ? '/' + item.id : ''), item ? 'PATCH' : 'POST', { ...v, month })
      }
    >
      <label>
        Nombre de la categoría
        <input
          name="name"
          autoFocus
          placeholder="Ej. Alimentación"
          defaultValue={item?.name}
          maxLength={120}
          required
        />
      </label>
      <Amount value={item?.amount} />
      <label>
        Palabras clave
        <input
          name="slug"
          placeholder="comida mercado alimentación"
          defaultValue={item?.slug}
          required
        />
        <small>Se sumarán los gastos que compartan estas etiquetas.</small>
      </label>
    </Form>
  );
}
