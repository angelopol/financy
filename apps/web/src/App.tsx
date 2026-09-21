import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  ArrowLeftRight,
  Bell,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Download,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings2,
  ShoppingBag,
  SlidersHorizontal,
  Sprout,
  Target,
  Wallet,
  X,
  PiggyBank,
  Calculator,
  Pencil,
  Trash2,
  Gift,
  Check,
  RefreshCw,
  Printer,
  History,
  Undo2,
  Sparkles,
} from 'lucide-react';
import { api, ApiError, usd, dateLabel, currentMonth, accountLabel } from './api';
import { Auth } from './Auth';
import { Chat } from './Chat';
import { ThemeSelect, ChatFontSizeSelect } from './theme';
import { Empty, EntryRows, Loading, Modal, Progress } from './components';
import { Amount, BudgetForm, EntryForm, Form, Provider, ShopForm } from './forms';
import { pushSupported, getPushSubscription, enablePush, disablePush } from './push';
const navigation = [
  ['/dashboard', 'Vista general', LayoutDashboard],
  ['/earnings', 'Ingresos', ArrowDownLeft],
  ['/expenses', 'Gastos', ArrowUpRight],
  ['/accounts', 'Mis cuentas', Wallet],
  ['/budgets', 'Presupuestos', Target],
  ['/shopping', 'Lista de compras', ShoppingBag],
  ['/reports', 'Reportes', ChartNoAxesCombined],
  ['/calculator', 'Conversor', Calculator],
  ['/activity', 'Actividad', History],
] as const;
const titles: Record<string, [string, string]> = {
  dashboard: ['Tu panorama financiero', 'Cada decisión cuenta. Dale un buen rumbo a tu dinero.'],
  earnings: ['Ingresos', 'Lo que recibes hoy hace posibles tus planes de mañana.'],
  expenses: ['Gastos', 'Conoce a dónde va tu dinero, sin perder ningún detalle.'],
  accounts: ['Mis cuentas', 'Encuentra el equilibrio entre disfrutar y ahorrar.'],
  budgets: ['Presupuestos', 'Un lugar para cada gasto. Más espacio para tus metas.'],
  shopping: ['Lista de compras', 'Compra con intención. Planifica antes de gastar.'],
  reports: ['Reportes', 'Tu historia financiera, con todos los detalles.'],
  calculator: ['Conversor de monedas', 'Convierte tus importes con las tasas disponibles.'],
  activity: ['Actividad', 'Cada acción tuya o de Financy IA, con opción de deshacerla.'],
  profile: ['Tu perfil', 'Haz de Financy un espacio a tu medida.'],
};
export function App() {
  const [user, setUser] = useState<any>(undefined),
    [authError, setAuthError] = useState('');
  const { pathname } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    api('/auth/me')
      .then(setUser)
      .catch((e) => {
        setUser(null);
        if (e.status !== 401) setAuthError(e.message);
      });
  }, []);
  const publicPath = [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
  ].includes(pathname);
  useEffect(() => {
    if (user === null && !publicPath && pathname !== '/') navigate('/login', { replace: true });
    if (user && ['/', '/login', '/register'].includes(pathname))
      navigate('/dashboard', { replace: true });
  }, [user, pathname, publicPath, navigate]);
  if (user === undefined) return <Loading />;
  if (publicPath || !user)
    return (
      <>
        {authError && (
          <div className="connection-banner" role="alert">
            {authError} <button onClick={() => window.location.reload()}>Reintentar</button>
          </div>
        )}
        <Auth onLogin={setUser} />
      </>
    );
  return <><Workspace key={pathname} user={user} setUser={setUser} /><Chat key={user.id}/></>;
}
function Workspace({ user, setUser }: { user: any; setUser: (u: any) => void }) {
  const { pathname, search } = useLocation(),
    navigate = useNavigate();
  const page = pathname.slice(1) || 'dashboard';
  const [data, setData] = useState<any>(null),
    [rates, setRates] = useState<any>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0),
    [toast, setToast] = useState('');
  const [month, setMonth] = useState(currentMonth()),
    [q, setQ] = useState(''),
    [debouncedQ, setDebouncedQ] = useState(''),
    [number, setNumber] = useState(1),
    [mode, setMode] = useState('all'),
    [provider, setProvider] = useState(''),
    [reportKind, setReportKind] = useState('expenses'),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [amountMin, setAmountMin] = useState(''),
    [amountMax, setAmountMax] = useState(''),
    [filtersOpen, setFiltersOpen] = useState(false);
  const [modal, setModal] = useState<{ title: string; content: ReactNode } | null>(null),
    [menu, setMenu] = useState(false);
  const reload = () => setRevision((x) => x + 1);
  const done = () => {
    setModal(null);
    reload();
    setToast('Listo. Tus finanzas están actualizadas.');
  };
  useEffect(() => {
    const onReload = (e: Event) => {
      reload();
      setToast((e as CustomEvent).detail ?? 'Tus finanzas están actualizadas.');
    };
    window.addEventListener('financy:reload', onReload);
    return () => window.removeEventListener('financy:reload', onReload);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(q);
      setNumber(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);
  useEffect(() => {
    setQ('');
    setNumber(1);
    setMode('all');
    setProvider('');
    setAmountMin('');
    setAmountMax('');
    setMenu(false);
    setFiltersOpen(false);
    // A report_url from Financy IA (e.g. /reports?kind=expenses&from=...&amount_max=...)
    // pre-fills these same filters, so opening it shows exactly what the agent summarized.
    if (page === 'reports') {
      const linked = new URLSearchParams(search);
      if (linked.toString()) {
        setReportKind(linked.get('kind') === 'earnings' ? 'earnings' : 'expenses');
        if (linked.get('provider')) setProvider(linked.get('provider')!);
        if (linked.get('from')) setFrom(linked.get('from')!);
        if (linked.get('to')) setTo(linked.get('to')!);
        if (linked.get('q')) setQ(linked.get('q')!);
        if (linked.get('amount_min')) setAmountMin(linked.get('amount_min')!);
        if (linked.get('amount_max')) setAmountMax(linked.get('amount_max')!);
      }
    }
  }, [page, search]);
  useEffect(() => {
    if (page !== 'dashboard') return;
    const linked = new URLSearchParams(search);
    if (linked.get('expense') === '1') entry('expenses');
  }, [page, search]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  const params = new URLSearchParams({ page: String(number), q: debouncedQ, mode });
  if (provider) params.set('provider', provider);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (amountMin) params.set('amount_min', amountMin);
  if (amountMax) params.set('amount_max', amountMax);
  const query = params.toString();
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError('');
    const path =
      page === 'dashboard' || page === 'accounts'
        ? '/dashboard?month=' + month
        : page === 'earnings' || page === 'expenses'
          ? '/entries/' + page + '?' + query
          : page === 'shopping'
            ? '/shopping?page=' + number
            : page === 'budgets'
              ? '/budgets?month=' + month
              : page === 'reports'
                ? '/reports/' + reportKind + '?' + query
                : null;
    if (!path) {
      setData(null);
      setBusy(false);
      return;
    }
    api(path)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          if (e instanceof ApiError && e.status === 401) setUser(null);
        }
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [page, month, query, revision, reportKind]);
  useEffect(() => {
    api('/rates')
      .then(setRates)
      .catch(() => setRates(null));
  }, [revision]);
  async function action(path: string, method = 'POST', body: unknown = {}) {
    try {
      await api(path, method, body);
      done();
    } catch (e) {
      setToast((e as Error).message);
    }
  }
  function entry(type: string, item?: any) {
    setModal({
      title: item ? 'Editar movimiento' : type === 'earnings' ? 'Nuevo ingreso' : 'Nuevo gasto',
      content: <EntryForm type={type} item={item} done={done} />,
    });
  }
  function confirmDelete(path: string, name: string) {
    setModal({
      title: 'Eliminar registro',
      content: (
        <Form label="Sí, eliminar" onDone={done} onSubmit={() => api(path, 'DELETE', {})}>
          <p>
            Se eliminará <strong>{name}</strong> y se ajustará el saldo correspondiente. Esta acción
            no se puede deshacer.
          </p>
        </Form>
      ),
    });
  }
  function transfer() {
    setModal({
      title: 'Mover dinero entre tus cuentas',
      content: (
        <Form
          onDone={done}
          label="Transferir"
          onSubmit={(v) => api('/accounts/transfer', 'POST', v)}
        >
          <Provider name="from" auto={false} />
          <Amount />
          <p className="form-note">
            El importe pasará a tu otra cuenta. Tu balance total no cambia.
          </p>
        </Form>
      ),
    });
  }
  function split(item: any) {
    setModal({ title: 'Repartir gasto', content: <SplitForm item={item} done={done} /> });
  }
  const entryList = (items: any[], type: string, editable = true) => (
    <EntryRows
      items={items.map((e) => ({ ...e, type }))}
      onEdit={editable ? (e) => entry(type, e) : undefined}
      onDelete={(e) => confirmDelete('/entries/' + type + '/' + e.id, e.description)}
      onClaim={(e) =>
        action('/entries/' + type + '/' + e.id + '/claim', 'POST', {
          expected_anchor: e.UpdatedTerm,
        })
      }
      onResync={(e) => action('/entries/' + type + '/' + e.id + '/resync', 'POST', {})}
      onSplit={type === 'expenses' ? split : undefined}
    />
  );
  const title = titles[page] ?? [
    'Página no encontrada',
    'Elige una sección del menú para continuar.',
  ];
  return (
    <div className="workspace">
      <aside className={'sidebar ' + (menu ? 'open' : '')}>
        <Link className="brand" to="/dashboard">
          <span className="brand-symbol">
            <Sprout />
          </span>
          financy<span className="brand-dot">.</span>
        </Link>
        <span className="nav-label">TU ESPACIO</span>
        <nav>
          {navigation.map(([url, label, Icon]) => (
            <NavLink key={url} to={url}>
              <Icon size={19} />
              {label}
              {url === pathname && <span className="nav-dot" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <NavLink className="settings-link" to="/profile">
            <Settings2 size={18} /> Configuración
          </NavLink>
          <button className="user-card" onClick={() => navigate('/profile')}>
            <span className="avatar">{(user.name || '?').slice(0, 2).toUpperCase()}</span>
            <span>
              <strong>{user.name || 'Sin nombre'}</strong>
              <small>Mi cuenta personal</small>
            </span>
            <ChevronRight size={16} />
          </button>
        </div>
      </aside>
      {menu && (
        <button className="menu-backdrop" aria-label="Cerrar menú" onClick={() => setMenu(false)} />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Abrir menú"
              onClick={() => setMenu(!menu)}
            >
              <Menu />
            </button>
          </div>
          <div className="topbar-right">
            <span className="today">
              {new Intl.DateTimeFormat('es-VE', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }).format(new Date())}
            </span>
            <button
              className="icon-button"
              aria-label="Ver notificaciones"
              onClick={() =>
                setModal({
                  title: 'Notificaciones',
                  content: <NotificationsModal close={() => setModal(null)} navigate={navigate} />,
                })
              }
            >
              <Bell size={19} />
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {page === 'dashboard'
                  ? `HOLA, ${(user.name || '').split(' ')[0].toUpperCase()} ☀`
                  : 'TUS FINANZAS, A TU RITMO'}
              </span>
              <h1>{title[0]}</h1>
              <p>{title[1]}</p>
            </div>
            <div className="heading-actions">
              {['dashboard', 'budgets', 'accounts'].includes(page) && (
                <label className="month-picker">
                  <CalendarDays size={16} />
                  <input
                    aria-label="Mes"
                    type="month"
                    value={month}
                    onChange={(e) => e.target.value && setMonth(e.target.value)}
                  />
                </label>
              )}
              {['dashboard', 'earnings', 'expenses'].includes(page) && (
                <button
                  className="primary"
                  onClick={() => entry(page === 'earnings' ? 'earnings' : 'expenses')}
                >
                  <Plus size={17} />
                  {page === 'earnings' ? 'Nuevo ingreso' : 'Nuevo gasto'}
                </button>
              )}
              {page === 'shopping' && (
                <button
                  className="primary"
                  onClick={() =>
                    setModal({ title: 'Una compra en mente', content: <ShopForm done={done} /> })
                  }
                >
                  <Plus size={17} /> Añadir compra
                </button>
              )}
              {page === 'budgets' && (
                <button
                  className="primary"
                  onClick={() =>
                    setModal({
                      title: 'Nueva categoría',
                      content: <BudgetForm month={month} done={done} />,
                    })
                  }
                >
                  <Plus size={17} /> Nueva categoría
                </button>
              )}
            </div>
          </div>
          {error ? (
            <div className="error-panel" role="alert">
              <CircleHelp />
              <h3>No pudimos cargar tus datos</h3>
              <p>{error}</p>
              <button className="secondary" onClick={reload}>
                <RefreshCw size={16} /> Reintentar
              </button>
            </div>
          ) : busy && !data ? (
            <Loading />
          ) : (
            <>
              {page === 'dashboard' && data && (
                <>
                  <div className="summary-grid">
                    <section className="balance-card">
                      <div className="card-label">
                        Balance total <Wallet size={19} />
                      </div>
                      <h2>{usd(data.total)}</h2>
                      <span className="balance-caption">Tu dinero, en un solo vistazo</span>
                      <div className="balance-breakdown">
                        <span>
                          <i /> Caja <strong>{usd(data.box)}</strong>
                        </span>
                        <span>
                          <i /> Ahorros <strong>{usd(data.savings)}</strong>
                        </span>
                      </div>
                    </section>
                    <Metric
                      title="Ingresos del mes"
                      value={data.income}
                      icon={<ArrowDownLeft size={20} />}
                      positive
                      upcoming={data.projected_income}
                    />
                    <Metric
                      title="Gastos del mes"
                      value={data.expenses}
                      icon={<ArrowUpRight size={20} />}
                      upcoming={data.projected_expenses}
                    />
                    <Metric
                      title="Balance del mes"
                      value={data.net}
                      icon={<PiggyBank size={20} />}
                      positive
                      upcoming={data.projected}
                      upcomingLabel="neto por recurrencias pendientes"
                    />
                  </div>
                  <QuickConverter rates={rates} />
                  <div className="dashboard-middle">
                    <section className="panel flow-panel">
                      <div className="panel-head">
                        <div>
                          <h2>El ritmo de tu dinero</h2>
                          <p>Ingresos y gastos a lo largo del mes</p>
                        </div>
                        <div className="chart-legend">
                          <span>
                            <i />
                            Ingresos
                          </span>
                          <span>
                            <i />
                            Gastos
                          </span>
                        </div>
                      </div>
                      <FlowChart rows={data.trend} month={month} />
                    </section>
                    <section className="panel limit-panel">
                      <div className="panel-head">
                        <h2>Tu límite mensual</h2>
                        <Target size={19} />
                      </div>
                      <div
                        className="limit-graphic"
                        style={
                          {
                            '--progress': `${Math.min(100, Number(user.monthly_expense_limit) ? (Number(data.expenses) / Number(user.monthly_expense_limit)) * 100 : 0)}%`,
                          } as React.CSSProperties
                        }
                      >
                        <div>
                          <small>HAS UTILIZADO</small>
                          <strong>
                            {Number(user.monthly_expense_limit)
                              ? Math.round(
                                  (Number(data.expenses) / Number(user.monthly_expense_limit)) *
                                    100,
                                )
                              : 0}
                            <span>%</span>
                          </strong>
                        </div>
                      </div>
                      <div className="limit-values">
                        <strong>{usd(data.expenses)}</strong>
                        <span>de {usd(user.monthly_expense_limit)}</span>
                      </div>
                      <p className="limit-note">
                        {!Number(user.monthly_expense_limit)
                          ? 'Define un límite y gasta con más claridad.'
                          : Number(data.expenses) >= Number(user.monthly_expense_limit)
                            ? 'Alcanzaste tu límite. Es momento de revisar tus gastos.'
                            : Number(data.expenses) >= Number(user.monthly_expense_limit) * 0.7
                              ? 'Te acercas a tu límite. Aún puedes ajustar el rumbo.'
                              : 'Vas a buen ritmo. Sigue cuidando tu equilibrio.'}
                      </p>
                      <Link className="text-link" to="/profile">
                        Ajustar mi límite <ArrowRight size={14} />
                      </Link>
                    </section>
                  </div>
                  <div className="dashboard-bottom">
                    <section className="panel">
                      <div className="panel-head">
                        <div>
                          <h2>Últimos movimientos</h2>
                          <p>Los pequeños detalles de tu día a día</p>
                        </div>
                        <Link className="text-link" to="/reports">
                          Ver reportes <ArrowRight size={14} />
                        </Link>
                      </div>
                      <EntryRows items={data.recent} />
                    </section>
                    <section id="upcoming" className="panel">
                      <div className="panel-head">
                        <div>
                          <h2>En el horizonte</h2>
                          <p>Tus próximos movimientos</p>
                        </div>
                        <CalendarDays size={19} />
                      </div>
                      {data.upcoming.length ? (
                        data.upcoming.map((e: any) => (
                          <div className="upcoming" key={e.type + e.id}>
                            <span className="date-tile">
                              {e.due_at ? new Date(e.due_at).getDate() : '—'}
                              <small>
                                {e.due_at
                                  ? new Intl.DateTimeFormat('es', { month: 'short' }).format(
                                      new Date(e.due_at),
                                    )
                                  : ''}
                              </small>
                            </span>
                            <div>
                              <strong>{e.description}</strong>
                              <small>
                                {e.type === 'earnings' ? 'Ingreso' : 'Gasto'} recurrente
                              </small>
                            </div>
                            <strong className={e.type === 'earnings' ? 'positive' : ''}>
                              {e.currency && e.currency !== '$'
                                ? `${e.amount} ${e.currency}`
                                : usd(e.amount)}
                            </strong>
                          </div>
                        ))
                      ) : (
                        <Empty
                          title="Sin compromisos próximos"
                          description="Tus movimientos recurrentes aparecerán aquí."
                        />
                      )}
                      <Link className="upcoming-link" to="/earnings">
                        Organizar mis ingresos <ArrowRight size={14} />
                      </Link>
                    </section>
                  </div>
                </>
              )}
              {(page === 'earnings' || page === 'expenses' || page === 'reports') && (
                <section className="panel">
                  <div className="list-toolbar">
                    <div className="tabs">
                      {page === 'reports' ? (
                        <>
                          <button
                            className={reportKind === 'expenses' ? 'selected' : ''}
                            onClick={() => {
                              setReportKind('expenses');
                              setNumber(1);
                            }}
                          >
                            Gastos
                          </button>
                          <button
                            className={reportKind === 'earnings' ? 'selected' : ''}
                            onClick={() => {
                              setReportKind('earnings');
                              setNumber(1);
                            }}
                          >
                            Ingresos
                          </button>
                        </>
                      ) : (
                        ['all', 'history', 'recurring'].map((m, i) => (
                          <button
                            key={m}
                            className={mode === m ? 'selected' : ''}
                            onClick={() => {
                              setMode(m);
                              setNumber(1);
                            }}
                          >
                            {['Todos', 'Historial', 'Recurrentes'][i]}
                          </button>
                        ))
                      )}
                    </div>
                    <div className="search-field search-field-desktop">
                      <Search size={17} />
                      <input
                        aria-label="Buscar movimientos"
                        placeholder="Buscar un movimiento…"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className={'filters-toggle' + (filtersOpen ? ' open' : '')}
                      aria-expanded={filtersOpen}
                      aria-label={filtersOpen ? 'Ocultar filtros' : 'Mostrar filtros'}
                      onClick={() => setFiltersOpen((v) => !v)}
                    >
                      <ChevronDown size={18} />
                    </button>
                  </div>
                  <div className={'filters' + (filtersOpen ? ' filters-open' : '')}>
                    <div className="search-field search-field-mobile">
                      <Search size={17} />
                      <input
                        aria-label="Buscar movimientos"
                        placeholder="Buscar un movimiento…"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                      />
                    </div>
                    <SlidersHorizontal size={15} />
                    <select
                      aria-label="Filtrar cuenta"
                      value={provider}
                      onChange={(e) => {
                        setProvider(e.target.value);
                        setNumber(1);
                      }}
                    >
                      <option value="">Todas las cuentas</option>
                      <option value="box">Caja</option>
                      <option value="savings">Ahorros</option>
                    </select>
                    <label>
                      Desde{' '}
                      <input
                        aria-label="Desde"
                        type="date"
                        value={from}
                        onChange={(e) => {
                          setFrom(e.target.value);
                          setNumber(1);
                        }}
                      />
                    </label>
                    <label>
                      Hasta{' '}
                      <input
                        aria-label="Hasta"
                        type="date"
                        value={to}
                        onChange={(e) => {
                          setTo(e.target.value);
                          setNumber(1);
                        }}
                      />
                    </label>
                    <label>
                      Monto mín.{' '}
                      <input
                        aria-label="Monto mínimo"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0,00"
                        value={amountMin}
                        onChange={(e) => {
                          setAmountMin(e.target.value);
                          setNumber(1);
                        }}
                      />
                    </label>
                    <label>
                      Monto máx.{' '}
                      <input
                        aria-label="Monto máximo"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0,00"
                        value={amountMax}
                        onChange={(e) => {
                          setAmountMax(e.target.value);
                          setNumber(1);
                        }}
                      />
                    </label>
                    {page === 'reports' && (
                      <>
                        <a
                          className="small-button"
                          href={'/api/exports/' + reportKind + '?' + query}
                        >
                          <Download size={14} /> CSV
                        </a>
                        <button
                          className="small-button"
                          onClick={async () => {
                            try {
                              let all: any[] = [];
                              for (let p = 1; p <= Math.max(1, data.pages); p++) {
                                const r = await api(
                                  '/reports/' +
                                    reportKind +
                                    '?' +
                                    new URLSearchParams({
                                      ...Object.fromEntries(params),
                                      page: String(p),
                                    }),
                                );
                                all = all.concat(r.items);
                              }
                              setData({ ...data, items: all });
                              setTimeout(() => window.print(), 150);
                            } catch (e) {
                              setToast((e as Error).message);
                            }
                          }}
                        >
                          <Printer size={14} /> Imprimir / PDF
                        </button>
                      </>
                    )}
                  </div>
                  {data && (
                    <>
                      {page === 'reports' && (
                        <div className="report-total">
                          <span>Total del período</span>
                          <strong>{usd(data.totalAmount)}</strong>
                          <small>{data.total} movimientos</small>
                        </div>
                      )}
                      {entryList(
                        data.items,
                        page === 'reports' ? reportKind : page,
                        page !== 'reports',
                      )}
                      <div className="pagination">
                        <span>
                          {data.total} registros · Página {number} de {Math.max(1, data.pages)}
                        </span>
                        <div>
                          <button
                            className="icon-button"
                            aria-label="Página anterior"
                            disabled={number <= 1}
                            onClick={() => setNumber((n) => n - 1)}
                          >
                            <ChevronLeft size={17} />
                          </button>
                          <button
                            className="icon-button"
                            aria-label="Página siguiente"
                            disabled={number >= data.pages}
                            onClick={() => setNumber((n) => n + 1)}
                          >
                            <ChevronRight size={17} />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </section>
              )}
              {page === 'accounts' && data && (
                <>
                  <div className="accounts-grid">
                    {['box', 'savings'].map((a, i) => (
                      <section className={'account-card ' + (i ? 'savings-card' : '')} key={a}>
                        <span className="account-icon">{i ? <PiggyBank /> : <Wallet />}</span>
                        <span className="eyebrow">
                          {i ? 'UN PASO MÁS CERCA DE TUS METAS' : 'PARA TU DÍA A DÍA'}
                        </span>
                        <h2>{accountLabel(a)}</h2>
                        <strong>{usd(data[a])}</strong>
                        <p>
                          {i
                            ? 'Tu tranquilidad de mañana se construye hoy.'
                            : 'Disponible para lo que necesitas y lo que disfrutas.'}
                        </p>
                        <button className="secondary" onClick={transfer}>
                          <ArrowLeftRight size={16} /> Transferir dinero
                        </button>
                      </section>
                    ))}
                  </div>
                  <section className="panel">
                    <div className="panel-head">
                      <div>
                        <h2>Actividad reciente</h2>
                        <p>
                          Proyección mensual de tus recurrencias:{' '}
                          {data.projected === null ? 'Tasa no disponible' : usd(data.projected)}.
                          Estimación con el criterio de ciclos del historial.
                        </p>
                      </div>
                    </div>
                    <EntryRows items={data.recent} />
                  </section>
                </>
              )}
              {page === 'budgets' &&
                data &&
                (data.length ? (
                  <div className="budget-grid">
                    {data.map((b: any) => (
                      <section className="panel budget-card" key={b.id}>
                        <div className="panel-head">
                          <span className="entry-icon positive-bg">
                            <Target size={21} />
                          </span>
                          <div className="row-actions">
                            <button
                              className="icon-button"
                              aria-label={'Editar ' + b.name}
                              onClick={() =>
                                setModal({
                                  title: 'Editar categoría',
                                  content: <BudgetForm item={b} month={month} done={done} />,
                                })
                              }
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              className="icon-button"
                              aria-label={'Eliminar ' + b.name}
                              onClick={() => confirmDelete('/budgets/' + b.id, b.name)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        <h2>{b.name}</h2>
                        <p className="muted">{b.slug}</p>
                        <div className="budget-amount">
                          <strong>{usd(b.spent)}</strong>
                          <span>de {usd(b.amount)}</span>
                        </div>
                        <Progress value={(Number(b.spent) / Number(b.amount)) * 100} />
                        <p className={Number(b.remaining) < 0 ? 'danger' : 'muted'}>
                          {Number(b.remaining) < 0
                            ? 'Excedido por ' + usd(-Number(b.remaining))
                            : 'Te quedan ' + usd(b.remaining)}
                        </p>
                      </section>
                    ))}
                  </div>
                ) : (
                  <section className="panel">
                    <Empty
                      title="Dale un propósito a cada dólar"
                      description="Crea categorías y conecta tus gastos mediante palabras clave."
                      action={
                        <button
                          className="primary"
                          onClick={() =>
                            setModal({
                              title: 'Nueva categoría',
                              content: <BudgetForm month={month} done={done} />,
                            })
                          }
                        >
                          <Plus size={16} /> Crear mi primer presupuesto
                        </button>
                      }
                    />
                  </section>
                ))}
              {page === 'shopping' && data && (
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>De tus planes a tu día a día</h2>
                      <p>{data.pending_count} compras pendientes</p>
                    </div>
                    <strong>{usd(data.pending_amount)}</strong>
                  </div>
                  {data.items.length ? (
                    <div className="shopping-list">
                      {data.items.map((e: any) => (
                        <div
                          className={
                            'shopping-row ' + (e.status === 'purchased' ? 'purchased' : '')
                          }
                          key={e.id}
                        >
                          <span className="entry-icon">
                            {e.status === 'purchased' ? (
                              <Check size={20} />
                            ) : (
                              <ShoppingBag size={20} />
                            )}
                          </span>
                          <div className="shopping-description">
                            <strong>{e.description}</strong>
                            <small>
                              {e.status === 'pending'
                                ? Number(e.saved) > 0
                                  ? `Por comprar · ${Math.round((Number(e.saved) / Number(e.amount)) * 100)}% ahorrado (${usd(e.saved)} de ${usd(e.amount)})`
                                  : 'Por comprar'
                                : e.not_discount
                                  ? 'Recibido sin descuento de saldo'
                                  : 'Comprado · ' + accountLabel(e.provider)}
                            </small>
                          </div>
                          <strong>{usd(e.amount)}</strong>
                          <div className="row-actions">
                            {e.status === 'pending' ? (
                              <>
                                <button
                                  className="small-button"
                                  onClick={() =>
                                    setModal({
                                      title: 'Registrar compra',
                                      content: (
                                        <Form
                                          onDone={done}
                                          label="Confirmar compra"
                                          onSubmit={(v) =>
                                            api('/shopping/' + e.id + '/purchase', 'POST', {
                                              ...v,
                                              not_discount: v.not_discount === 'on',
                                            })
                                          }
                                        >
                                          <Amount value={e.amount} />
                                          <Provider value="auto" credit={false} />
                                          <label className="checkbox">
                                            <input type="checkbox" name="not_discount" /> No
                                            descontar de mis cuentas
                                          </label>
                                          {Number(e.saved) > 0 && (
                                            <p className="form-note">
                                              Ya abonaste {usd(e.saved)} para este artículo; al
                                              confirmar, solo se descontará la diferencia.
                                            </p>
                                          )}
                                        </Form>
                                      ),
                                    })
                                  }
                                >
                                  Comprar
                                </button>
                                <button
                                  className="icon-button"
                                  aria-label={'Ahorrar para ' + e.description}
                                  onClick={() =>
                                    setModal({
                                      title: 'Ahorro para "' + e.description + '"',
                                      content: <SavingsModal item={e} done={done} />,
                                    })
                                  }
                                >
                                  <PiggyBank size={16} />
                                </button>
                                <button
                                  className="icon-button"
                                  aria-label={'Marcar como regalo ' + e.description}
                                  onClick={() => action('/shopping/' + e.id + '/gift')}
                                >
                                  <Gift size={16} />
                                </button>
                                <button
                                  className="icon-button"
                                  aria-label={'Editar ' + e.description}
                                  onClick={() =>
                                    setModal({
                                      title: 'Editar compra',
                                      content: <ShopForm item={e} done={done} />,
                                    })
                                  }
                                >
                                  <Pencil size={16} />
                                </button>
                              </>
                            ) : (
                              <button
                                className="small-button"
                                onClick={() => action('/shopping/' + e.id + '/pending')}
                              >
                                Volver a pendiente
                              </button>
                            )}
                            <button
                              className="icon-button"
                              aria-label={'Eliminar ' + e.description}
                              onClick={() => confirmDelete('/shopping/' + e.id, e.description)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      title="¿Qué tienes en mente?"
                      description="Organiza tus próximas compras y registra el gasto cuando las hagas."
                    />
                  )}
                  {data.pages > 1 && (
                    <div className="pagination">
                      <span>
                        {data.total} compras · Página {number} de {Math.max(1, data.pages)}
                      </span>
                      <div>
                        <button
                          className="icon-button"
                          aria-label="Página anterior"
                          disabled={number <= 1}
                          onClick={() => setNumber((n) => n - 1)}
                        >
                          <ChevronLeft size={17} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label="Página siguiente"
                          disabled={number >= data.pages}
                          onClick={() => setNumber((n) => n + 1)}
                        >
                          <ChevronRight size={17} />
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )}
              {page === 'calculator' && <CalculatorPage rates={rates} />}
              {page === 'activity' && <ActivityPage />}
              {page === 'profile' && <Profile user={user} setUser={setUser} notify={setToast} />}
            </>
          )}
          <footer>
            <span>
              <Sprout size={14} /> Hecho para vivir con más tranquilidad.
            </span>
            <span>Financy · Tu espacio personal</span>
          </footer>
        </main>
        <div className="rate-strip">
          <span className="online-dot" />
          <strong>Tasas de referencia</strong>
          <span>
            USD / BCV{' '}
            <b>
              {rates?.bcv ? Number(rates.bcv).toLocaleString('es-VE') + ' Bs' : 'No disponible'}
            </b>
          </span>
          <span>
            USD / Paralelo{' '}
            <b>
              {rates?.parallel
                ? Number(rates.parallel).toLocaleString('es-VE') + ' Bs'
                : 'No disponible'}
            </b>
          </span>
          <span>
            EUR / BCV{' '}
            <b>
              {rates?.euro ? Number(rates.euro).toLocaleString('es-VE') + ' Bs' : 'No disponible'}
            </b>
          </span>
          <span>
            EUR / Paralelo{' '}
            <b>
              {rates?.euro_parallel
                ? Number(rates.euro_parallel).toLocaleString('es-VE') + ' Bs'
                : 'No disponible'}
            </b>
          </span>
          <Link to="/calculator" className="rate-strip-calc">
            <Calculator size={13} /> Ir al conversor
          </Link>
          <small>
            {rates?.effective_date ? 'DolarAPI · ' + rates.effective_date : 'Sin tasas disponibles'}
          </small>
        </div>
      </div>
      {modal && (
        <Modal title={modal.title} close={() => setModal(null)}>
          {modal.content}
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
          <button className="icon-button" aria-label="Cerrar aviso" onClick={() => setToast('')}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
function NotificationsModal({ close, navigate }: { close: () => void; navigate: (path: string) => void }) {
  const [data, setData] = useState<any>(null),
    [deviceSubscribed, setDeviceSubscribed] = useState<boolean | null>(null);
  useEffect(() => {
    api('/notifications')
      .then(setData)
      .catch(() => setData({ items: [], budget: null, push_enabled: false, push_supported: false }));
    if (pushSupported())
      getPushSubscription()
        .then((s) => setDeviceSubscribed(!!s))
        .catch(() => setDeviceSubscribed(false));
    else setDeviceSubscribed(false);
  }, []);
  if (!data) return <Loading />;
  const showPushBanner = data.push_supported && pushSupported() && deviceSubscribed === false;
  return (
    <div className="notifications-modal">
      {showPushBanner && (
        <div className="notice">
          Activa las notificaciones push para enterarte de tus movimientos próximos y tu límite de
          gastos aunque no tengas Financy abierto.
          <button
            className="small-button"
            onClick={() => {
              close();
              navigate('/profile');
            }}
          >
            Activar en Configuración
          </button>
        </div>
      )}
      {data.budget && data.budget.level !== 'ok' && (
        <div className={'notice ' + (data.budget.level === 'exceeded' ? 'notice-danger' : 'notice-warning')}>
          {data.budget.level === 'exceeded'
            ? `Superaste tu límite mensual de gastos: ${usd(data.budget.spent)} de ${usd(data.budget.limit)}.`
            : `Vas por el ${data.budget.percent}% de tu límite mensual (${usd(data.budget.spent)} de ${usd(data.budget.limit)}).`}
        </div>
      )}
      {data.items.length ? (
        <ul className="notification-list">
          {data.items.map((i: any) => (
            <li key={i.type + i.id} className={i.overdue ? 'overdue' : ''}>
              <span className={'entry-icon ' + (i.type === 'earnings' ? 'positive-bg' : 'expense-bg')}>
                {i.type === 'earnings' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
              </span>
              <div>
                <strong>{i.description}</strong>
                <small>
                  {i.overdue ? 'Venció' : 'Vence'} {dateLabel(i.due_at)} · {usd(i.amount)}
                </small>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        !showPushBanner &&
        (!data.budget || data.budget.level === 'ok') && (
          <Empty
            title="Todo tranquilo"
            description="No tienes movimientos próximos ni avisos pendientes."
          />
        )
      )}
    </div>
  );
}
function QuickConverter({ rates }: { rates: any }) {
  const [open, setOpen] = useState(false),
    [currency, setCurrency] = useState<'bcv' | 'eur'>('bcv'),
    [amount, setAmount] = useState(''),
    [result, setResult] = useState<number | null>(null);
  function calculate(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amount.replace(',', '.'));
    const rate = currency === 'eur' ? rates?.euro : rates?.bcv;
    setResult(Number.isFinite(n) && n > 0 && rate ? n * rate : null);
  }
  return (
    <section className={'panel quick-converter' + (open ? ' open' : '')}>
      <button
        type="button"
        className="quick-converter-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>
          <Calculator size={16} /> Calcular
        </span>
        <ChevronLeft size={16} className={open ? 'open' : ''} />
      </button>
      {open && (
        <form className="quick-converter-form" onSubmit={calculate}>
          <select
            aria-label="Moneda"
            value={currency}
            onChange={(e) => {
              setCurrency(e.target.value as 'bcv' | 'eur');
              setResult(null);
            }}
          >
            <option value="bcv">Dólar BCV</option>
            <option value="eur">Euro BCV</option>
          </select>
          <input
            aria-label="Monto a convertir"
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setResult(null);
            }}
            placeholder="0,00"
          />
          <button className="primary" type="submit" disabled={!rates}>
            Calcular
          </button>
          {result != null && (
            <span className="quick-converter-result">
              {new Intl.NumberFormat('es-VE', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }).format(result)}{' '}
              Bs
            </span>
          )}
          <Link className="text-link" to="/calculator">
            Conversor avanzado <ArrowRight size={14} />
          </Link>
        </form>
      )}
    </section>
  );
}
function Metric({
  title,
  value,
  icon,
  positive = false,
  upcoming,
  upcomingLabel = 'próximos',
}: {
  title: string;
  value: string;
  icon: ReactNode;
  positive?: boolean;
  upcoming?: string | null;
  upcomingLabel?: string;
}) {
  const upcomingValue = upcoming == null ? null : Number(upcoming);
  return (
    <section className="metric-card">
      <div className="card-label">
        {title}
        <span className={positive ? 'positive-bg' : 'expense-bg'}>{icon}</span>
      </div>
      <h2>{usd(value)}</h2>
      {upcomingValue != null && upcomingValue !== 0 && (
        <small className={'metric-upcoming ' + (upcomingValue >= 0 ? 'positive' : 'danger')}>
          {upcomingValue >= 0 ? '+' : '−'} {usd(Math.abs(upcomingValue))} {upcomingLabel}
        </small>
      )}
    </section>
  );
}
function FlowChart({ rows, month }: { rows: any[]; month: string }) {
  if (!rows.length)
    return (
      <Empty
        title="Aquí empieza tu historia"
        description="Registra ingresos y gastos para descubrir el ritmo de tu dinero."
      />
    );
  const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate();
  const buckets = Array.from({ length: days }, (_, i) => ({ day: i + 1, earning: 0, expense: 0 }));
  for (const r of rows) {
    const index = Number(r.day.slice(-2)) - 1;
    if (buckets[index]) buckets[index][r.type as 'earning' | 'expense'] = Number(r.amount);
  }
  const max = Math.max(1, ...buckets.flatMap((b) => [b.earning, b.expense]));
  return (
    <div className="chart">
      <div className="chart-scale">
        {[1, 0.75, 0.5, 0.25, 0].map((x) => (
          <span key={x}>{usd(max * x)}</span>
        ))}
      </div>
      <div className="chart-plot">
        <div className="chart-grid">
          {[0, 1, 2, 3, 4].map((n) => (
            <i key={n} />
          ))}
        </div>
        <div className="chart-bars">
          {buckets.map((b) => (
            <div
              className="bar-group"
              key={b.day}
              tabIndex={0}
              aria-label={`Día ${b.day}: ingresos ${usd(b.earning)}, gastos ${usd(b.expense)}`}
            >
              <span className="bar income" style={{ height: `${(b.earning / max) * 100}%` }} />
              <span className="bar expense" style={{ height: `${(b.expense / max) * 100}%` }} />
              <div className="chart-tooltip">
                Día {b.day}
                <br />
                Ingresos {usd(b.earning)}
                <br />
                Gastos {usd(b.expense)}
              </div>
            </div>
          ))}
        </div>
        <div className="chart-dates">
          {[1, 5, 10, 15, 20, 25, days].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
function ActivityPage() {
  const [items, setItems] = useState<any[] | null>(null),
    [hasMore, setHasMore] = useState(false),
    [busy, setBusy] = useState(''),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  async function load(before?: string) {
    if (before) setLoading(true);
    setError('');
    try {
      const data = await api('/activity' + (before ? '?before=' + before : ''));
      setItems((prev) => (before && prev ? [...prev, ...data.activity] : data.activity));
      setHasMore(data.has_more);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function undo(id: string) {
    setBusy(id);
    setError('');
    try {
      await api('/activity/' + id + '/undo', 'POST', {});
      setItems((prev) =>
        prev!.map((a) => (a.id === id ? { ...a, undone_at: new Date().toISOString() } : a)),
      );
      window.dispatchEvent(
        new CustomEvent('financy:reload', { detail: 'Acción deshecha. Tus finanzas están actualizadas.' }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  if (loading && !items) return <Loading />;
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Historial de acciones</h2>
          <p>Tuyas y de Financy IA. Deshaz lo que no era lo que querías.</p>
        </div>
      </div>
      {error && (
        <div className="error" role="alert" style={{ margin: '0 23px 18px' }}>
          {error}
        </div>
      )}
      {items?.length ? (
        <div className="activity-list">
          {items.map((a) => (
            <div className={'activity-row' + (a.undone_at ? ' undone' : '')} key={a.id}>
              <span className="entry-icon">
                {a.source === 'ai' ? <Sparkles size={18} /> : <History size={18} />}
              </span>
              <div className="activity-description">
                <strong>{a.summary}</strong>
                <small>
                  {a.source === 'ai' ? 'Financy IA' : 'Tú'} ·{' '}
                  {new Intl.DateTimeFormat('es-VE', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                    timeZone: 'America/Caracas',
                  }).format(new Date(a.created_at))}
                </small>
              </div>
              {a.undone_at ? (
                <span className="badge">Deshecho</span>
              ) : a.can_undo ? (
                <button className="small-button" disabled={busy === a.id} onClick={() => void undo(a.id)}>
                  <Undo2 size={14} /> Deshacer
                </button>
              ) : (
                <span className="badge">No reversible</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Empty
          title="Sin actividad todavía"
          description="Aquí verás cada acción tuya o de Financy IA, con opción de deshacerla."
        />
      )}
      {hasMore && (
        <div className="upcoming-link">
          <button className="text-link" disabled={loading} onClick={() => void load(items![items!.length - 1].id)}>
            Cargar más <ArrowRight size={14} />
          </button>
        </div>
      )}
    </section>
  );
}
function CalculatorPage({ rates }: { rates: any }) {
  const [rateType, setRateType] = useState<'parallel' | 'bcv'>('parallel');
  const [fields, setFields] = useState({ bs: '', usd: '', eur: '' });
  const usdToBs = rateType === 'parallel' ? rates?.parallel : rates?.bcv;
  const eurToBs = rateType === 'parallel' ? rates?.euro_parallel : rates?.euro;
  const ready = Boolean(usdToBs && eurToBs);
  function fromField(field: 'bs' | 'usd' | 'eur', raw: string) {
    if (!/^\d*[.,]?\d*$/.test(raw)) return;
    const n = Number(raw.replace(',', '.'));
    if (raw === '' || !Number.isFinite(n) || !ready) {
      setFields((f) => ({ ...f, [field]: raw }));
      return;
    }
    const bs = field === 'bs' ? n : field === 'usd' ? n * usdToBs : n * eurToBs;
    setFields({
      bs: field === 'bs' ? raw : bs.toFixed(2),
      usd: field === 'usd' ? raw : (bs / usdToBs).toFixed(2),
      eur: field === 'eur' ? raw : (bs / eurToBs).toFixed(2),
    });
  }
  return (
    <div className="calculator-layout">
      <section className="panel padded">
        <h2>Convierte entre monedas</h2>
        <p className="muted">
          Escribe en cualquier campo; los demás se actualizan automáticamente.
        </p>
        <div className="form">
          <label>
            Tasa
            <select value={rateType} onChange={(e) => setRateType(e.target.value as any)}>
              <option value="parallel">Paralelo</option>
              <option value="bcv">Oficial (BCV)</option>
            </select>
          </label>
          <label>
            Bolívares (Bs)
            <input
              inputMode="decimal"
              value={fields.bs}
              onChange={(e) => fromField('bs', e.target.value)}
              placeholder="0,00"
            />
          </label>
          <label>
            Dólares ($)
            <input
              inputMode="decimal"
              value={fields.usd}
              onChange={(e) => fromField('usd', e.target.value)}
              placeholder="0,00"
            />
          </label>
          <label>
            Euros (€)
            <input
              inputMode="decimal"
              value={fields.eur}
              onChange={(e) => fromField('eur', e.target.value)}
              placeholder="0,00"
            />
          </label>
        </div>
        {!ready && (
          <p className="form-note">
            Algunas tasas no están disponibles en este momento. Intenta de nuevo más tarde.
          </p>
        )}
      </section>
      <section className="panel padded">
        <h2>Una referencia clara</h2>
        <p className="muted">
          Las tasas provienen de DolarAPI. Si una tasa no está disponible, la conversión se detiene.
        </p>
        {[
          ['bcv', 'Dólar oficial'],
          ['parallel', 'Dólar paralelo'],
          ['euro', 'Euro oficial'],
          ['euro_parallel', 'Euro paralelo'],
        ].map(([key, label]) => (
          <div className="rate-row" key={key}>
            <span>{label}</span>
            <strong>{rates?.[key] ? rates[key] + ' Bs' : 'No disponible'}</strong>
          </div>
        ))}
        <p className="form-note">
          Las conversiones históricas buscan hasta 7 días anteriores. EUR oficial usa euro/BCV; la
          opción legado conserva euro/paralelo.
        </p>
      </section>
    </div>
  );
}
function Profile({
  user,
  setUser,
  notify,
}: {
  user: any;
  setUser: (u: any) => void;
  notify: (s: string) => void;
}) {
  return (
    <div className="profile-grid">
      <section className="panel padded">
        <h2>Información personal</h2>
        <Form
          onDone={() => notify('Perfil actualizado')}
          onSubmit={async (v) => {
            if (v.password) await api('/auth/confirm-password', 'POST', { password: v.password });
            const u = await api('/auth/profile', 'PATCH', {
              name: v.name,
              email: v.email,
              monthly_expense_limit: v.monthly_expense_limit,
            });
            setUser(u);
          }}
        >
          <label>
            Nombre
            <input name="name" defaultValue={user.name} required />
          </label>
          <label>
            Correo
            <input name="email" type="email" defaultValue={user.email} required />
          </label>
          <label>
            Límite mensual de gastos (USD)
            <input
              name="monthly_expense_limit"
              type="number"
              min="0"
              step="0.01"
              defaultValue={user.monthly_expense_limit || 0}
              required
            />
            <small>Usa 0 para no establecer un límite.</small>
          </label>
          <label>
            Contraseña actual
            <input name="password" type="password" autoComplete="current-password" />
            <small>Necesaria si cambias el correo.</small>
          </label>
        </Form>
        {!user.email_verified_at && (
          <Form
            label="Reenviar verificación"
            onDone={() => notify('Correo de verificación solicitado')}
            onSubmit={() => api('/auth/verification-notification', 'POST', {})}
          >
            <p className="form-note">Verifica tu correo para recibir recordatorios.</p>
          </Form>
        )}
      </section>
      <div>
        <section className="panel padded">
          <h2>Apariencia</h2>
          <p className="muted">Elige cómo se ve Financy en este dispositivo.</p>
          <div className="appearance-row">
            <ThemeSelect />
            <ChatFontSizeSelect />
          </div>
        </section>
        <PushSettings notify={notify} />
        <section className="panel padded">
          <h2>Cambiar contraseña</h2>
          <Form
            label="Actualizar contraseña"
            onDone={() => setUser(null)}
            onSubmit={(v) => api('/auth/password', 'POST', v)}
          >
            <label>
              Contraseña actual
              <input
                name="current_password"
                type="password"
                required
                autoComplete="current-password"
              />
            </label>
            <label>
              Nueva contraseña
              <input
                name="password"
                type="password"
                minLength={10}
                maxLength={72}
                required
                autoComplete="new-password"
              />
            </label>
            <p className="form-note">Se cerrarán las sesiones activas.</p>
          </Form>
        </section>
        <section className="panel padded danger-zone">
          <h2>Tu cuenta, bajo tu control</h2>
          <button
            className="secondary"
            onClick={async () => {
              await api('/auth/logout', 'POST', {});
              setUser(null);
            }}
          >
            <LogOut size={16} /> Cerrar sesión
          </button>
          <details>
            <summary>Eliminar mi cuenta</summary>
            <Form
              label="Eliminar mi cuenta definitivamente"
              onDone={() => setUser(null)}
              onSubmit={(v) => api('/auth/profile', 'DELETE', v)}
            >
              <p>Se eliminarán permanentemente tu perfil y todos tus datos financieros.</p>
              <label>
                Confirma tu contraseña
                <input type="password" name="password" required />
              </label>
              <label className="checkbox">
                <input type="checkbox" required /> Entiendo que no podré recuperar mis datos.
              </label>
            </Form>
          </details>
        </section>
      </div>
    </div>
  );
}
function PushSettings({ notify }: { notify: (s: string) => void }) {
  const [subscribed, setSubscribed] = useState<boolean | null>(null),
    [busy, setBusy] = useState(false),
    [testing, setTesting] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    if (!pushSupported()) return setSubscribed(false);
    getPushSubscription()
      .then((s) => setSubscribed(!!s))
      .catch(() => setSubscribed(false));
  }, []);
  async function toggle() {
    setBusy(true);
    setError('');
    try {
      if (subscribed) {
        await disablePush();
        setSubscribed(false);
        notify('Notificaciones push desactivadas');
      } else {
        await enablePush();
        setSubscribed(true);
        notify('Notificaciones push activadas');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function test() {
    setTesting(true);
    setError('');
    try {
      await api('/notifications/test', 'POST', {});
      notify('Notificación de prueba enviada. Deberías verla en unos segundos.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTesting(false);
    }
  }
  return (
    <section className="panel padded">
      <h2>Notificaciones push</h2>
      <p className="muted">
        Recibe avisos de movimientos próximos y de tu límite de gastos en este dispositivo, incluso
        con Financy cerrado.
      </p>
      {!pushSupported() ? (
        <p className="form-note">Este navegador no admite notificaciones push.</p>
      ) : (
        <>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <div className="push-settings-actions">
            <button className="secondary" disabled={busy || subscribed === null} onClick={toggle}>
              <Bell size={16} /> {subscribed ? 'Desactivar notificaciones' : 'Activar notificaciones'}
            </button>
            {subscribed && (
              <button className="secondary" disabled={testing} onClick={test}>
                <Sparkles size={16} /> {testing ? 'Enviando…' : 'Probar'}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
function SavingsModal({ item, done }: { item: any; done: () => void }) {
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit');
  const saved = Number(item.saved || 0);
  const target = Number(item.amount);
  const percent = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
  return (
    <div className="savings-modal">
      <div
        className="savings-graphic"
        style={{ '--progress': `${percent}%` } as React.CSSProperties}
      >
        <div>
          <small>AHORRADO</small>
          <strong>
            {Math.round(percent)}
            <span>%</span>
          </strong>
        </div>
      </div>
      <div className="savings-values">
        <strong>{usd(saved)}</strong>
        <span>de {usd(target)}</span>
      </div>
      <div className="savings-tabs">
        <button
          type="button"
          className={tab === 'deposit' ? 'selected' : ''}
          onClick={() => setTab('deposit')}
        >
          Abonar
        </button>
        <button
          type="button"
          className={tab === 'withdraw' ? 'selected' : ''}
          disabled={saved <= 0}
          onClick={() => setTab('withdraw')}
        >
          Retirar
        </button>
      </div>
      {tab === 'deposit' ? (
        <Form
          key="deposit"
          onDone={done}
          label="Confirmar abono"
          onSubmit={(v) => api('/shopping/' + item.id + '/deposit', 'POST', v)}
        >
          <Provider auto={false} />
          <Amount />
        </Form>
      ) : (
        <Form
          key="withdraw"
          onDone={done}
          label="Confirmar retiro"
          onSubmit={(v) => api('/shopping/' + item.id + '/withdraw', 'POST', v)}
        >
          <Provider auto={false} />
          <Amount />
          <p className="form-note">Puedes retirar hasta {usd(saved)}.</p>
        </Form>
      )}
    </div>
  );
}
function SplitForm({ item, done }: { item: any; done: () => void }) {
  const [rows, setRows] = useState<any[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  useEffect(() => {
    api('/expenses/' + item.id + '/splits')
      .then(setRows)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [item.id]);
  if (loading) return <Loading />;
  if (error) return <div className="error">{error}</div>;
  return (
    <Form
      onDone={done}
      onSubmit={() =>
        api('/expenses/' + item.id + '/splits', 'POST', {
          splits: rows.map((r) => ({
            user_id: String(r.user_id),
            amount: String(r.amount),
            paid_amount: Number(r.paid_amount || 0),
          })),
        })
      }
    >
      <p>
        Distribuye {usd(item.amount)} entre los participantes. El reparto lleva control de pagos,
        sin transferir dinero.
      </p>
      {rows.map((r, i) => (
        <div className="split-row" key={i}>
          <label>
            ID de usuario
            <input
              required
              value={r.user_id}
              onChange={(e) =>
                setRows(rows.map((v, j) => (j === i ? { ...v, user_id: e.target.value } : v)))
              }
            />
          </label>
          <label>
            Parte (USD)
            <input
              required
              type="number"
              min="0.01"
              step=".01"
              value={r.amount}
              onChange={(e) =>
                setRows(rows.map((v, j) => (j === i ? { ...v, amount: e.target.value } : v)))
              }
            />
          </label>
          <label>
            Pagado
            <input
              type="number"
              min="0"
              step=".01"
              value={r.paid_amount}
              onChange={(e) =>
                setRows(rows.map((v, j) => (j === i ? { ...v, paid_amount: e.target.value } : v)))
              }
            />
          </label>
          <button
            type="button"
            className="icon-button"
            aria-label="Quitar participante"
            onClick={() => setRows(rows.filter((_, j) => j !== i))}
          >
            <X size={16} />
          </button>
        </div>
      ))}
      <div className="row-actions">
        <button
          className="secondary"
          type="button"
          onClick={() => setRows([...rows, { user_id: '', amount: '', paid_amount: 0 }])}
        >
          Añadir participante
        </button>
        <button
          type="button"
          className="secondary"
          disabled={!rows.length}
          onClick={() => {
            const cents = Math.round(Number(item.amount) * 100),
              base = Math.floor(cents / rows.length);
            setRows(
              rows.map((r, i) => ({
                ...r,
                amount: ((base + (i < cents % rows.length ? 1 : 0)) / 100).toFixed(2),
              })),
            );
          }}
        >
          Dividir por igual
        </button>
      </div>
      <small>Quita todos los participantes y guarda para eliminar el reparto.</small>
    </Form>
  );
}
