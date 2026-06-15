'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Package, Boxes, Target, CalendarDays, Users2, School, Route,
  Wallet, PartyPopper, FileBarChart2, Bell, Settings as SettingsIcon, Search,
  LogOut, Plus, Edit3, Trash2, Copy, Archive, Download, AlertTriangle, TrendingUp,
  TrendingDown, DollarSign, ShoppingBag, CheckCircle2, Circle, MoreHorizontal,
  ChevronRight, Sparkles, Globe, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';

const fmt = (n) => 'Rp ' + Number(n||0).toLocaleString('id-ID');
const fmtShort = (n) => {
  if (n >= 1_000_000_000) return 'Rp ' + (n/1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return 'Rp ' + (n/1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return 'Rp ' + (n/1_000).toFixed(0) + 'K';
  return 'Rp ' + n;
};

const api = {
  async login(email, password) {
    const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    if (!r.ok) throw new Error('Invalid credentials');
    return r.json();
  },
  async get(path) { const r = await fetch('/api/' + path); return r.json(); },
  async post(path, body) { const r = await fetch('/api/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return r.json(); },
  async put(path, body) { const r = await fetch('/api/' + path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return r.json(); },
  async del(path) { const r = await fetch('/api/' + path, { method: 'DELETE' }); return r.json(); },
};

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'products', label: 'Product Catalog', icon: Package },
  { id: 'inventory', label: 'Inventory', icon: Boxes },
  { id: 'planning', label: 'Strategic Planning', icon: Target },
  { id: 'content', label: 'Content Planner', icon: CalendarDays },
  { id: 'creators', label: 'Creator CRM', icon: Users2 },
  { id: 'schools', label: 'School CRM', icon: School },
  { id: 'timeline', label: 'Timeline', icon: Route },
  { id: 'finance', label: 'Finance', icon: Wallet },
  { id: 'events', label: 'Events', icon: PartyPopper },
  { id: 'reports', label: 'Reports', icon: FileBarChart2 },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

// =========== LOGIN ===========
function Login({ onLogin }) {
  const [email, setEmail] = useState('admin@onemission.id');
  const [password, setPassword] = useState('admin');
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { user } = await api.login(email, password);
      localStorage.setItem('om_user', JSON.stringify(user));
      onLogin(user);
      toast.success(`Welcome back, ${user.name}`);
    } catch (err) {
      toast.error('Invalid email or password');
    } finally { setLoading(false); }
  };
  return (
    <div className="min-h-screen bg-background grid-bg flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-card opacity-80" />
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-foreground text-background mb-4 font-bold text-2xl tracking-tight">
            OM
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">ONEMISSION HQ</h1>
          <p className="text-sm text-muted-foreground mt-1.5 tracking-widest uppercase">Values Matter</p>
        </div>
        <Card className="border-border/60 backdrop-blur">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Access the central operating system</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@onemission.id" />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={password} onChange={e=>setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
              </Button>
            </form>
            <div className="mt-6 text-xs text-muted-foreground space-y-1.5 border-t border-border pt-4">
              <p className="font-medium text-foreground/80">Demo accounts</p>
              <p>admin@onemission.id / admin (Super Admin)</p>
              <p>finance@onemission.id / finance</p>
              <p>content@onemission.id / content</p>
              <p>ops@onemission.id / ops</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// =========== DASHBOARD ===========
function Dashboard() {
  const [stats, setStats] = useState(null);
  const [finance, setFinance] = useState([]);
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [content, setContent] = useState([]);
  const [events, setEvents] = useState([]);
  const [creators, setCreators] = useState([]);
  const [schools, setSchools] = useState([]);

  useEffect(() => {
    (async () => {
      setStats(await api.get('dashboard'));
      setFinance(await api.get('finance'));
      setProducts(await api.get('products'));
      setInventory(await api.get('inventory'));
      setContent(await api.get('content'));
      setEvents(await api.get('events'));
      setCreators(await api.get('creators'));
      setSchools(await api.get('schools'));
    })();
  }, []);

  const expenseBreakdown = useMemo(() => {
    if (!finance.length) return [];
    const totals = {};
    finance.forEach(f => Object.entries(f.categoryBreakdown||{}).forEach(([k,v]) => totals[k] = (totals[k]||0) + v));
    return Object.entries(totals).map(([name, value]) => ({ name, value }));
  }, [finance]);

  const lowStock = useMemo(() => {
    return inventory.filter(i => i.quantity < i.threshold).slice(0,5).map(i => {
      const p = products.find(p=>p.id===i.productId);
      return { ...i, productName: p?.name || 'Unknown' };
    });
  }, [inventory, products]);

  const chartColors = ['hsl(var(--chart-1))','hsl(var(--chart-2))','hsl(var(--chart-3))','hsl(var(--chart-4))','hsl(var(--chart-5))','#94a3b8','#64748b'];

  if (!stats) return <DashboardSkeleton />;

  const KPI = ({ label, value, sub, icon: Icon, trend }) => (
    <Card className="border-border/60 hover:border-border transition-colors">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
            <p className="text-2xl font-semibold tracking-tight mt-2">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">{trend === 'up' ? <TrendingUp className="h-3 w-3 text-emerald-500" /> : trend === 'down' ? <TrendingDown className="h-3 w-3 text-rose-500" /> : null}{sub}</p>}
          </div>
          <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">CEO Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-1">Real-time pulse of ONEMISSION operations</p>
        </div>
        <Badge variant="outline" className="gap-1.5 border-emerald-500/30 text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live</Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPI label="Total Revenue" value={fmtShort(stats.totalRevenue)} sub="YTD 2026" icon={DollarSign} trend="up" />
        <KPI label="Monthly Revenue" value={fmtShort(stats.monthlyRevenue)} sub={`${stats.salesGrowth >= 0 ? '+' : ''}${stats.salesGrowth}% MoM`} icon={TrendingUp} trend={stats.salesGrowth >= 0 ? 'up' : 'down'} />
        <KPI label="Net Profit" value={fmtShort(stats.netProfit)} sub="After expenses" icon={Sparkles} trend="up" />
        <KPI label="Expenses" value={fmtShort(stats.expenses)} sub="YTD" icon={Wallet} />
        <KPI label="Cash Position" value={fmtShort(stats.cashPosition)} sub="Available" icon={ShoppingBag} trend="up" />
        <KPI label="Low Stock" value={stats.lowStockCount} sub="SKUs critical" icon={AlertTriangle} trend="down" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Revenue by Month</CardTitle>
            <CardDescription>2026 monthly performance</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={finance}>
                <defs>
                  <linearGradient id="revG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.5}/>
                    <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v)=>fmtShort(v)} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} formatter={(v)=>fmt(v)} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#revG)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Expense Breakdown</CardTitle>
            <CardDescription>Category distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={expenseBreakdown} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                  {expenseBreakdown.map((_,i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} formatter={(v)=>fmtShort(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 text-xs mt-2">
              {expenseBreakdown.slice(0,5).map((c,i) => (
                <div key={c.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{background:chartColors[i % chartColors.length]}} />{c.name}</div>
                  <span className="text-muted-foreground">{fmtShort(c.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Cashflow Trend</CardTitle>
            <CardDescription>Net cash position over months</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={finance}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={fmtShort} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} formatter={fmt} />
                <Line type="monotone" dataKey="cashflow" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="profit" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Product Sales Performance</CardTitle>
            <CardDescription>Top selling categories</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={[
                { name: '2-in-1 Shorts', sales: 4200 },
                { name: 'Compression', sales: 2800 },
                { name: 'Jerseys', sales: 3600 },
                { name: 'Jackets', sales: 1500 },
                { name: 'Accessories', sales: 980 },
              ]}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Bar dataKey="sales" fill="hsl(var(--chart-1))" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Critical Stock</CardTitle>
            <CardDescription>Restock immediately</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {lowStock.length === 0 && <p className="text-sm text-muted-foreground">All stock above threshold</p>}
            {lowStock.map(i => (
              <div key={i.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium truncate max-w-[180px]">{i.productName}</p>
                  <p className="text-xs text-muted-foreground">{i.color} · {i.size}</p>
                </div>
                <Badge variant="destructive">{i.quantity} left</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Upcoming Content</CardTitle>
            <CardDescription>Next pieces due</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {content.slice(0,5).map(c => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{c.title}</p>
                  <p className="text-xs text-muted-foreground">{c.platform} · {c.deadline}</p>
                </div>
                <Badge variant="outline" className="ml-2 shrink-0">{c.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Upcoming Events</CardTitle>
            <CardDescription>One Goal regional dates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {events.slice(0,5).map(e => (
              <div key={e.id} className="flex items-start justify-between text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{e.name}</p>
                  <p className="text-xs text-muted-foreground">{e.venue} · {e.date}</p>
                </div>
                <Badge variant="outline">{e.participants}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Creator Collaboration Updates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {creators.slice(0,4).map(c => (
              <div key={c.id} className="flex items-center gap-3 text-sm">
                <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{c.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</AvatarFallback></Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.username} · {(c.followers/1000).toFixed(0)}K · {c.platform}</p>
                </div>
                <Badge variant="outline">{c.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">School Partnership Updates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {schools.slice(0,4).map(s => (
              <div key={s.id} className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                  <School className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.city} · {fmtShort(s.value)}</p>
                </div>
                <Badge variant="outline">{s.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {Array.from({length:6}).map((_,i)=><div key={i} className="h-28 rounded-xl bg-card border border-border/60 animate-pulse" />)}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 h-72 rounded-xl bg-card border border-border/60 animate-pulse" />
        <div className="h-72 rounded-xl bg-card border border-border/60 animate-pulse" />
      </div>
    </div>
  );
}

// =========== PRODUCTS ===========
const PRODUCT_CATEGORIES = ['Two-In-One Shorts','Compression Pants','Jerseys','Jackets','Accessories'];
const PRODUCT_STATUS = ['Active','Draft','Archived'];

function ProductsModule() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('');
  const [category, setCategory] = useState('all');

  const load = async () => setItems(await api.get('products'));
  useEffect(() => { load(); }, []);

  const empty = { name:'', sku:'', category: 'Two-In-One Shorts', brand:'OneClaw', status:'Active', costPrice:0, sellingPrice:0, description:'', tags:[], colors:['Black'], sizes:['M','L','XL'], notes:'' };

  const save = async (data) => {
    if (editing?.id) {
      await api.put('products/' + editing.id, data);
      toast.success('Product updated');
    } else {
      await api.post('products', data);
      toast.success('Product created');
    }
    setOpen(false); setEditing(null); load();
  };
  const del = async (id) => { await api.del('products/' + id); toast.success('Product deleted'); load(); };
  const duplicate = async (p) => { const { id, ...rest } = p; await api.post('products', { ...rest, name: rest.name + ' (Copy)', sku: rest.sku + '-COPY' }); toast.success('Duplicated'); load(); };
  const archive = async (p) => { await api.put('products/' + p.id, { ...p, status: 'Archived' }); toast.success('Archived'); load(); };

  const filtered = items.filter(p => (category==='all' || p.category===category) && (!filter || p.name.toLowerCase().includes(filter.toLowerCase()) || p.sku.toLowerCase().includes(filter.toLowerCase())));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Product Catalog</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage all ONEMISSION products</p>
        </div>
        <Button onClick={()=>{ setEditing(null); setOpen(true); }} className="gap-2"><Plus className="h-4 w-4" /> New product</Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search products..." className="pl-9" value={filter} onChange={e=>setFilter(e.target.value)} />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {PRODUCT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="border-border/60">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/30">
              <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider">
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Cost</th>
                <th className="px-4 py-3 font-medium text-right">Selling</th>
                <th className="px-4 py-3 font-medium text-right">Margin</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const margin = p.sellingPrice ? ((p.sellingPrice - p.costPrice)/p.sellingPrice*100).toFixed(0) : 0;
                return (
                  <tr key={p.id} className="border-b border-border/60 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-secondary to-accent flex items-center justify-center text-xs font-medium">{p.name.slice(0,2).toUpperCase()}</div>
                        <div>
                          <p className="font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.brand}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.sku}</td>
                    <td className="px-4 py-3"><Badge variant="outline" className="font-normal">{p.category}</Badge></td>
                    <td className="px-4 py-3">
                      <Badge variant={p.status==='Active'?'default':p.status==='Draft'?'secondary':'outline'} className="font-normal">{p.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{fmt(p.costPrice)}</td>
                    <td className="px-4 py-3 text-right font-medium">{fmt(p.sellingPrice)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-xs font-medium ${margin >= 60 ? 'text-emerald-400' : margin >= 40 ? 'text-amber-400' : 'text-rose-400'}`}>{margin}%</span>
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={()=>{ setEditing(p); setOpen(true); }}><Edit3 className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={()=>duplicate(p)}><Copy className="h-4 w-4 mr-2" /> Duplicate</DropdownMenuItem>
                          <DropdownMenuItem onClick={()=>archive(p)}><Archive className="h-4 w-4 mr-2" /> Archive</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={()=>del(p.id)} className="text-rose-400 focus:text-rose-400"><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="p-12 text-center text-muted-foreground"><Package className="h-8 w-8 mx-auto mb-3 opacity-50" />No products found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <ProductModal open={open} onOpenChange={setOpen} initial={editing || empty} onSave={save} />
    </div>
  );
}

function ProductModal({ open, onOpenChange, initial, onSave }) {
  const [form, setForm] = useState(initial);
  useEffect(() => { setForm(initial); }, [initial, open]);
  const update = (k,v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial?.id ? 'Edit product' : 'New product'}</DialogTitle>
          <DialogDescription>Define product details for the catalog</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto scrollbar-thin pr-2">
          <div className="col-span-2 space-y-2"><Label>Product name</Label><Input value={form.name||''} onChange={e=>update('name', e.target.value)} /></div>
          <div className="space-y-2"><Label>SKU</Label><Input value={form.sku||''} onChange={e=>update('sku', e.target.value)} /></div>
          <div className="space-y-2"><Label>Brand</Label><Input value={form.brand||''} onChange={e=>update('brand', e.target.value)} /></div>
          <div className="space-y-2"><Label>Category</Label>
            <Select value={form.category} onValueChange={(v)=>update('category',v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PRODUCT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Status</Label>
            <Select value={form.status} onValueChange={(v)=>update('status',v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PRODUCT_STATUS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Cost Price (IDR)</Label><Input type="number" value={form.costPrice||0} onChange={e=>update('costPrice', Number(e.target.value))} /></div>
          <div className="space-y-2"><Label>Selling Price (IDR)</Label><Input type="number" value={form.sellingPrice||0} onChange={e=>update('sellingPrice', Number(e.target.value))} /></div>
          <div className="col-span-2 space-y-2"><Label>Description</Label><Textarea value={form.description||''} onChange={e=>update('description', e.target.value)} /></div>
          <div className="space-y-2"><Label>Colors (comma)</Label><Input value={(form.colors||[]).join(', ')} onChange={e=>update('colors', e.target.value.split(',').map(s=>s.trim()).filter(Boolean))} /></div>
          <div className="space-y-2"><Label>Sizes (comma)</Label><Input value={(form.sizes||[]).join(', ')} onChange={e=>update('sizes', e.target.value.split(',').map(s=>s.trim()).filter(Boolean))} /></div>
          <div className="col-span-2 space-y-2"><Label>Tags (comma)</Label><Input value={(form.tags||[]).join(', ')} onChange={e=>update('tags', e.target.value.split(',').map(s=>s.trim()).filter(Boolean))} /></div>
          <div className="col-span-2 space-y-2"><Label>Notes</Label><Textarea value={form.notes||''} onChange={e=>update('notes', e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={()=>onOpenChange(false)}>Cancel</Button>
          <Button onClick={()=>onSave(form)}>{initial?.id ? 'Save changes' : 'Create product'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =========== INVENTORY ===========
function InventoryModule() {
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('all');
  useEffect(() => { (async () => { setItems(await api.get('inventory')); setProducts(await api.get('products')); })(); }, []);

  const adjust = async (item, delta) => {
    const updated = { ...item, quantity: Math.max(0, item.quantity + delta) };
    await api.put('inventory/' + item.id, updated);
    setItems(arr => arr.map(i => i.id === item.id ? updated : i));
  };

  const filtered = selectedProduct === 'all' ? items : items.filter(i => i.productId === selectedProduct);
  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach(i => {
      if (!map[i.productId]) map[i.productId] = {};
      if (!map[i.productId][i.color]) map[i.productId][i.color] = {};
      map[i.productId][i.color][i.size] = i;
    });
    return map;
  }, [filtered]);

  const totalStock = filtered.reduce((s,i)=>s+i.quantity,0);
  const critical = filtered.filter(i=>i.quantity < i.threshold);

  const colorSwatch = { Black: '#0a0a0a', 'Dark Grey': '#3f3f46', Navy: '#1e3a8a', White: '#fafafa', Olive: '#65733b', Burgundy: '#7a1f30' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Inventory</h2>
          <p className="text-sm text-muted-foreground mt-1">Real-time stock by product, color, and size</p>
        </div>
        <Select value={selectedProduct} onValueChange={setSelectedProduct}>
          <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All products</SelectItem>
            {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border/60"><CardContent className="pt-6"><p className="text-xs text-muted-foreground uppercase tracking-wider">Total Units</p><p className="text-2xl font-semibold mt-2">{totalStock.toLocaleString()}</p></CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-6"><p className="text-xs text-muted-foreground uppercase tracking-wider">SKUs</p><p className="text-2xl font-semibold mt-2">{filtered.length}</p></CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-6"><p className="text-xs text-muted-foreground uppercase tracking-wider text-rose-400">Critical</p><p className="text-2xl font-semibold mt-2 text-rose-400">{critical.length}</p></CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-6"><p className="text-xs text-muted-foreground uppercase tracking-wider">Incoming</p><p className="text-2xl font-semibold mt-2">{filtered.reduce((s,i)=>s+(i.incoming||0),0)}</p></CardContent></Card>
      </div>

      <div className="space-y-6">
        {Object.entries(grouped).map(([pid, colors]) => {
          const product = products.find(p => p.id === pid);
          if (!product) return null;
          return (
            <Card key={pid} className="border-border/60">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{product.name}</CardTitle>
                    <CardDescription>{product.sku} · {product.category}</CardDescription>
                  </div>
                  <Badge variant="outline">{Object.values(colors).reduce((s,sz)=>s+Object.values(sz).reduce((a,b)=>a+b.quantity,0),0)} units</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(colors).map(([color, sizes]) => (
                    <div key={color}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-3 h-3 rounded-full border border-border" style={{background: colorSwatch[color] || '#999'}} />
                        <p className="text-sm font-medium">{color}</p>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                        {Object.entries(sizes).map(([size, item]) => {
                          const crit = item.quantity < item.threshold;
                          return (
                            <div key={size} className={`rounded-lg border p-3 ${crit ? 'border-rose-500/40 bg-rose-500/5' : 'border-border bg-secondary/30'}`}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-muted-foreground font-medium">{size}</span>
                                {crit && <AlertTriangle className="h-3 w-3 text-rose-400" />}
                              </div>
                              <p className={`text-xl font-semibold ${crit ? 'text-rose-400' : ''}`}>{item.quantity}</p>
                              <div className="flex gap-1 mt-2">
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-xs" onClick={()=>adjust(item,-1)}>-</Button>
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-xs" onClick={()=>adjust(item,1)}>+</Button>
                                <Button size="sm" variant="ghost" className="h-6 flex-1 px-1 text-[10px]" onClick={()=>adjust(item,10)}>+10</Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// =========== PLANNING ===========
const PLAN_LEVELS = ['Monthly','Quarterly','Six-Month','Annual'];
const PLAN_STATUS = ['Planned','In Progress','At Risk','Completed'];

function PlanningModule() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [level, setLevel] = useState('all');
  const load = async () => setItems(await api.get('plans'));
  useEffect(() => { load(); }, []);

  const empty = { level:'Quarterly', title:'', objective:'', progress:0, status:'Planned', owner:'', dueDate:'', notes:'', keyResults:[], actionItems:[] };
  const save = async (data) => {
    if (editing?.id) await api.put('plans/'+editing.id, data); else await api.post('plans', data);
    setOpen(false); setEditing(null); load(); toast.success('Saved');
  };
  const del = async (id) => { await api.del('plans/'+id); load(); toast.success('Deleted'); };

  const filtered = level === 'all' ? items : items.filter(p => p.level === level);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Strategic Planning</h2>
          <p className="text-sm text-muted-foreground mt-1">Objectives, Key Results, and Action Items</p>
        </div>
        <Button onClick={()=>{ setEditing(null); setOpen(true); }} className="gap-2"><Plus className="h-4 w-4" /> New plan</Button>
      </div>

      <Tabs value={level} onValueChange={setLevel}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          {PLAN_LEVELS.map(l => <TabsTrigger key={l} value={l}>{l}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map(p => (
          <Card key={p.id} className="border-border/60 hover:border-border transition-colors">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">{p.level}</Badge>
                    <Badge variant={p.status==='Completed'?'default':p.status==='At Risk'?'destructive':'secondary'} className="text-xs">{p.status}</Badge>
                  </div>
                  <CardTitle className="text-base leading-tight">{p.title}</CardTitle>
                  <CardDescription className="mt-1">{p.objective}</CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={()=>{setEditing(p); setOpen(true);}}><Edit3 className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                    <DropdownMenuItem onClick={()=>del(p.id)} className="text-rose-400"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs mb-2"><span className="text-muted-foreground">Progress</span><span className="font-medium">{p.progress}%</span></div>
                <Progress value={p.progress} className="h-1.5" />
              </div>
              {p.keyResults?.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Key Results</p>
                  <ul className="space-y-1.5 text-sm">
                    {p.keyResults.map((k,i)=><li key={i} className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" /><span>{k}</span></li>)}
                  </ul>
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
                <span>{p.owner}</span>
                <span>{p.dueDate}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <PlanModal open={open} onOpenChange={setOpen} initial={editing || empty} onSave={save} />
    </div>
  );
}

function PlanModal({ open, onOpenChange, initial, onSave }) {
  const [form, setForm] = useState(initial);
  useEffect(()=>setForm(initial),[initial, open]);
  const update = (k,v)=>setForm(f=>({...f,[k]:v}));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{initial?.id?'Edit plan':'New plan'}</DialogTitle></DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin pr-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Level</Label>
              <Select value={form.level} onValueChange={v=>update('level',v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{PLAN_LEVELS.map(l=><SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-2"><Label>Status</Label>
              <Select value={form.status} onValueChange={v=>update('status',v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{PLAN_STATUS.map(l=><SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          <div className="space-y-2"><Label>Title</Label><Input value={form.title||''} onChange={e=>update('title',e.target.value)} /></div>
          <div className="space-y-2"><Label>Objective</Label><Textarea value={form.objective||''} onChange={e=>update('objective',e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Owner</Label><Input value={form.owner||''} onChange={e=>update('owner',e.target.value)} /></div>
            <div className="space-y-2"><Label>Due date</Label><Input type="date" value={form.dueDate||''} onChange={e=>update('dueDate',e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>Progress %</Label><Input type="number" min={0} max={100} value={form.progress||0} onChange={e=>update('progress', Number(e.target.value))} /></div>
          <div className="space-y-2"><Label>Key Results (one per line)</Label><Textarea value={(form.keyResults||[]).join('\n')} onChange={e=>update('keyResults', e.target.value.split('\n').filter(Boolean))} rows={3} /></div>
          <div className="space-y-2"><Label>Action Items (one per line)</Label><Textarea value={(form.actionItems||[]).join('\n')} onChange={e=>update('actionItems', e.target.value.split('\n').filter(Boolean))} rows={3} /></div>
        </div>
        <DialogFooter><Button variant="ghost" onClick={()=>onOpenChange(false)}>Cancel</Button><Button onClick={()=>onSave(form)}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =========== CONTENT PLANNER ===========
const CONTENT_STATUS = ['Idea','Draft','Shooting','Editing','Scheduled','Published'];
const PLATFORMS = ['Instagram','TikTok','YouTube','Threads'];

function ContentModule() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [view, setView] = useState('kanban');
  const load = async () => setItems(await api.get('content'));
  useEffect(() => { load(); }, []);

  const empty = { title:'', platform:'Instagram', format:'Reel', caption:'', objective:'', cta:'', owner:'', deadline:'', status:'Idea' };
  const save = async (data) => { if (editing?.id) await api.put('content/'+editing.id, data); else await api.post('content', data); setOpen(false); setEditing(null); load(); toast.success('Saved'); };
  const del = async (id) => { await api.del('content/'+id); load(); toast.success('Deleted'); };
  const moveStatus = async (item, status) => { await api.put('content/'+item.id, { ...item, status }); setItems(arr => arr.map(i => i.id===item.id?{...i,status}:i)); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Content Planner</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage all content across platforms</p>
        </div>
        <div className="flex gap-3">
          <Tabs value={view} onValueChange={setView}>
            <TabsList><TabsTrigger value="kanban">Kanban</TabsTrigger><TabsTrigger value="list">List</TabsTrigger></TabsList>
          </Tabs>
          <Button onClick={()=>{ setEditing(null); setOpen(true); }} className="gap-2"><Plus className="h-4 w-4" /> New content</Button>
        </div>
      </div>

      {view === 'kanban' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {CONTENT_STATUS.map(s => {
            const col = items.filter(i => i.status === s);
            return (
              <div key={s} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{s}</p>
                  <Badge variant="outline" className="text-xs">{col.length}</Badge>
                </div>
                <div className="space-y-2 min-h-[200px]">
                  {col.map(item => (
                    <Card key={item.id} className="border-border/60 cursor-pointer hover:border-border" onClick={()=>{setEditing(item); setOpen(true);}}>
                      <CardContent className="p-3 space-y-2">
                        <Badge variant="outline" className="text-[10px] font-normal">{item.platform}</Badge>
                        <p className="text-sm font-medium leading-tight">{item.title}</p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{item.owner?.split(' ')[0]}</span>
                          <span>{item.deadline?.slice(5)}</span>
                        </div>
                        <Select value={item.status} onValueChange={(v)=>moveStatus(item, v)}>
                          <SelectTrigger className="h-7 text-xs" onClick={(e)=>e.stopPropagation()}><SelectValue/></SelectTrigger>
                          <SelectContent>{CONTENT_STATUS.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="border-border/60">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/30">
              <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider">
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Platform</th>
                <th className="px-4 py-3 font-medium">Format</th>
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium">Deadline</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map(c => (
                <tr key={c.id} className="border-b border-border/60 hover:bg-secondary/30">
                  <td className="px-4 py-3 font-medium">{c.title}</td>
                  <td className="px-4 py-3"><Badge variant="outline">{c.platform}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground">{c.format}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.owner}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.deadline}</td>
                  <td className="px-4 py-3"><Badge>{c.status}</Badge></td>
                  <td className="px-4 py-3"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={()=>{setEditing(c); setOpen(true);}}><Edit3 className="h-4 w-4 mr-2"/>Edit</DropdownMenuItem><DropdownMenuItem onClick={()=>del(c.id)} className="text-rose-400"><Trash2 className="h-4 w-4 mr-2"/>Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <ContentModal open={open} onOpenChange={setOpen} initial={editing || empty} onSave={save} />
    </div>
  );
}

function ContentModal({ open, onOpenChange, initial, onSave }) {
  const [form, setForm] = useState(initial);
  useEffect(()=>setForm(initial),[initial, open]);
  const update = (k,v)=>setForm(f=>({...f,[k]:v}));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{initial?.id?'Edit content':'New content'}</DialogTitle></DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin pr-2">
          <div className="space-y-2"><Label>Title</Label><Input value={form.title||''} onChange={e=>update('title',e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Platform</Label><Select value={form.platform} onValueChange={v=>update('platform',v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{PLATFORMS.map(p=><SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Format</Label><Input value={form.format||''} onChange={e=>update('format',e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>Caption</Label><Textarea value={form.caption||''} onChange={e=>update('caption',e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Objective</Label><Input value={form.objective||''} onChange={e=>update('objective',e.target.value)} /></div>
            <div className="space-y-2"><Label>CTA</Label><Input value={form.cta||''} onChange={e=>update('cta',e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2"><Label>Owner</Label><Input value={form.owner||''} onChange={e=>update('owner',e.target.value)} /></div>
            <div className="space-y-2"><Label>Deadline</Label><Input type="date" value={form.deadline||''} onChange={e=>update('deadline',e.target.value)} /></div>
            <div className="space-y-2"><Label>Status</Label><Select value={form.status} onValueChange={v=>update('status',v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{CONTENT_STATUS.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
          </div>
        </div>
        <DialogFooter><Button variant="ghost" onClick={()=>onOpenChange(false)}>Cancel</Button><Button onClick={()=>onSave(form)}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =========== CREATOR CRM ===========
const CREATOR_STATUS = ['Not Contacted','DM Sent','Negotiation','Deal','Completed'];

function CreatorCRM() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('all');
  const load = async () => setItems(await api.get('creators'));
  useEffect(()=>{ load(); }, []);
  const updateStatus = async (item, status) => { await api.put('creators/'+item.id, { ...item, status }); setItems(arr=>arr.map(i=>i.id===item.id?{...i,status}:i)); };
  const filtered = status==='all'?items:items.filter(i=>i.status===status);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Creator CRM</h2>
        <p className="text-sm text-muted-foreground mt-1">Manage influencer collaborations with Islamic values alignment</p>
      </div>
      <Tabs value={status} onValueChange={setStatus}>
        <TabsList><TabsTrigger value="all">All</TabsTrigger>{CREATOR_STATUS.map(s=><TabsTrigger key={s} value={s}>{s}</TabsTrigger>)}</TabsList>
      </Tabs>
      <Card className="border-border/60 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-secondary/30">
            <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider">
              <th className="px-4 py-3 font-medium">Creator</th>
              <th className="px-4 py-3 font-medium">Platform</th>
              <th className="px-4 py-3 font-medium text-right">Followers</th>
              <th className="px-4 py-3 font-medium text-right">ER</th>
              <th className="px-4 py-3 font-medium">Niche</th>
              <th className="px-4 py-3 font-medium text-right">Values</th>
              <th className="px-4 py-3 font-medium text-right">Fee</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} className="border-b border-border/60 hover:bg-secondary/30">
                <td className="px-4 py-3"><div className="flex items-center gap-3"><Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{c.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</AvatarFallback></Avatar><div><p className="font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.username}</p></div></div></td>
                <td className="px-4 py-3"><Badge variant="outline">{c.platform}</Badge></td>
                <td className="px-4 py-3 text-right font-medium">{(c.followers/1000).toFixed(0)}K</td>
                <td className="px-4 py-3 text-right text-muted-foreground">{c.engagement}%</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{c.niche}</td>
                <td className="px-4 py-3 text-right"><span className={`font-medium ${c.valuesScore>=90?'text-emerald-400':c.valuesScore>=80?'text-amber-400':'text-rose-400'}`}>{c.valuesScore}</span></td>
                <td className="px-4 py-3 text-right text-muted-foreground">{fmtShort(c.fee)}</td>
                <td className="px-4 py-3"><Select value={c.status} onValueChange={v=>updateStatus(c,v)}><SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue/></SelectTrigger><SelectContent>{CREATOR_STATUS.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// =========== SCHOOL CRM ===========
const SCHOOL_STATUS = ['Prospect','Contacted','Meeting','Negotiation','Deal','Completed'];

function SchoolCRM() {
  const [items, setItems] = useState([]);
  const load = async () => setItems(await api.get('schools'));
  useEffect(()=>{ load(); }, []);
  const updateStatus = async (item, status) => { await api.put('schools/'+item.id, { ...item, status }); setItems(arr=>arr.map(i=>i.id===item.id?{...i,status}:i)); };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">School CRM</h2>
        <p className="text-sm text-muted-foreground mt-1">Islamic school partnerships pipeline</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {SCHOOL_STATUS.map(s => {
          const col = items.filter(i=>i.status===s);
          const val = col.reduce((a,b)=>a+b.value,0);
          return (
            <div key={s} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{s}</p>
                <Badge variant="outline" className="text-xs">{col.length}</Badge>
              </div>
              <p className="text-xs text-muted-foreground px-1">{fmtShort(val)}</p>
              <div className="space-y-2 min-h-[200px]">
                {col.map(item => (
                  <Card key={item.id} className="border-border/60">
                    <CardContent className="p-3 space-y-2">
                      <p className="text-sm font-medium leading-tight">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.city}, {item.province}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-emerald-400">{fmtShort(item.value)}</span>
                        <Badge variant="outline" className="text-[10px]">{item.segment}</Badge>
                      </div>
                      <Select value={item.status} onValueChange={v=>updateStatus(item,v)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue/></SelectTrigger>
                        <SelectContent>{SCHOOL_STATUS.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =========== TIMELINE ===========
function TimelineModule() {
  const [items, setItems] = useState([]);
  const load = async () => setItems(await api.get('timeline'));
  useEffect(()=>{ load(); }, []);

  const years = [2026, 2027, 2028];
  const grouped = years.reduce((acc, y) => { acc[y] = items.filter(i=>i.year===y); return acc; }, {});

  const priorityColor = { Critical: 'bg-rose-500', High: 'bg-amber-500', Medium: 'bg-blue-500', Low: 'bg-emerald-500' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Business Timeline</h2>
          <p className="text-sm text-muted-foreground mt-1">Roadmap 2026 to 2028</p>
        </div>
      </div>

      <div className="space-y-8">
        {years.map(year => (
          <div key={year}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-foreground text-background flex items-center justify-center font-bold text-sm">{year.toString().slice(2)}</div>
              <div>
                <h3 className="text-xl font-semibold">{year}</h3>
                <p className="text-xs text-muted-foreground">{grouped[year].length} initiatives · {fmtShort(grouped[year].reduce((s,i)=>s+(i.budget||0),0))} budget</p>
              </div>
            </div>
            <div className="relative pl-6 ml-5 border-l-2 border-border space-y-4">
              {grouped[year].map((init, i) => (
                <motion.div key={init.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="relative">
                  <div className={`absolute -left-[31px] top-4 w-3 h-3 rounded-full ${priorityColor[init.priority]||'bg-muted-foreground'} ring-4 ring-background`} />
                  <Card className="border-border/60 hover:border-border transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{init.name}</h4>
                            <Badge variant="outline" className="text-[10px]">{init.priority}</Badge>
                            <Badge variant="secondary" className="text-[10px]">{init.status}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{init.description}</p>
                          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                            <span>{init.startDate} → {init.endDate}</span>
                            <span>{init.owner}</span>
                            <span className="font-medium text-emerald-400">{fmtShort(init.budget)}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =========== FINANCE ===========
function FinanceModule() {
  const [finance, setFinance] = useState([]);
  const [scenario, setScenario] = useState('Normal');
  useEffect(()=>{ (async()=>setFinance(await api.get('finance')))(); }, []);

  const scenarioMultiplier = { Optimistic: 1.25, Normal: 1.0, Pessimistic: 0.75 }[scenario];
  const adjustedFinance = finance.map(f => ({ ...f, revenue: Math.round(f.revenue * scenarioMultiplier), profit: Math.round((f.revenue * scenarioMultiplier) - f.expenses) }));

  const totalRev = adjustedFinance.reduce((s,f)=>s+f.revenue,0);
  const totalExp = finance.reduce((s,f)=>s+f.expenses,0);
  const totalProfit = totalRev - totalExp;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Finance Center</h2>
          <p className="text-sm text-muted-foreground mt-1">Revenue, expenses, cashflow, and forecasting</p>
        </div>
        <Select value={scenario} onValueChange={setScenario}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Scenario" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Optimistic">Optimistic (+25%)</SelectItem>
            <SelectItem value="Normal">Normal forecast</SelectItem>
            <SelectItem value="Pessimistic">Pessimistic (-25%)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border/60"><CardContent className="pt-6"><p className="text-xs text-muted-foreground uppercase tracking-wider">Revenue</p><p className="text-2xl font-semibold mt-2">{fmtShort(totalRev)}</p><p className="text-xs text-emerald-400 mt-1">{((scenarioMultiplier-1)*100).toFixed(0)}% vs base</p></CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-6"><p className="text-xs text-muted-foreground uppercase tracking-wider">Expenses</p><p className="text-2xl font-semibold mt-2">{fmtShort(totalExp)}</p></CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-6"><p className="text-xs text-muted-foreground uppercase tracking-wider">Net Profit</p><p className={`text-2xl font-semibold mt-2 ${totalProfit>=0?'text-emerald-400':'text-rose-400'}`}>{fmtShort(totalProfit)}</p></CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-6"><p className="text-xs text-muted-foreground uppercase tracking-wider">Margin</p><p className="text-2xl font-semibold mt-2">{totalRev?((totalProfit/totalRev)*100).toFixed(1):0}%</p></CardContent></Card>
      </div>

      <Card className="border-border/60">
        <CardHeader><CardTitle className="text-base">Revenue · Expenses · Profit Trend</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={adjustedFinance}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={fmtShort} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} formatter={fmt} />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="hsl(var(--chart-1))" strokeWidth={2} />
              <Line type="monotone" dataKey="expenses" stroke="hsl(var(--chart-5))" strokeWidth={2} />
              <Line type="monotone" dataKey="profit" stroke="hsl(var(--chart-2))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/60">
          <CardHeader><CardTitle className="text-base">Cashflow Projection</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={adjustedFinance}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={fmtShort} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} formatter={fmt} />
                <Bar dataKey="cashflow" fill="hsl(var(--chart-2))" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardHeader><CardTitle className="text-base">Monthly Detail</CardTitle></CardHeader>
          <CardContent>
            <ScrollArea className="h-[260px]">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground uppercase">
                  <tr><th className="text-left py-2">Month</th><th className="text-right">Revenue</th><th className="text-right">Expenses</th><th className="text-right">Profit</th></tr>
                </thead>
                <tbody>
                  {adjustedFinance.map(f => (
                    <tr key={f.id} className="border-b border-border/60">
                      <td className="py-2 font-medium">{f.month}</td>
                      <td className="text-right">{fmtShort(f.revenue)}</td>
                      <td className="text-right text-muted-foreground">{fmtShort(f.expenses)}</td>
                      <td className={`text-right font-medium ${f.profit>=0?'text-emerald-400':'text-rose-400'}`}>{fmtShort(f.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// =========== EVENTS ===========
function EventsModule() {
  const [items, setItems] = useState([]);
  const load = async () => setItems(await api.get('events'));
  useEffect(()=>{ load(); }, []);
  const toggleCheck = async (event, idx) => {
    const newChecklist = event.checklist.map((c,i) => i===idx ? { ...c, done: !c.done } : c);
    await api.put('events/'+event.id, { ...event, checklist: newChecklist });
    setItems(arr=>arr.map(e=>e.id===event.id?{...e,checklist:newChecklist}:e));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Events · One Goal</h2>
        <p className="text-sm text-muted-foreground mt-1">Manage events end-to-end</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map(e => {
          const total = e.checklist?.length || 0;
          const done = e.checklist?.filter(c=>c.done).length || 0;
          const pct = total ? (done/total*100) : 0;
          return (
            <Card key={e.id} className="border-border/60">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{e.name}</CardTitle>
                    <CardDescription>{e.venue} · {e.date}</CardDescription>
                  </div>
                  <Badge variant="secondary">{e.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><p className="text-muted-foreground">Budget</p><p className="font-medium">{fmtShort(e.budget)}</p></div>
                  <div><p className="text-muted-foreground">Participants</p><p className="font-medium">{e.participants}</p></div>
                  <div><p className="text-muted-foreground">Sponsors</p><p className="font-medium">{e.sponsors?.length || 0}</p></div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5"><span className="text-muted-foreground">Checklist</span><span>{done}/{total}</span></div>
                  <Progress value={pct} className="h-1.5" />
                </div>
                <div className="space-y-1.5 pt-2 border-t border-border">
                  {e.checklist?.map((c,i) => (
                    <button key={i} onClick={()=>toggleCheck(e,i)} className="flex items-center gap-2 text-sm w-full text-left hover:bg-secondary/50 rounded px-1 py-0.5">
                      {c.done ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                      <span className={c.done?'line-through text-muted-foreground':''}>{c.task}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// =========== REPORTS ===========
function ReportsModule() {
  const exportCSV = async (collection, columns) => {
    const data = await api.get(collection);
    const headers = Object.keys(columns);
    const rows = data.map(d => headers.map(h => {
      const val = d[columns[h]];
      if (Array.isArray(val)) return `"${val.join('; ')}"`;
      if (typeof val === 'string') return `"${val.replace(/"/g,'""')}"`;
      return val ?? '';
    }).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${collection}-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${collection}.csv`);
  };

  const reports = [
    { id: 'sales', title: 'Sales Report', desc: 'Product revenue & margin analysis', collection: 'products', columns: { Name:'name', SKU:'sku', Category:'category', Status:'status', Cost:'costPrice', Selling:'sellingPrice' } },
    { id: 'inventory', title: 'Inventory Report', desc: 'Stock by SKU, color, size', collection: 'inventory', columns: { ProductId:'productId', Color:'color', Size:'size', Quantity:'quantity', Threshold:'threshold', Incoming:'incoming' } },
    { id: 'content', title: 'Content Performance', desc: 'Content pipeline export', collection: 'content', columns: { Title:'title', Platform:'platform', Format:'format', Owner:'owner', Deadline:'deadline', Status:'status' } },
    { id: 'creators', title: 'Creator Collaborations', desc: 'Creator CRM full export', collection: 'creators', columns: { Name:'name', Username:'username', Platform:'platform', Followers:'followers', Engagement:'engagement', Fee:'fee', Status:'status' } },
    { id: 'schools', title: 'School Partnerships', desc: 'School pipeline & values', collection: 'schools', columns: { Name:'name', City:'city', Province:'province', Segment:'segment', Value:'value', Status:'status' } },
    { id: 'finance', title: 'Financial Report', desc: 'Monthly P&L and cashflow', collection: 'finance', columns: { Month:'month', Year:'year', Revenue:'revenue', Expenses:'expenses', Profit:'profit', Cashflow:'cashflow' } },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Reports</h2>
        <p className="text-sm text-muted-foreground mt-1">Generate and export business reports</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map(r => (
          <Card key={r.id} className="border-border/60 hover:border-border transition-colors">
            <CardHeader>
              <CardTitle className="text-base">{r.title}</CardTitle>
              <CardDescription>{r.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full gap-2" onClick={()=>exportCSV(r.collection, r.columns)}>
                <Download className="h-4 w-4" /> Export CSV
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// =========== NOTIFICATIONS ===========
function NotificationsModule() {
  const [items, setItems] = useState([]);
  const load = async () => setItems(await api.get('notifications'));
  useEffect(()=>{ load(); }, []);
  const markRead = async (item) => { await api.put('notifications/'+item.id, { ...item, read: true }); load(); };
  const sevColor = { critical: 'text-rose-400 bg-rose-500/10 border-rose-500/30', warning: 'text-amber-400 bg-amber-500/10 border-amber-500/30', info: 'text-blue-400 bg-blue-500/10 border-blue-500/30', success: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Notifications</h2>
        <p className="text-sm text-muted-foreground mt-1">Alerts and updates across all modules</p>
      </div>
      <div className="space-y-2">
        {items.map(n => (
          <Card key={n.id} className={`border-border/60 ${!n.read ? 'bg-secondary/30' : ''} cursor-pointer`} onClick={()=>!n.read && markRead(n)}>
            <CardContent className="p-4 flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${sevColor[n.severity]||''}`}><Bell className="h-4 w-4" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium">{n.title}</p>
                  <Badge variant="outline" className="text-[10px]">{n.type}</Badge>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                </div>
                <p className="text-sm text-muted-foreground">{n.message}</p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{new Date(n.createdAt).toLocaleDateString()}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// =========== SETTINGS ===========
function SettingsModule({ user }) {
  const [users, setUsers] = useState([]);
  useEffect(()=>{ (async()=>setUsers(await api.get('users')))(); }, []);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">Manage your workspace</p>
      </div>
      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="users">Users & Roles</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>
        <TabsContent value="company" className="space-y-4 mt-4">
          <Card className="border-border/60"><CardHeader><CardTitle className="text-base">Company Information</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Company Name</Label><Input defaultValue="ONEMISSION" /></div>
              <div className="space-y-2"><Label>Tagline</Label><Input defaultValue="VALUES MATTER" /></div>
            </div>
            <div className="space-y-2"><Label>Mission</Label><Textarea defaultValue="Empower Muslim athletes worldwide through premium values-aligned apparel and community." /></div>
            <Button>Save changes</Button>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="users" className="space-y-4 mt-4">
          <Card className="border-border/60"><CardHeader><CardTitle className="text-base">Team Members</CardTitle></CardHeader><CardContent>
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary/30"><tr className="text-left text-xs text-muted-foreground uppercase tracking-wider"><th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Email</th><th className="px-4 py-3 font-medium">Role</th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-border/60">
                    <td className="px-4 py-3"><div className="flex items-center gap-3"><Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{u.avatar}</AvatarFallback></Avatar><span className="font-medium">{u.name}</span></div></td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3"><Badge>{u.role}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="notifications" className="space-y-4 mt-4">
          <Card className="border-border/60"><CardHeader><CardTitle className="text-base">Notification Preferences</CardTitle></CardHeader><CardContent className="space-y-4">
            {['Low stock alerts','Upcoming deadlines','Event reminders','Creator updates','School updates','Financial alerts'].map(p => (
              <div key={p} className="flex items-center justify-between"><Label>{p}</Label><Switch defaultChecked /></div>
            ))}
          </CardContent></Card>
          <Card className="border-border/60"><CardHeader><CardTitle className="text-base">Stock Thresholds</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Critical threshold (units)</Label><Input type="number" defaultValue={15} /></div>
              <div className="space-y-2"><Label>Warning threshold (units)</Label><Input type="number" defaultValue={30} /></div>
            </div>
            <Button>Save</Button>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="appearance" className="space-y-4 mt-4">
          <Card className="border-border/60"><CardHeader><CardTitle className="text-base">Appearance</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="flex items-center justify-between"><Label>Dark Mode</Label><Switch defaultChecked onCheckedChange={(v)=>document.documentElement.classList.toggle('dark', v)} /></div>
            <div className="flex items-center justify-between"><Label>Reduced Motion</Label><Switch /></div>
            <div className="flex items-center justify-between"><Label>Compact spacing</Label><Switch /></div>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="integrations" className="space-y-4 mt-4">
          <Card className="border-border/60"><CardHeader><CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" /> Public Product API</CardTitle><CardDescription>Sync approved products to the main ONEMISSION website in real-time</CardDescription></CardHeader><CardContent className="space-y-3">
            <div className="rounded-lg border border-border bg-secondary/30 p-3 font-mono text-xs flex items-center justify-between">
              <span className="text-muted-foreground">GET</span>
              <span className="text-foreground/90">/api/public/products</span>
              <Button size="sm" variant="ghost" onClick={()=>{navigator.clipboard.writeText('/api/public/products'); toast.success('Copied');}}>Copy</Button>
            </div>
            <p className="text-xs text-muted-foreground">Exposes Active products with aggregated stock. Updates automatically when inventory changes.</p>
            <Button variant="outline" onClick={async()=>{ const r = await fetch('/api/public/products'); const d = await r.json(); console.log(d); toast.success(`${d.length} products synced`); }}>Test endpoint</Button>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// =========== MAIN APP ===========
function App() {
  const [user, setUser] = useState(null);
  const [active, setActive] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const [bootChecked, setBootChecked] = useState(false);

  useEffect(() => {
    const u = localStorage.getItem('om_user');
    if (u) setUser(JSON.parse(u));
    setBootChecked(true);
  }, []);

  if (!bootChecked) return <div className="min-h-screen bg-background" />;
  if (!user) return <Login onLogin={setUser} />;

  const filteredNav = NAV.filter(n => !query || n.label.toLowerCase().includes(query.toLowerCase()));
  const Component = {
    dashboard: <Dashboard />, products: <ProductsModule />, inventory: <InventoryModule />,
    planning: <PlanningModule />, content: <ContentModule />, creators: <CreatorCRM />,
    schools: <SchoolCRM />, timeline: <TimelineModule />, finance: <FinanceModule />,
    events: <EventsModule />, reports: <ReportsModule />, notifications: <NotificationsModule />,
    settings: <SettingsModule user={user} />,
  }[active];

  const logout = () => { localStorage.removeItem('om_user'); setUser(null); };

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <aside className={`${collapsed ? 'w-[64px]' : 'w-[240px]'} shrink-0 border-r border-border bg-sidebar transition-all duration-200 flex flex-col h-screen sticky top-0`}>
        <div className="p-4 border-b border-border flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-foreground text-background flex items-center justify-center font-bold text-sm shrink-0">OM</div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-tight">ONEMISSION HQ</p>
              <p className="text-[10px] text-muted-foreground tracking-widest uppercase">Values Matter</p>
            </div>
          )}
        </div>
        <div className="p-3">
          {!collapsed && (
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search..." className="pl-8 h-8 text-xs" value={query} onChange={e=>setQuery(e.target.value)} />
            </div>
          )}
        </div>
        <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto scrollbar-thin">
          {filteredNav.map(item => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={()=>setActive(item.id)}
                className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-sidebar-accent transition-colors">
                <Avatar className="h-7 w-7"><AvatarFallback className="text-xs">{user.avatar}</AvatarFallback></Avatar>
                {!collapsed && (
                  <div className="text-left min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{user.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{user.role}</p>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={()=>setCollapsed(!collapsed)}>{collapsed ? 'Expand sidebar' : 'Collapse sidebar'}</DropdownMenuItem>
              <DropdownMenuItem onClick={()=>setActive('settings')}><SettingsIcon className="h-4 w-4 mr-2" />Settings</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-rose-400"><LogOut className="h-4 w-4 mr-2" /> Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="sticky top-0 z-10 glass border-b border-border px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">ONEMISSION HQ</span>
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium capitalize">{NAV.find(n=>n.id===active)?.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={()=>setActive('notifications')}><Bell className="h-4 w-4" /></Button>
            <Badge variant="outline" className="gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Online</Badge>
          </div>
        </div>
        <div className="p-6 max-w-[1600px]">
          <AnimatePresence mode="wait">
            <motion.div key={active} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {Component}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default App;
