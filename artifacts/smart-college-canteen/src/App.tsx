import { type ButtonHTMLAttributes, type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import {
  ArrowRight,
  BarChart3,
  Bell,
  Check,
  ChevronRight,
  Clock3,
  Edit3,
  Flame,
  Leaf,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Trash2,
  UserRound,
  Utensils,
  X,
} from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

type Role = 'student' | 'admin';
type Status = 'queued' | 'confirmed' | 'preparing' | 'ready' | 'collected' | 'cancelled';
type Category = 'all' | 'quick bites' | 'meals' | 'drinks';

type MenuItem = {
  id: number;
  name: string;
  category: Exclude<Category, 'all'>;
  price: number;
  description: string;
  image: string;
  available: boolean;
  popular?: boolean;
};

type CartLine = { itemId: number; quantity: number };
type Order = {
  id: string;
  token: string;
  createdAt: string;
  status: Status;
  items: Array<{ itemId: number; name: string; price: number; quantity: number }>;
  total: number;
  customer: string;
  customerEmail?: string;
};

type CurrentUser = { name: string; email: string; role: Role };
type StudentAccount = {
  name: string;
  studentId: string;
  email: string;
  mobile: string;
  passwordHash: string;
};

const MENU_KEY = 'scc_menu_v1';
const CART_KEY = 'scc_cart_v1';
const ORDERS_KEY = 'scc_orders_v1';
const USER_KEY = 'scc_user_v1';
const ACCOUNTS_KEY = 'scc_accounts_v1';

const seedMenu: MenuItem[] = [
  { id: 1, name: 'Veg Sandwich', category: 'quick bites', price: 40, description: 'Toasted bread layered with garden vegetables, cheese and mint chutney.', image: 'https://images.pexels.com/photos/1600711/pexels-photo-1600711.jpeg?auto=compress&cs=tinysrgb&w=900', available: true, popular: true },
  { id: 2, name: 'Masala Dosa', category: 'meals', price: 60, description: 'Crisp rice crepe with spiced potato masala and coconut chutney.', image: 'https://images.pexels.com/photos/5560763/pexels-photo-5560763.jpeg?auto=compress&cs=tinysrgb&w=900', available: true, popular: true },
  { id: 3, name: 'Vada Pav', category: 'quick bites', price: 20, description: 'Mumbai-style potato fritter in a soft bun with garlic chutney.', image: 'https://images.pexels.com/photos/5410418/pexels-photo-5410418.jpeg?auto=compress&cs=tinysrgb&w=900', available: true },
  { id: 4, name: 'Veg Burger', category: 'quick bites', price: 50, description: 'Crispy veg patty, fresh lettuce and tangy house sauce in a toasted bun.', image: 'https://images.pexels.com/photos/1639557/pexels-photo-1639557.jpeg?auto=compress&cs=tinysrgb&w=900', available: true },
  { id: 5, name: 'Samosa', category: 'quick bites', price: 20, description: 'Golden pastry filled with potato, peas and warm whole spices.', image: 'https://images.pexels.com/photos/6646072/pexels-photo-6646072.jpeg?auto=compress&cs=tinysrgb&w=900', available: true },
  { id: 6, name: 'Pizza', category: 'meals', price: 80, description: 'Cheesy personal pizza with peppers, onion and a bright tomato base.', image: 'https://images.pexels.com/photos/825661/pexels-photo-825661.jpeg?auto=compress&cs=tinysrgb&w=900', available: true },
  { id: 7, name: 'Cold Drink', category: 'drinks', price: 30, description: 'Chilled, fizzy refreshment for the walk between lectures.', image: 'https://images.pexels.com/photos/2983100/pexels-photo-2983100.jpeg?auto=compress&cs=tinysrgb&w=900', available: true },
  { id: 8, name: 'Tea', category: 'drinks', price: 15, description: 'A hot, milky cup brewed with cardamom for the mid-morning reset.', image: 'https://images.pexels.com/photos/1417945/pexels-photo-1417945.jpeg?auto=compress&cs=tinysrgb&w=900', available: true },
  { id: 9, name: 'Coffee', category: 'drinks', price: 25, description: 'Dark, aromatic coffee with enough lift for the last tutorial.', image: 'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=900', available: true, popular: true },
];

const queryClient = new QueryClient();

function readStore<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function formatMoney(value: number) {
  return `₹${value.toLocaleString('en-IN')}`;
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

function statusLabel(status: Status) {
  const labels: Record<Status, string> = {
    queued: 'Pending',
    confirmed: 'Confirmed',
    preparing: 'Preparing',
    ready: 'Ready for pickup',
    collected: 'Completed',
    cancelled: 'Cancelled',
  };
  return labels[status];
}

function statusTone(status: Status) {
  if (status === 'ready') return 'bg-[#dff3e8] text-[#1e7358]';
  if (status === 'preparing') return 'bg-[#fff0c5] text-[#936600]';
  if (status === 'confirmed') return 'bg-[#e9eef2] text-[#51616c]';
  if (status === 'collected') return 'bg-[#e9e7f7] text-[#55508c]';
  if (status === 'cancelled') return 'bg-[#fbe2de] text-[#a63b31]';
  return 'bg-[#e9eef2] text-[#51616c]';
}

async function hashPassword(password: string) {
  const encoded = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function createToken(orders: Order[]) {
  const taken = new Set(orders.map((order) => order.token));
  for (let number = 100; number <= 999; number += 1) {
    const token = `C-${number}`;
    if (!taken.has(token)) return token;
  }
  return `C-${Date.now().toString().slice(-6)}`;
}

function userOrders(orders: Order[], user: CurrentUser | null) {
  if (!user) return [];
  if (user.role === 'admin') return orders;
  return orders.filter((order) => order.customerEmail === user.email || (!order.customerEmail && order.customer === user.name));
}

function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" data-testid="link-logo">
      <span className={`grid size-10 place-items-center rounded-[13px] ${dark ? 'bg-[#f9d856] text-[#202941]' : 'bg-[#e95f4d] text-[#fff9ed]'}`}>
        <Leaf size={20} strokeWidth={2.5} />
      </span>
      <span className={`font-display text-[1.16rem] font-bold tracking-[-.03em] sm:text-[1.34rem] ${dark ? 'text-[#fff9ed]' : 'text-[#202941]'}`}>
        Smart College <span className={dark ? 'text-[#f9d856]' : 'text-[#e95f4d]'}>Canteen</span>
      </span>
    </Link>
  );
}

function Button({ children, className = '', variant = 'primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'soft' | 'ghost' | 'dark' }) {
  const variants = {
    primary: 'bg-[#e95f4d] text-[#fff9ed] shadow-warm hover:-translate-y-0.5',
    soft: 'bg-[#f9d856] text-[#202941] hover:-translate-y-0.5',
    dark: 'bg-[#202941] text-[#fff9ed] hover:-translate-y-0.5',
    ghost: 'border border-[#e3d8c7] bg-[#fffdf8] text-[#202941] hover:border-[#e95f4d] hover:text-[#e95f4d]',
  };
  return <button className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-45 ${variants[variant]} ${className}`} {...props}>{children}</button>;
}

function AppShell({ children, user, cartCount, onLogout }: { children: ReactNode; user: CurrentUser | null; cartCount: number; onLogout: () => void }) {
  const [location] = useLocation();
  const authPage = ['/login', '/register', '/admin-login'].includes(location);
  const navItems = [
    { href: '/', label: 'Home', icon: Sparkles },
    { href: '/menu', label: 'Order', icon: Utensils },
    { href: '/orders', label: 'Orders', icon: Clock3 },
    { href: '/dashboard', label: 'Profile', icon: UserRound },
  ];
  if (authPage) return <>{children}</>;
  return (
    <div className="min-h-[100dvh] bg-[#fff9ed]">
      <header className="sticky top-0 z-40 border-b border-[#eee3d3]/90 bg-[#fff9ed]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1240px] items-center justify-between px-5 lg:px-8">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className={`rounded-lg px-3.5 py-2 text-sm font-bold transition-colors ${location === href ? 'bg-[#f9d856]/35 text-[#202941]' : 'text-[#68717b] hover:text-[#e95f4d]'}`} data-testid={`link-nav-${label.toLowerCase()}`}>
                {label}
              </Link>
            ))}
            {user?.role === 'admin' && <Link href="/admin" className={`rounded-lg px-3.5 py-2 text-sm font-bold ${location === '/admin' ? 'bg-[#202941] text-[#fff9ed]' : 'text-[#68717b] hover:text-[#e95f4d]'}`} data-testid="link-nav-admin">Admin</Link>}
          </nav>
          <div className="flex items-center gap-2.5">
            <Link href="/cart" className="relative grid size-11 place-items-center rounded-xl border border-[#e3d8c7] bg-[#fffdf8] text-[#202941] transition hover:border-[#e95f4d] hover:text-[#e95f4d]" data-testid="link-cart">
              <ShoppingCart size={19} />
              {cartCount > 0 && <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-[#e95f4d] px-1 text-[10px] font-extrabold text-white">{cartCount}</span>}
            </Link>
            {user ? (
              <button onClick={onLogout} className="hidden items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-[#f3e9d9] sm:flex" data-testid="button-logout">
                <span className="grid size-9 place-items-center rounded-full bg-[#d9efe2] text-xs font-extrabold text-[#1e7358]">{user.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span>
                <span className="max-w-[92px] truncate text-xs font-bold text-[#202941]">{user.name}</span>
              </button>
            ) : (
              <Link href="/login" className="hidden rounded-xl bg-[#202941] px-4 py-2.5 text-sm font-bold text-[#fff9ed] transition hover:-translate-y-0.5 sm:block" data-testid="link-login">Sign in</Link>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1240px] px-5 pb-28 pt-7 lg:px-8 lg:pb-12">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-[#e9dece] bg-[#fffdf8]/95 px-3 py-2 backdrop-blur-xl md:hidden" aria-label="Mobile navigation">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={`flex flex-1 flex-col items-center gap-1 py-1.5 text-[10px] font-bold ${location === href ? 'text-[#e95f4d]' : 'text-[#7d858a]'}`} data-testid={`mobile-link-${label.toLowerCase()}`}>
            <Icon size={19} strokeWidth={location === href ? 2.6 : 2} /><span>{label}</span>
          </Link>
        ))}
        <Link href="/cart" className={`flex flex-1 flex-col items-center gap-1 py-1.5 text-[10px] font-bold ${location === '/cart' ? 'text-[#e95f4d]' : 'text-[#7d858a]'}`} data-testid="mobile-link-cart">
          <span className="relative"><ShoppingCart size={19} />{cartCount > 0 && <span className="absolute -right-2 -top-2 grid size-4 place-items-center rounded-full bg-[#e95f4d] text-[9px] text-white">{cartCount}</span>}</span><span>Cart</span>
        </Link>
      </nav>
    </div>
  );
}

function SectionTitle({ eyebrow, title, detail }: { eyebrow?: string; title: string; detail?: string }) {
  return <div className="mb-7"><p className="mb-2 text-xs font-extrabold uppercase tracking-[.16em] text-[#e95f4d]">{eyebrow}</p><h1 className="font-display text-4xl font-bold leading-[1.03] tracking-[-.045em] text-[#202941] md:text-5xl">{title}</h1>{detail && <p className="mt-3 max-w-2xl text-sm leading-6 text-[#68717b]">{detail}</p>}</div>;
}

function HomePage({ menu, activeOrder, user }: { menu: MenuItem[]; activeOrder: Order | undefined; user: CurrentUser | null }) {
  const featured = menu.filter((item) => item.popular && item.available).slice(0, 3);
  return (
    <div className="animate-float-in space-y-14">
      <section className="relative overflow-hidden rounded-[28px] bg-[#202941] px-6 py-10 text-[#fff9ed] shadow-lg md:px-12 md:py-14 lg:px-16 lg:py-16">
        <div className="absolute -right-20 -top-28 size-72 rounded-full bg-[#e95f4d]/25 blur-2xl" />
        <div className="absolute -bottom-28 left-1/3 size-80 rounded-full bg-[#f9d856]/15 blur-3xl" />
        <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_430px]">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-[#f9d856]"><Sparkles size={14} /> Your campus, served smarter</div>
            <h1 className="font-display text-[3.2rem] font-bold leading-[.94] tracking-[-.055em] sm:text-6xl lg:text-[5.2rem]">Good food.<br /><span className="text-[#f9d856]">Zero queue.</span></h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-[#d7d8d4]">Pre-order your canteen favourites between classes. We cook it fresh, call your token, and keep your break yours.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/menu" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#e95f4d] px-5 text-sm font-extrabold text-white shadow-warm transition hover:-translate-y-0.5" data-testid="link-start-order">Browse today's menu <ArrowRight size={17} /></Link>
              {!user && <Link href="/register" className="inline-flex min-h-12 items-center rounded-xl border border-white/20 px-5 text-sm font-bold text-[#fff9ed] transition hover:bg-white/10" data-testid="link-join-club">Join the club</Link>}
            </div>
            <div className="mt-9 flex flex-wrap gap-5 text-xs font-semibold text-[#b9c2c3]"><span className="flex items-center gap-2"><Clock3 size={15} className="text-[#f9d856]" /> Ready in 8–12 min</span><span className="flex items-center gap-2"><ShieldCheck size={15} className="text-[#76c7a6]" /> No payment surprises</span></div>
          </div>
          <div className="relative min-h-[320px] overflow-hidden rounded-[22px] border border-white/10 bg-[#314058]">
            <img src="https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg?auto=compress&cs=tinysrgb&w=1000" alt="A colourful fresh meal ready at the canteen" className="absolute inset-0 size-full object-cover opacity-90" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#202941]/85 via-transparent to-transparent" />
            <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between">
              <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#f9d856]">Lunch rush, handled</p><p className="mt-1 font-display text-2xl font-bold">Pick. Tap. Eat.</p></div>
              <span className="grid size-12 place-items-center rounded-full bg-[#f9d856] text-[#202941]"><Utensils size={20} /></span>
            </div>
          </div>
        </div>
      </section>
      {activeOrder && (
        <Link href="/orders" className="group flex flex-col justify-between gap-4 rounded-2xl border border-[#bfe1cf] bg-[#e8f6ed] p-5 transition hover:-translate-y-0.5 sm:flex-row sm:items-center" data-testid="card-active-order">
          <div className="flex items-center gap-4"><span className="grid size-12 place-items-center rounded-xl bg-[#1e7358] text-[#fff9ed]"><PackageCheck size={23} /></span><div><p className="text-xs font-extrabold uppercase tracking-[.13em] text-[#1e7358]">Your active order · token {activeOrder.token}</p><p className="mt-1 font-display text-xl font-bold text-[#202941]">{statusLabel(activeOrder.status)} <span className="font-sans text-sm font-medium text-[#68717b]">· {activeOrder.items.length} items · {formatMoney(activeOrder.total)}</span></p></div></div><span className="flex items-center gap-1 text-sm font-bold text-[#1e7358]">Track order <ChevronRight size={17} className="transition group-hover:translate-x-1" /></span>
        </Link>
      )}
      <section>
        <div className="mb-6 flex items-end justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#e95f4d]">Popular on campus</p><h2 className="mt-2 font-display text-3xl font-bold tracking-[-.04em] text-[#202941]">The 11:45 shortlist</h2></div><Link href="/menu" className="hidden items-center gap-1 text-sm font-bold text-[#e95f4d] sm:flex" data-testid="link-see-all">See full menu <ArrowRight size={16} /></Link></div>
        <div className="grid gap-4 md:grid-cols-3">{featured.map((item) => <MiniDish key={item.id} item={item} />)}</div>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {[{ n: '01', title: 'Choose your break', text: 'See what is hot, fresh and available before you leave class.', icon: Search }, { n: '02', title: 'Get a token', text: 'One tap gives you a clear pickup window and token number.', icon: Bell }, { n: '03', title: 'Walk past the queue', text: 'We will have your order ready when your break begins.', icon: PackageCheck }].map(({ n, title, text, icon: Icon }) => <div key={n} className="rounded-2xl border border-[#eadfce] bg-[#fffdf8] p-5"><span className="font-mono-app text-xs font-bold text-[#e95f4d]">{n}</span><Icon className="mt-8 text-[#1e7358]" size={24} /><h3 className="mt-4 font-display text-xl font-bold text-[#202941]">{title}</h3><p className="mt-2 text-sm leading-6 text-[#68717b]">{text}</p></div>)}
      </section>
    </div>
  );
}

function MiniDish({ item }: { item: MenuItem }) {
  return <Link href="/menu" className="group flex items-center gap-4 rounded-2xl border border-[#eadfce] bg-[#fffdf8] p-3.5 transition hover:-translate-y-1 hover:shadow-sm" data-testid={`card-featured-${item.id}`}><img src={item.image} alt={item.name} className="size-20 rounded-xl object-cover transition duration-300 group-hover:scale-105" /><div className="min-w-0 flex-1"><p className="text-[10px] font-extrabold uppercase tracking-[.13em] text-[#1e7358]">{item.category}</p><h3 className="mt-1 truncate font-display text-xl font-bold text-[#202941]">{item.name}</h3><p className="mt-1 text-sm font-bold text-[#e95f4d]">{formatMoney(item.price)}</p></div><ChevronRight className="text-[#9ba09e]" size={18} /></Link>;
}

function MenuCard({ item, quantity, onAdd }: { item: MenuItem; quantity: number; onAdd: (item: MenuItem) => void }) {
  return <article className={`group overflow-hidden rounded-2xl border bg-[#fffdf8] transition duration-300 ${item.available ? 'border-[#eadfce] hover:-translate-y-1 hover:shadow-lg' : 'border-[#e8e0d8] opacity-65'}`} data-testid={`card-menu-item-${item.id}`}>
    <div className="relative h-44 overflow-hidden bg-[#f1e8d8]"><img src={item.image} alt={item.name} className="size-full object-cover transition duration-500 group-hover:scale-105" /><div className="absolute inset-x-0 top-0 flex justify-between p-3">{item.popular && <span className="inline-flex items-center gap-1 rounded-full bg-[#f9d856] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-[#202941]"><Flame size={12} /> popular</span>}<span className={`ml-auto rounded-full px-2.5 py-1 text-[10px] font-extrabold ${item.available ? 'bg-[#dff3e8] text-[#1e7358]' : 'bg-[#202941]/80 text-white'}`}>{item.available ? 'Available' : 'Sold out'}</span></div></div>
    <div className="p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-display text-[1.35rem] font-bold leading-tight text-[#202941]">{item.name}</h3><p className="mt-1 text-xs font-bold uppercase tracking-[.12em] text-[#9b8b78]">{item.category}</p></div><span className="font-mono-app text-sm font-bold text-[#e95f4d]">{formatMoney(item.price)}</span></div><p className="mt-3 min-h-10 text-sm leading-5 text-[#68717b]">{item.description}</p><Button onClick={() => onAdd(item)} disabled={!item.available} variant={quantity ? 'soft' : 'primary'} className="mt-4 w-full" data-testid={`button-add-${item.id}`}>{quantity ? <><Check size={16} /> Added · {quantity}</> : <><Plus size={17} /> Add to order</>}</Button></div>
  </article>;
}

function MenuPage({ menu, cart, onAdd }: { menu: MenuItem[]; cart: CartLine[]; onAdd: (item: MenuItem) => void }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category>('all');
  const filtered = useMemo(() => menu.filter((item) => (category === 'all' || item.category === category) && item.name.toLowerCase().includes(search.toLowerCase())), [menu, search, category]);
  const categories: Array<{ value: Category; label: string }> = [{ value: 'all', label: 'Everything' }, { value: 'quick bites', label: 'Quick bites' }, { value: 'meals', label: 'Meals' }, { value: 'drinks', label: 'Drinks' }];
  return <div className="animate-float-in"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><SectionTitle eyebrow="Canteen menu" title="Pick your next favourite." detail="Everything is made for a college break: quick to order, easy to carry, and priced kindly." /><div className="mb-7 flex items-center gap-2 rounded-xl bg-[#dff3e8] px-3.5 py-2.5 text-xs font-bold text-[#1e7358]"><Clock3 size={16} /> Live availability</div></div>
    <div className="mb-7 flex flex-col gap-3 sm:flex-row"><label className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9b8b78]" size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sandwich, dosa, coffee..." className="h-12 w-full rounded-xl border border-[#e3d8c7] bg-[#fffdf8] pl-11 pr-4 text-sm font-semibold text-[#202941] outline-none transition focus:border-[#e95f4d] focus:ring-4 focus:ring-[#e95f4d]/10" data-testid="input-menu-search" /></label><div className="flex gap-2 overflow-x-auto pb-1">{categories.map((cat) => <button key={cat.value} onClick={() => setCategory(cat.value)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-extrabold transition ${category === cat.value ? 'bg-[#202941] text-[#fff9ed]' : 'border border-[#e3d8c7] bg-[#fffdf8] text-[#68717b] hover:border-[#202941]'}`} data-testid={`button-filter-${cat.value.replace(' ', '-')}`}>{cat.label}</button>)}</div></div>
    {filtered.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((item) => <MenuCard key={item.id} item={item} quantity={cart.find((line) => line.itemId === item.id)?.quantity ?? 0} onAdd={onAdd} />)}</div> : <div className="rounded-2xl border border-dashed border-[#d9cdbb] bg-[#fffdf8] px-6 py-16 text-center"><Search className="mx-auto text-[#e95f4d]" size={28} /><h2 className="mt-4 font-display text-2xl font-bold text-[#202941]">Nothing on that tray</h2><p className="mt-2 text-sm text-[#68717b]">Try a different search or browse everything.</p><button onClick={() => { setSearch(''); setCategory('all'); }} className="mt-5 text-sm font-bold text-[#e95f4d]" data-testid="button-clear-menu">Clear filters</button></div>}
  </div>;
}

function CartPage({ cart, menu, onQuantity, onRemove, onPlaceOrder, user }: { cart: CartLine[]; menu: MenuItem[]; onQuantity: (itemId: number, delta: number) => void; onRemove: (itemId: number) => void; onPlaceOrder: () => void; user: CurrentUser | null }) {
  const details = cart.map((line) => ({ ...line, item: menu.find((item) => item.id === line.itemId) })).filter((line): line is CartLine & { item: MenuItem } => Boolean(line.item));
  const total = details.reduce((sum, line) => sum + line.item.price * line.quantity, 0);
  return <div className="animate-float-in"><SectionTitle eyebrow="Your order" title="A very good break is close." detail="Tweak your basket, then choose a token pickup. We keep the queue on our side." />{details.length ? <div className="grid gap-7 lg:grid-cols-[1fr_360px]"><div className="space-y-3">{details.map(({ item, quantity }) => <div key={item.id} className="flex gap-3 rounded-2xl border border-[#eadfce] bg-[#fffdf8] p-3 sm:gap-5 sm:p-4" data-testid={`row-cart-${item.id}`}><img src={item.image} alt={item.name} className="size-24 rounded-xl object-cover sm:size-28" /><div className="flex min-w-0 flex-1 flex-col justify-between py-1"><div className="flex justify-between gap-3"><div><h3 className="font-display text-xl font-bold text-[#202941]">{item.name}</h3><p className="mt-1 text-xs text-[#68717b]">{formatMoney(item.price)} each</p></div><button onClick={() => onRemove(item.id)} className="grid size-8 place-items-center rounded-lg text-[#9b8b78] hover:bg-[#fbe2de] hover:text-[#a63b31]" aria-label={`Remove ${item.name}`} data-testid={`button-remove-${item.id}`}><Trash2 size={16} /></button></div><div className="flex items-center justify-between"><div className="inline-flex items-center rounded-lg border border-[#e3d8c7] bg-[#fff9ed]"><button onClick={() => onQuantity(item.id, -1)} className="grid size-9 place-items-center text-[#202941] hover:text-[#e95f4d]" aria-label={`Decrease ${item.name}`} data-testid={`button-decrease-${item.id}`}><Minus size={15} /></button><span className="w-7 text-center text-sm font-extrabold" data-testid={`text-quantity-${item.id}`}>{quantity}</span><button onClick={() => onQuantity(item.id, 1)} className="grid size-9 place-items-center text-[#202941] hover:text-[#e95f4d]" aria-label={`Increase ${item.name}`} data-testid={`button-increase-${item.id}`}><Plus size={15} /></button></div><span className="font-mono-app text-sm font-bold text-[#202941]">{formatMoney(item.price * quantity)}</span></div></div></div>)}</div><aside className="h-fit rounded-2xl bg-[#202941] p-6 text-[#fff9ed] shadow-lg lg:sticky lg:top-24"><p className="text-xs font-extrabold uppercase tracking-[.15em] text-[#f9d856]">Order summary</p><div className="mt-6 space-y-3 border-b border-white/15 pb-5 text-sm"><div className="flex justify-between text-[#c8ced0]"><span>Items</span><span>{details.reduce((sum, item) => sum + item.quantity, 0)}</span></div><div className="flex justify-between text-[#c8ced0]"><span>Pickup</span><span className="text-[#76c7a6]">Free</span></div></div><div className="flex justify-between pt-5"><span className="font-bold">Total</span><span className="font-mono-app text-xl font-bold text-[#f9d856]">{formatMoney(total)}</span></div><Button onClick={onPlaceOrder} variant="soft" className="mt-6 w-full" data-testid="button-place-order">{user ? 'Place pre-order' : 'Sign in to order'} <ArrowRight size={16} /></Button><p className="mt-3 text-center text-[11px] leading-4 text-[#aeb8bb]">Your token will appear instantly after placing.</p></aside></div> : <div className="rounded-2xl border border-dashed border-[#d9cdbb] bg-[#fffdf8] px-6 py-20 text-center"><span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#f9d856]/35 text-[#9a7800]"><ShoppingBag size={28} /></span><h2 className="mt-5 font-display text-3xl font-bold text-[#202941]">Your tray is empty</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#68717b]">A hot dosa, a crisp samosa, or just a strong coffee would look good here.</p><Link href="/menu" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#e95f4d] px-5 text-sm font-bold text-white shadow-warm" data-testid="link-empty-menu">Browse menu <ArrowRight size={17} /></Link></div>}</div>;
}

function OrdersPage({ orders, onStatus }: { orders: Order[]; onStatus: (id: string, status: Status) => void }) {
  const active = orders.find((order) => !['collected', 'cancelled'].includes(order.status));
  const history = orders.filter((order) => ['collected', 'cancelled'].includes(order.status));
  return <div className="animate-float-in"><SectionTitle eyebrow="Your tokens" title="Know exactly when to walk over." detail="Your live order stays here. Previous breaks stay useful for a one-tap reorder later." />{active ? <section className="mb-10 overflow-hidden rounded-2xl bg-[#202941] p-6 text-[#fff9ed] shadow-lg md:p-8"><div className="flex flex-col justify-between gap-7 md:flex-row md:items-start"><div><div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.15em] text-[#f9d856]"><span className="size-2 animate-pulse rounded-full bg-[#f9d856]" /> Live order · {formatTime(active.createdAt)}</div><h2 className="mt-3 font-display text-3xl font-bold">{statusLabel(active.status)} in the kitchen</h2><p className="mt-2 text-sm text-[#c9ced0]">{active.items.map((item) => `${item.quantity} × ${item.name}`).join(', ')}</p></div><div className="rounded-2xl bg-[#f9d856] px-7 py-5 text-center text-[#202941]"><p className="text-[10px] font-extrabold uppercase tracking-[.16em]">Pickup token</p><p className="mt-1 font-mono-app text-4xl font-bold">{active.token}</p></div></div><div className="mt-8 grid grid-cols-4 gap-2 border-t border-white/15 pt-6">{(['queued', 'confirmed', 'preparing', 'ready'] as Status[]).map((status, index) => <div key={status} className={`relative text-center ${['queued', 'confirmed', 'preparing', 'ready'].indexOf(active.status) >= index ? 'text-[#f9d856]' : 'text-[#78848a]'}`}><span className={`mx-auto grid size-8 place-items-center rounded-full border text-xs font-bold ${['queued', 'confirmed', 'preparing', 'ready'].indexOf(active.status) >= index ? 'border-[#f9d856] bg-[#f9d856] text-[#202941]' : 'border-white/20'}`}>{index + 1}</span><p className="mt-2 text-[10px] font-bold sm:text-[11px]">{statusLabel(status)}</p></div>)}</div>{active.status === 'ready' && <button onClick={() => onStatus(active.id, 'collected')} className="mt-6 w-full rounded-xl border border-[#f9d856]/50 py-3 text-sm font-bold text-[#f9d856] transition hover:bg-[#f9d856] hover:text-[#202941]" data-testid="button-mark-collected">Mark as collected</button>}</section> : <div className="mb-10 rounded-2xl bg-[#e8f6ed] p-7"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-[#1e7358] text-white"><Check size={21} /></span><div><h2 className="font-display text-2xl font-bold text-[#202941]">All clear for now.</h2><p className="mt-1 text-sm text-[#53756a]">Ready for your next campus craving?</p></div></div><Link href="/menu" className="mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-[#1e7358]" data-testid="link-order-again-empty">Start an order <ArrowRight size={16} /></Link></div>}{history.length > 0 && <section><div className="mb-4 flex items-center justify-between"><h2 className="font-display text-2xl font-bold text-[#202941]">Past orders</h2><span className="text-xs font-bold text-[#9b8b78]">{history.length} total</span></div><div className="space-y-3">{history.map((order) => <div key={order.id} className="flex flex-col justify-between gap-4 rounded-2xl border border-[#eadfce] bg-[#fffdf8] p-4 sm:flex-row sm:items-center" data-testid={`row-order-${order.id}`}><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-[#f3e9d9] font-mono-app text-xs font-bold text-[#202941]">{order.token}</span><div><p className="text-sm font-extrabold text-[#202941]">{order.items.map((item) => item.name).join(', ')}</p><p className="mt-1 text-xs text-[#8b918e]">{formatTime(order.createdAt)} · {formatMoney(order.total)}</p></div></div><span className={`w-fit rounded-full px-3 py-1.5 text-xs font-extrabold ${statusTone(order.status)}`}>{statusLabel(order.status)}</span></div>)}</div></section>}</div>;
}

function DashboardPage({ user, orders, menu, onLogout }: { user: CurrentUser | null; orders: Order[]; menu: MenuItem[]; onLogout: () => void }) {
  const active = orders.find((order) => !['collected', 'cancelled'].includes(order.status));
  const totalSpent = orders.reduce((sum, order) => sum + order.total, 0);
  return <div className="animate-float-in"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><SectionTitle eyebrow="Student profile" title={user ? `Hi, ${user.name.split(' ')[0]}.` : 'Your canteen, your rhythm.'} detail="A small dashboard for the things that make your break run better." /><div className="mb-7 flex flex-wrap gap-2"><button onClick={onLogout} className="inline-flex items-center gap-2 rounded-xl border border-[#e3d8c7] bg-[#fffdf8] px-4 py-3 text-sm font-bold text-[#202941] hover:border-[#e95f4d] hover:text-[#e95f4d]" data-testid="button-dashboard-logout">Log out</button><Link href="/menu" className="inline-flex items-center gap-2 rounded-xl bg-[#e95f4d] px-4 py-3 text-sm font-bold text-white shadow-warm" data-testid="link-dashboard-order">Order something <ArrowRight size={16} /></Link></div></div><div className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl bg-[#202941] p-5 text-[#fff9ed]"><p className="text-xs font-bold uppercase tracking-[.13em] text-[#aeb8bb]">Orders placed</p><p className="mt-4 font-display text-4xl font-bold">{orders.length}</p><p className="mt-1 text-xs text-[#aeb8bb]">This account</p></div><div className="rounded-2xl bg-[#f9d856] p-5 text-[#202941]"><p className="text-xs font-bold uppercase tracking-[.13em] text-[#74621a]">Canteen spend</p><p className="mt-4 font-display text-4xl font-bold">{formatMoney(totalSpent)}</p><p className="mt-1 text-xs text-[#74621a]">Worth every bite</p></div><div className="rounded-2xl bg-[#dff3e8] p-5 text-[#1e7358]"><p className="text-xs font-bold uppercase tracking-[.13em] text-[#4e8c76]">Menu today</p><p className="mt-4 font-display text-4xl font-bold">{menu.filter((item) => item.available).length}</p><p className="mt-1 text-xs text-[#4e8c76]">Ready to order</p></div></div><div className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><section className="rounded-2xl border border-[#eadfce] bg-[#fffdf8] p-6"><div className="flex items-center justify-between"><h2 className="font-display text-2xl font-bold text-[#202941]">Active token</h2><Link href="/orders" className="text-xs font-extrabold text-[#e95f4d]" data-testid="link-dashboard-orders">View all</Link></div>{active ? <div className="mt-6 flex items-center justify-between gap-4 rounded-xl bg-[#e8f6ed] p-4"><div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#1e7358]">{statusLabel(active.status)}</p><p className="mt-2 font-mono-app text-3xl font-bold text-[#202941]">{active.token}</p><p className="mt-2 text-xs text-[#68717b]">{active.items.length} items · {formatMoney(active.total)}</p></div><span className="grid size-14 place-items-center rounded-full bg-[#1e7358] text-white"><PackageCheck size={25} /></span></div> : <div className="mt-6 rounded-xl border border-dashed border-[#d9cdbb] p-8 text-center"><Clock3 className="mx-auto text-[#e95f4d]" size={24} /><p className="mt-3 text-sm font-bold text-[#202941]">No active order</p><p className="mt-1 text-xs text-[#68717b]">Your next token will show up here.</p></div>}</section><section className="rounded-2xl bg-[#f3e9d9] p-6"><p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#e95f4d]">Quick note</p><h2 className="mt-3 font-display text-3xl font-bold leading-tight text-[#202941]">Breaks are better when they are actually breaks.</h2><p className="mt-4 text-sm leading-6 text-[#68717b]">Order before class ends, then use your token when the canteen marks it ready. No hovering. No guessing.</p><Link href="/menu" className="mt-6 inline-flex items-center gap-2 text-sm font-extrabold text-[#202941]" data-testid="link-dashboard-menu">See what is cooking <ArrowRight size={16} /></Link></section></div></div>;
}

function AdminPage({ menu, orders, onStatus, onToggleAvailability, onSaveItem, onDeleteItem }: { menu: MenuItem[]; orders: Order[]; onStatus: (id: string, status: Status) => void; onToggleAvailability: (id: number) => void; onSaveItem: (item: MenuItem) => void; onDeleteItem: (id: number) => void }) {
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const active = orders.filter((order) => !['collected', 'cancelled'].includes(order.status));
  const revenue = orders.reduce((sum, order) => sum + order.total, 0);
  return <div className="animate-float-in"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><SectionTitle eyebrow="Operations desk" title="Keep the queue moving." detail="A clear view of today's demand, order status, and what is still available to students." /><span className="mb-7 inline-flex items-center gap-2 rounded-full bg-[#dff3e8] px-3 py-2 text-xs font-extrabold text-[#1e7358]"><span className="size-2 rounded-full bg-[#1e7358]" /> Canteen live</span></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Open orders" value={String(active.length)} tone="dark" icon={PackageCheck} /><Metric label="Today's orders" value={String(orders.length)} tone="yellow" icon={BarChart3} /><Metric label="Revenue" value={formatMoney(revenue)} tone="green" icon={ShoppingBag} /><Metric label="Menu items" value={String(menu.length)} tone="cream" icon={Utensils} /></div><div className="mt-9 grid gap-7 xl:grid-cols-[1.15fr_.85fr]"><section><div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#e95f4d]">Live queue</p><h2 className="mt-1 font-display text-2xl font-bold text-[#202941]">Orders to watch</h2></div><span className="text-xs font-bold text-[#8b918e]">{active.length} active</span></div>{orders.length ? <div className="space-y-3">{orders.map((order) => <AdminOrderRow key={order.id} order={order} onStatus={onStatus} />)}</div> : <div className="rounded-2xl border border-dashed border-[#d9cdbb] bg-[#fffdf8] p-12 text-center text-sm text-[#68717b]">Orders will appear here when students place them.</div>}</section><section><div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#e95f4d]">Menu control</p><h2 className="mt-1 font-display text-2xl font-bold text-[#202941]">Availability</h2></div><button onClick={() => setEditing({ id: Date.now(), name: '', category: 'quick bites', price: 0, description: '', image: seedMenu[0].image, available: true })} className="inline-flex items-center gap-1 rounded-lg bg-[#202941] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#314058]" data-testid="button-add-menu-item"><Plus size={15} /> Add item</button></div><div className="space-y-2 rounded-2xl border border-[#eadfce] bg-[#fffdf8] p-3">{menu.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-[#fff9ed]" data-testid={`admin-menu-row-${item.id}`}><img src={item.image} alt="" className="size-10 rounded-lg object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[#202941]">{item.name}</p><p className="text-xs text-[#8b918e]">{formatMoney(item.price)} · {item.category}</p></div><button onClick={() => onToggleAvailability(item.id)} className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${item.available ? 'bg-[#dff3e8] text-[#1e7358]' : 'bg-[#f3e9d9] text-[#8b7866]'}`} data-testid={`button-toggle-${item.id}`}>{item.available ? 'Available' : 'Hidden'}</button><button onClick={() => setEditing(item)} className="grid size-8 place-items-center rounded-lg text-[#68717b] hover:bg-[#f3e9d9] hover:text-[#202941]" aria-label={`Edit ${item.name}`} data-testid={`button-edit-${item.id}`}><Edit3 size={15} /></button><button onClick={() => onDeleteItem(item.id)} className="grid size-8 place-items-center rounded-lg text-[#9b8b78] hover:bg-[#fbe2de] hover:text-[#a63b31]" aria-label={`Delete ${item.name}`} data-testid={`button-delete-${item.id}`}><Trash2 size={15} /></button></div>)}</div></section></div>{editing && <MenuEditor item={editing} onClose={() => setEditing(null)} onSave={(item) => { onSaveItem(item); setEditing(null); }} />}</div>;
}

function Metric({ label, value, tone, icon: Icon }: { label: string; value: string; tone: 'dark' | 'yellow' | 'green' | 'cream'; icon: typeof BarChart3 }) {
  const styles = { dark: 'bg-[#202941] text-[#fff9ed]', yellow: 'bg-[#f9d856] text-[#202941]', green: 'bg-[#dff3e8] text-[#1e7358]', cream: 'bg-[#f3e9d9] text-[#202941]' };
  return <div className={`rounded-2xl p-5 ${styles[tone]}`}><Icon size={20} className="opacity-70" /><p className="mt-5 text-xs font-extrabold uppercase tracking-[.12em] opacity-70">{label}</p><p className="mt-2 font-display text-3xl font-bold">{value}</p></div>;
}

function AdminOrderRow({ order, onStatus }: { order: Order; onStatus: (id: string, status: Status) => void }) {
  const next: Partial<Record<Status, Status>> = { queued: 'confirmed', confirmed: 'preparing', preparing: 'ready', ready: 'collected' };
  return <div className="rounded-2xl border border-[#eadfce] bg-[#fffdf8] p-4" data-testid={`admin-order-${order.id}`}><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-[#202941] font-mono-app text-xs font-bold text-[#f9d856]">{order.token}</span><div><p className="text-sm font-extrabold text-[#202941]">{order.customer}</p><p className="mt-1 text-xs text-[#8b918e]">{order.items.map((item) => `${item.quantity} × ${item.name}`).join(', ')}</p></div></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${statusTone(order.status)}`}>{statusLabel(order.status)}</span></div>{next[order.status] && <div className="mt-4 flex items-center justify-between border-t border-[#eee3d3] pt-3"><span className="text-xs text-[#8b918e]">{formatTime(order.createdAt)} · {formatMoney(order.total)}</span><button onClick={() => onStatus(order.id, next[order.status] as Status)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#e95f4d] px-3 py-2 text-xs font-extrabold text-white" data-testid={`button-advance-${order.id}`}>{statusLabel(next[order.status] as Status)} <ChevronRight size={14} /></button></div>}</div>;
}

function MenuEditor({ item, onClose, onSave }: { item: MenuItem; onClose: () => void; onSave: (item: MenuItem) => void }) {
  const [form, setForm] = useState(item);
  const submit = (event: FormEvent) => { event.preventDefault(); onSave({ ...form, price: Number(form.price) || 0 }); };
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#202941]/50 p-4 backdrop-blur-sm"><form onSubmit={submit} className="w-full max-w-lg animate-pop-in rounded-2xl bg-[#fffdf8] p-6 shadow-lg"><div className="flex items-center justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#e95f4d]">{item.name ? 'Edit menu item' : 'New menu item'}</p><h2 className="mt-1 font-display text-2xl font-bold text-[#202941]">Menu details</h2></div><button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-lg text-[#68717b] hover:bg-[#f3e9d9]" aria-label="Close editor" data-testid="button-close-editor"><X size={18} /></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-bold text-[#68717b]">Item name</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11 w-full rounded-lg border border-[#e3d8c7] bg-[#fff9ed] px-3 text-sm outline-none focus:border-[#e95f4d]" data-testid="input-item-name" /></label><label><span className="mb-1.5 block text-xs font-bold text-[#68717b]">Category</span><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Exclude<Category, 'all'> })} className="h-11 w-full rounded-lg border border-[#e3d8c7] bg-[#fff9ed] px-3 text-sm outline-none focus:border-[#e95f4d]" data-testid="select-item-category"><option value="quick bites">Quick bites</option><option value="meals">Meals</option><option value="drinks">Drinks</option></select></label><label><span className="mb-1.5 block text-xs font-bold text-[#68717b]">Price</span><input required type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="h-11 w-full rounded-lg border border-[#e3d8c7] bg-[#fff9ed] px-3 text-sm outline-none focus:border-[#e95f4d]" data-testid="input-item-price" /></label><label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-bold text-[#68717b]">Description</span><textarea required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="min-h-20 w-full resize-none rounded-lg border border-[#e3d8c7] bg-[#fff9ed] p-3 text-sm outline-none focus:border-[#e95f4d]" data-testid="input-item-description" /></label></div><div className="mt-6 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose} data-testid="button-cancel-editor">Cancel</Button><Button type="submit" data-testid="button-save-item">Save item <Check size={16} /></Button></div></form></div>;
}

function AuthPage({ mode, onAuth }: { mode: 'login' | 'register' | 'admin'; onAuth: (user: CurrentUser) => void }) {
  const isAdmin = mode === 'admin';
  const isRegister = mode === 'register';
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const normalizedEmail = email.trim().toLowerCase();

    if (isAdmin) {
      if (normalizedEmail !== 'admin@canteen.com' || password !== 'admin123') {
        setError('Use the demo admin credentials: admin@canteen.com and admin123.');
        return;
      }
      onAuth({ name: 'Canteen Manager', email: normalizedEmail, role: 'admin' });
      return;
    }

    if (isRegister) {
      if (name.trim().length < 2) {
        setError('Enter your full name.');
        return;
      }
      if (!studentId.trim()) {
        setError('Enter your student ID or roll number.');
        return;
      }
      if (!/^[0-9+\-\s()]{10,15}$/.test(mobile.trim())) {
        setError('Enter a valid mobile number.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      const accounts = readStore<StudentAccount[]>(ACCOUNTS_KEY, []);
      if (accounts.some((account) => account.email === normalizedEmail)) {
        setError('An account with this email already exists.');
        return;
      }
      setSubmitting(true);
      try {
        const passwordHash = await hashPassword(password);
        const account: StudentAccount = { name: name.trim(), studentId: studentId.trim(), email: normalizedEmail, mobile: mobile.trim(), passwordHash };
        window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([...accounts, account]));
        onAuth({ name: account.name, email: account.email, role: 'student' });
      } catch {
        setError('We could not create your account. Please try again.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (password.length < 6) {
      setError('Enter your password.');
      return;
    }
    setSubmitting(true);
    try {
      const accounts = readStore<StudentAccount[]>(ACCOUNTS_KEY, []);
      const account = accounts.find((candidate) => candidate.email === normalizedEmail);
      const passwordHash = await hashPassword(password);
      if (!account || account.passwordHash !== passwordHash) {
        setError('Email or password is incorrect.');
        return;
      }
      onAuth({ name: account.name, email: account.email, role: 'student' });
    } catch {
      setError('We could not sign you in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="min-h-[100dvh] bg-[#202941] px-5 py-8 text-[#fff9ed]"><div className="mx-auto max-w-[1100px]"><Logo dark /><div className="grid items-center gap-12 py-12 lg:grid-cols-[.9fr_430px] lg:py-20"><div className="hidden lg:block"><p className="mb-4 text-xs font-extrabold uppercase tracking-[.17em] text-[#f9d856]">{isAdmin ? 'Operations access' : 'Your better break starts here'}</p><h1 className="max-w-xl font-display text-6xl font-bold leading-[.95] tracking-[-.05em]">{isAdmin ? 'Run a calmer, smarter counter.' : isRegister ? 'Make your break count.' : 'Your order is already halfway ready.'}</h1><p className="mt-6 max-w-md text-base leading-7 text-[#c6cdce]">{isAdmin ? 'See the queue, keep the menu honest, and hand over every order at the right moment.' : 'Save your favourites, collect tokens, and get back to the people and places that make campus yours.'}</p><div className="mt-9 flex gap-4 text-xs font-bold text-[#aeb8bb]"><span className="flex items-center gap-2"><Check size={15} className="text-[#76c7a6]" /> Fresh availability</span><span className="flex items-center gap-2"><Check size={15} className="text-[#76c7a6]" /> Clear tokens</span></div></div><div className="rounded-[24px] bg-[#fff9ed] p-6 text-[#202941] shadow-lg sm:p-9"><p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#e95f4d]">{isAdmin ? 'Staff login' : isRegister ? 'New around here?' : 'Welcome back'}</p><h2 className="mt-2 font-display text-3xl font-bold">{isAdmin ? 'Open the operations desk' : isRegister ? 'Create your student account' : 'Pick up where you left off'}</h2><p className="mt-2 text-sm text-[#68717b]">{isAdmin ? 'Use the approved staff credentials to continue.' : isRegister ? 'Your details stay on this device in this demo.' : 'Sign in with the account you registered.'}</p>{error && <p role="alert" className="mt-4 rounded-xl bg-[#fbe2de] px-3 py-2.5 text-xs font-bold leading-5 text-[#a63b31]">{error}</p>}<form onSubmit={submit} className="mt-7 space-y-4">{isRegister && <><label className="block"><span className="mb-1.5 block text-xs font-bold text-[#68717b]">Full name</span><input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Aarav Mehta" className="h-12 w-full rounded-xl border border-[#e3d8c7] bg-[#fffdf8] px-4 text-sm outline-none focus:border-[#e95f4d]" data-testid="input-name" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-xs font-bold text-[#68717b]">Student ID</span><input required value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="CS2026-014" className="h-12 w-full rounded-xl border border-[#e3d8c7] bg-[#fffdf8] px-4 text-sm outline-none focus:border-[#e95f4d]" data-testid="input-student-id" /></label><label className="block"><span className="mb-1.5 block text-xs font-bold text-[#68717b]">Mobile number</span><input required type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+91 98765 43210" className="h-12 w-full rounded-xl border border-[#e3d8c7] bg-[#fffdf8] px-4 text-sm outline-none focus:border-[#e95f4d]" data-testid="input-mobile" /></label></div></>}<label className="block"><span className="mb-1.5 block text-xs font-bold text-[#68717b]">Email address</span><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={isAdmin ? 'admin@canteen.com' : 'you@campus.edu'} className="h-12 w-full rounded-xl border border-[#e3d8c7] bg-[#fffdf8] px-4 text-sm outline-none focus:border-[#e95f4d]" data-testid="input-email" /></label><label className="block"><span className="mb-1.5 block text-xs font-bold text-[#68717b]">Password</span><input required minLength={6} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isAdmin ? 'admin123' : 'At least 6 characters'} className="h-12 w-full rounded-xl border border-[#e3d8c7] bg-[#fffdf8] px-4 text-sm outline-none focus:border-[#e95f4d]" data-testid="input-password" /></label>{isRegister && <label className="block"><span className="mb-1.5 block text-xs font-bold text-[#68717b]">Confirm password</span><input required minLength={6} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat your password" className="h-12 w-full rounded-xl border border-[#e3d8c7] bg-[#fffdf8] px-4 text-sm outline-none focus:border-[#e95f4d]" data-testid="input-confirm-password" /></label>}<Button disabled={submitting} type="submit" className="mt-2 w-full" data-testid="button-auth-submit">{submitting ? 'Checking...' : isAdmin ? 'Enter operations desk' : isRegister ? 'Create student account' : 'Sign in'} {!submitting && <ArrowRight size={16} />}</Button></form><div className="mt-6 text-center text-xs text-[#68717b]">{isAdmin ? <Link href="/login" className="font-bold text-[#e95f4d]" data-testid="link-student-login">Student login instead</Link> : isRegister ? <>Already have an account? <Link href="/login" className="font-bold text-[#e95f4d]" data-testid="link-existing-account">Sign in</Link></> : <>New to the canteen? <Link href="/register" className="font-bold text-[#e95f4d]" data-testid="link-register">Create an account</Link></>}</div>{!isAdmin && <Link href="/admin-login" className="mt-5 flex items-center justify-center gap-1 text-xs font-bold text-[#9b8b78] hover:text-[#e95f4d]" data-testid="link-admin-login">Staff access <ShieldCheck size={13} /></Link>}</div></div></div></div>;
}

function NotFound() {
  return <div className="min-h-[100dvh] bg-[#fff9ed] px-5 py-20 text-center"><Logo /><div className="mx-auto mt-20 max-w-md"><p className="font-mono-app text-sm font-bold text-[#e95f4d]">404 / wrong turn</p><h1 className="mt-4 font-display text-5xl font-bold text-[#202941]">This page missed the lunch bell.</h1><Link href="/" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#e95f4d] px-5 py-3 text-sm font-bold text-white" data-testid="link-not-found-home">Back to home <ArrowRight size={16} /></Link></div></div>;
}

function RequireAuth({ user, admin = false, children }: { user: CurrentUser | null; admin?: boolean; children: ReactNode }) {
  const [, setLocation] = useLocation();
  const allowed = Boolean(user) && (!admin || user?.role === 'admin');

  useEffect(() => {
    if (!allowed) setLocation(admin ? '/admin-login' : '/login');
  }, [admin, allowed, setLocation]);

  return allowed ? <>{children}</> : null;
}

function AppRouter({ props }: { props: AppProps }) {
  return <Switch><Route path="/"><HomePage menu={props.menu} activeOrder={props.activeOrder} user={props.user} /></Route><Route path="/menu"><MenuPage menu={props.menu} cart={props.cart} onAdd={props.onAdd} /></Route><Route path="/cart"><CartPage cart={props.cart} menu={props.menu} onQuantity={props.onQuantity} onRemove={props.onRemove} onPlaceOrder={props.onPlaceOrder} user={props.user} /></Route><Route path="/orders"><RequireAuth user={props.user}><OrdersPage orders={props.orders} onStatus={props.onStatus} /></RequireAuth></Route><Route path="/dashboard"><RequireAuth user={props.user}><DashboardPage user={props.user} orders={props.orders} menu={props.menu} onLogout={props.onLogout} /></RequireAuth></Route><Route path="/admin"><RequireAuth user={props.user} admin><AdminPage menu={props.menu} orders={props.orders} onStatus={props.onStatus} onToggleAvailability={props.onToggleAvailability} onSaveItem={props.onSaveItem} onDeleteItem={props.onDeleteItem} /></RequireAuth></Route><Route path="/login"><AuthPage mode="login" onAuth={props.onAuth} /></Route><Route path="/register"><AuthPage mode="register" onAuth={props.onAuth} /></Route><Route path="/admin-login"><AuthPage mode="admin" onAuth={props.onAuth} /></Route><Route component={NotFound} /></Switch>;
}

type AppProps = {
  menu: MenuItem[];
  cart: CartLine[];
  orders: Order[];
  user: CurrentUser | null;
  activeOrder: Order | undefined;
  onAdd: (item: MenuItem) => void;
  onQuantity: (itemId: number, delta: number) => void;
  onRemove: (itemId: number) => void;
  onPlaceOrder: () => void;
  onStatus: (id: string, status: Status) => void;
  onAuth: (user: CurrentUser) => void;
  onLogout: () => void;
  onToggleAvailability: (id: number) => void;
  onSaveItem: (item: MenuItem) => void;
  onDeleteItem: (id: number) => void;
};

function AppContent() {
  const [location, setLocation] = useLocation();
  const [menu, setMenu] = useState<MenuItem[]>(() => readStore(MENU_KEY, seedMenu));
  const [cart, setCart] = useState<CartLine[]>(() => readStore(CART_KEY, []));
  const [orders, setOrders] = useState<Order[]>(() => readStore(ORDERS_KEY, []));
  const [user, setUser] = useState<CurrentUser | null>(() => readStore(USER_KEY, null));

  useEffect(() => { window.localStorage.setItem(MENU_KEY, JSON.stringify(menu)); }, [menu]);
  useEffect(() => { window.localStorage.setItem(CART_KEY, JSON.stringify(cart)); }, [cart]);
  useEffect(() => { window.localStorage.setItem(ORDERS_KEY, JSON.stringify(orders)); }, [orders]);
  useEffect(() => { if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user)); else window.localStorage.removeItem(USER_KEY); }, [user]);

  const onAdd = (item: MenuItem) => {
    if (!item.available) return;
    setCart((current) => {
      const existing = current.find((line) => line.itemId === item.id);
      return existing ? current.map((line) => line.itemId === item.id ? { ...line, quantity: line.quantity + 1 } : line) : [...current, { itemId: item.id, quantity: 1 }];
    });
  };
  const onQuantity = (itemId: number, delta: number) => setCart((current) => current.map((line) => line.itemId === itemId ? { ...line, quantity: line.quantity + delta } : line).filter((line) => line.quantity > 0));
  const onRemove = (itemId: number) => setCart((current) => current.filter((line) => line.itemId !== itemId));
  const onPlaceOrder = () => {
    if (!user) { setLocation('/login'); return; }
    if (!cart.length) return;
    const items = cart.flatMap((line) => {
      const item = menu.find((candidate) => candidate.id === line.itemId);
      if (!item || !item.available || line.quantity < 1) return [];
      return [{ itemId: item.id, name: item.name, price: item.price, quantity: line.quantity }];
    });
    if (items.length !== cart.length || !items.length) {
      setCart((current) => current.filter((line) => menu.some((item) => item.id === line.itemId && item.available)));
      return;
    }
    const order: Order = { id: `order-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, token: createToken(orders), createdAt: new Date().toISOString(), status: 'queued', items, total: items.reduce((sum, item) => sum + item.price * item.quantity, 0), customer: user.name, customerEmail: user.email };
    setOrders((current) => [order, ...current]);
    setCart([]);
    setLocation('/orders');
  };
  const onStatus = (id: string, status: Status) => setOrders((current) => current.map((order) => order.id === id ? { ...order, status } : order));
  const onAuth = (nextUser: CurrentUser) => { setUser(nextUser); setLocation(nextUser.role === 'admin' ? '/admin' : '/dashboard'); };
  const onLogout = () => { setUser(null); setLocation('/'); };
  const visibleOrders = userOrders(orders, user);
  const activeOrder = visibleOrders.find((order) => !['collected', 'cancelled'].includes(order.status));
  const appProps: AppProps = { menu, cart, orders: visibleOrders, user, activeOrder, onAdd, onQuantity, onRemove, onPlaceOrder, onStatus, onAuth, onLogout, onToggleAvailability: (id) => setMenu((current) => current.map((item) => item.id === id ? { ...item, available: !item.available } : item)), onSaveItem: (item) => setMenu((current) => current.some((entry) => entry.id === item.id) ? current.map((entry) => entry.id === item.id ? item : entry) : [...current, item]), onDeleteItem: (id) => { setMenu((current) => current.filter((item) => item.id !== id)); setCart((current) => current.filter((line) => line.itemId !== id)); } };
  return <ErrorBoundary resetKey={location}><AppShell user={user} cartCount={cart.reduce((sum, line) => sum + line.quantity, 0)} onLogout={onLogout}><AppRouter props={appProps} /></AppShell></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><AppContent /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;