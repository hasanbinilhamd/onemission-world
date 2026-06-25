"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Package,
  Boxes,
  Target,
  CalendarDays,
  Users2,
  School,
  Route,
  Wallet,
  PartyPopper,
  FileBarChart2,
  Bell,
  Settings as SettingsIcon,
  Search,
  LogOut,
  Plus,
  Edit3,
  Trash2,
  Copy,
  Gauge,
  Archive,
  Download,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  CheckCircle2,
  Circle,
  MoreHorizontal,
  ChevronRight,
  Sparkles,
  Globe,
  Loader2,
  ExternalLink,
  MessageCircle,
  Mail,
  Phone,
  Menu,
  X,
  Layers,
  LayoutGrid,
  List,
  ImageOff,
  BookOpen,
  ChevronLeft,
  ClipboardList,
  Lock,
  Send,
  Scale,
  BarChart2,
  Landmark,
  Truck,
  Factory,
  ShoppingCart,
  Activity,
  Megaphone,
  Shield,
  Users,
  PackageCheck,
  FileText,
  UserCog,
  RefreshCw,
} from "lucide-react";
import {
  TableSkeleton,
  CardSkeleton,
  StatsSkeleton,
  KanbanSkeleton,
  TimelineSkeleton,
  ListSkeleton,
  ProductGridSkeleton,
  InventorySkeleton,
} from "@/components/onemission/skeletons";

// Normalize Indonesian phone number for wa.me link
function whatsappUrl(phone) {
  if (!phone) return null;
  let digits = String(phone).replace(/[^\d]/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) digits = "62" + digits.slice(1);
  if (digits.startsWith("620")) digits = "62" + digits.slice(3);
  return `https://wa.me/${digits}`;
}

// Build a profile URL from a username/handle/URL based on platform
function creatorProfileUrl(username, platform) {
  if (!username) return null;
  const u = String(username).trim();
  // Already a full URL
  if (/^https?:\/\//i.test(u)) return u;
  // Strip leading @ and any leading slashes
  const handle = u.replace(/^@+/, "").replace(/^\/+/, "");
  if (!handle) return null;
  switch ((platform || "").toLowerCase()) {
    case "instagram":
      return `https://www.instagram.com/${handle}/`;
    case "tiktok":
      return `https://www.tiktok.com/@${handle}`;
    case "youtube":
      return `https://www.youtube.com/@${handle}`;
    case "threads":
      return `https://www.threads.net/@${handle}`;
    default:
      return `https://www.instagram.com/${handle}/`;
  }
}

// Short display label for a username/URL
function creatorHandleLabel(username, platform) {
  if (!username) return "";
  const u = String(username).trim();
  if (/^https?:\/\//i.test(u)) {
    try {
      const url = new URL(u);
      const path = url.pathname.replace(/\/+$/, "").replace(/^\/+/, "");
      const handle = path.split("/").pop() || url.hostname;
      return "@" + handle.replace(/^@+/, "");
    } catch {
      return u;
    }
  }
  return u.startsWith("@") ? u : "@" + u;
}
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const fmt = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");
const fmtShort = (n) => {
  if (n >= 1_000_000_000) return "Rp " + (n / 1_000_000_000).toFixed(1) + "B";
  if (n >= 1_000_000) return "Rp " + (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return "Rp " + (n / 1_000).toFixed(0) + "K";
  return "Rp " + n;
};

// Numeric input with Indonesian-style thousand separator (titik) and smart leading-zero handling
function NumberInput({
  value,
  onChange,
  decimal = false,
  max,
  min,
  placeholder,
  className,
  ...rest
}) {
  const formatId = (n) => {
    if (n === "" || n === null || n === undefined) return "";
    const num = Number(n);
    if (isNaN(num)) return "";
    if (decimal) {
      // Keep up to 2 decimals, comma as decimal separator (id-ID)
      return num.toLocaleString("id-ID", { maximumFractionDigits: 2 });
    }
    return Math.trunc(num).toLocaleString("id-ID");
  };
  const [display, setDisplay] = useState(() => formatId(value));
  // Sync when external value changes (modal open, reset, etc.)
  useEffect(() => {
    setDisplay(formatId(value)); /* eslint-disable-next-line */
  }, [value]);

  const handle = (e) => {
    let raw = e.target.value;
    if (decimal) {
      // Allow only digits, dot, comma
      raw = raw.replace(/[^\d.,]/g, "");
      // Normalize: dots are thousand separators in id-ID, comma is decimal
      // Strip all dots first, then convert comma to a decimal point for parsing
      const withoutThousands = raw.replace(/\./g, "");
      const normalized = withoutThousands.replace(/,/g, ".");
      // Keep only the first decimal point
      const parts = normalized.split(".");
      let cleaned =
        parts.shift().replace(/^0+(?=\d)/, "") || (parts.length ? "0" : "");
      if (parts.length) cleaned += "." + parts.join("").slice(0, 2);
      if (cleaned === "" || cleaned === ".") {
        setDisplay("");
        onChange(0);
        return;
      }
      let num = Number(cleaned);
      if (isNaN(num)) num = 0;
      if (typeof max === "number" && num > max) num = max;
      if (typeof min === "number" && num < min) num = min;
      // Display: integer part with dots, decimal part with comma
      const [ip, dp] = String(num).split(".");
      const formatted =
        Number(ip).toLocaleString("id-ID") +
        (dp ? "," + dp : raw.endsWith(",") || raw.endsWith(".") ? "," : "");
      setDisplay(formatted);
      onChange(num);
      return;
    }
    // Integer mode: strip all non-digits, drop leading zeros
    const digits = raw.replace(/[^\d]/g, "");
    const cleaned = digits.replace(/^0+(?=\d)/, "");
    if (cleaned === "") {
      setDisplay("");
      onChange(0);
      return;
    }
    let num = Number(cleaned);
    if (typeof max === "number" && num > max) num = max;
    if (typeof min === "number" && num < min) num = min;
    setDisplay(num.toLocaleString("id-ID"));
    onChange(num);
  };

  const handleFocus = (e) => {
    // If current value is exactly 0, clear on focus so user can type fresh
    if (Number(value) === 0) {
      setDisplay("");
    }
    e.target.select?.();
  };

  const handleBlur = () => {
    if (display === "" || display === null) {
      setDisplay(formatId(0));
      onChange(0);
    }
  };

  return (
    <Input
      inputMode={decimal ? "decimal" : "numeric"}
      type="text"
      value={display}
      onChange={handle}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
      {...rest}
    />
  );
}

const api = {
  async login(email, password) {
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) throw new Error("Invalid credentials");
    return r.json();
  },
  async get(path) {
    const r = await fetch("/api/" + path);
    return r.json();
  },
  async post(path, body) {
    const r = await fetch("/api/" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return r.json();
  },
  async put(path, body) {
    const r = await fetch("/api/" + path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return r.json();
  },
  async del(path) {
    const r = await fetch("/api/" + path, { method: "DELETE" });
    return r.json();
  },
};

const NAV_GROUPS = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    single: true,
  },
  {
    id: "operations",
    label: "Operations",
    icon: Factory,
    children: [
      { id: "products", label: "Product Catalog", icon: Package },
      { id: "rawmaterials", label: "Raw Materials", icon: Layers },
      { id: "suppliers", label: "Suppliers", icon: Truck },
      { id: "bom", label: "Bill of Materials (BOM)", icon: FileText },
      { id: "productionorders", label: "Production Orders", icon: Factory },
      {
        id: "productionresults",
        label: "Production Results",
        icon: ClipboardList,
      },
      { id: "inventory", label: "Inventory", icon: Boxes },
      { id: "stockmovements", label: "Stock Movements", icon: Activity },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    icon: ShoppingCart,
    children: [
      { id: "customers", label: "Customers", icon: Users },
      { id: "orders", label: "Orders", icon: ShoppingCart },
      { id: "saleschannels", label: "Sales Channels", icon: Globe },
      { id: "schools", label: "School Partners", icon: School },
    ],
  },
  {
    id: "financial",
    label: "Finance",
    icon: Wallet,
    children: [
      { id: "chartofaccounts", label: "Chart of Accounts", icon: BookOpen },
      {
        id: "financialaccounts",
        label: "Financial Accounts",
        icon: DollarSign,
      },
      { id: "cashin", label: "Cash In", icon: TrendingUp },
      { id: "cashout", label: "Cash Out", icon: TrendingDown },
      { id: "journalentries", label: "Journal Entries", icon: ClipboardList },
      { id: "generalledger", label: "General Ledger", icon: BookOpen },
      { id: "trialbalance", label: "Trial Balance", icon: Scale },
      { id: "profitloss", label: "Profit & Loss", icon: BarChart2 },
      { id: "balancesheet", label: "Balance Sheet", icon: Landmark },
      { id: "cashflowstatement", label: "Cash Flow", icon: Layers },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    icon: Megaphone,
    children: [
      { id: "content", label: "Content", icon: CalendarDays },
      { id: "creators", label: "Creators", icon: Users2 },
      { id: "campaigns", label: "Campaigns", icon: Megaphone },
    ],
  },
  {
    id: "reportsgroup",
    label: "Reports",
    icon: FileBarChart2,
    children: [
      { id: "productanalytics", label: "Product Analytics", icon: BarChart2 },
      { id: "inventoryanalytics", label: "Inventory Analytics", icon: Boxes },
      {
        id: "financialanalytics",
        label: "Financial Analytics",
        icon: DollarSign,
      },
      {
        id: "marketinganalytics",
        label: "Marketing Analytics",
        icon: Megaphone,
      },
      {
        id: "executivereports",
        label: "Executive Reports",
        icon: FileBarChart2,
      },
    ],
  },
  {
    id: "system",
    label: "Settings",
    icon: SettingsIcon,
    children: [
      { id: "users", label: "Users", icon: Users },
      { id: "rolespermissions", label: "Roles & Permissions", icon: Shield },
      {
        id: "notificationsettings",
        label: "Notification Settings",
        icon: Bell,
      },
      { id: "systemconfig", label: "System Configuration", icon: SettingsIcon },
    ],
  },
];

// Helper: get flat label for any nav id
function getNavLabel(id) {
  for (const g of NAV_GROUPS) {
    if (g.single && g.id === id) return g.label;
    if (g.children) {
      const child = g.children.find((c) => c.id === id);
      if (child) return child.label;
    }
  }
  return id;
}

// Helper: get parent group id for an active child
function getParentGroup(id) {
  for (const g of NAV_GROUPS) {
    if (g.children?.some((c) => c.id === id)) return g.id;
  }
  return null;
}

// =========== LOGIN ===========
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { user } = await api.login(email, password);
      localStorage.setItem("om_user", JSON.stringify(user));
      onLogin(user);
      toast.success(`Welcome back, ${user.name}`);
    } catch (err) {
      toast.error("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-6 relative overflow-hidden">
      {/* Ambient blobs */}
      <div className="absolute top-[-80px] right-[-80px] w-[480px] h-[480px] rounded-full bg-[#D8E3F3]/40 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-80px] left-[-80px] w-[400px] h-[400px] rounded-full bg-[#EEF3FA]/60 blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="inline-flex items-center justify-center w-[72px] h-[72px] rounded-[24px] bg-white shadow-[0_8px_32px_rgba(0,0,0,0.10)] mb-6"
          >
            <img
              src="https://ik.imagekit.io/edyl3oplm/Onemission/logos/LOGO_ONEMISSION_3D.png"
              alt="Logo"
              className="w-[52px] h-[52px] object-contain"
            />
          </motion.div>
          <h1 className="text-[2rem] font-bold tracking-[0.06em] uppercase text-[#111827]">
            ONEMISSION
          </h1>
          <p className="text-[11px] text-[#5F6B7A] mt-2 tracking-[0.25em] uppercase font-medium">
            Values Matter
          </p>
        </div>

        {/* Login card */}
        <div className="bg-white rounded-[32px] border border-[rgba(17,24,39,0.05)] shadow-[0_16px_56px_rgba(0,0,0,0.07)] p-8">
          <div className="mb-6">
            <h2 className="text-lg font-bold tracking-tight text-[#111827]">
              Mission Control
            </h2>
            <p className="text-sm text-[#5F6B7A] mt-1">
              Sign in to access the operating system
            </p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-[#111827] tracking-wide">
                Email
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@onemission.id"
                type="email"
                className="w-full h-[52px] px-5 rounded-[20px] bg-[#F7F8FA] border border-[rgba(17,24,39,0.07)] text-[#111827] placeholder:text-[#5F6B7A]/50 focus:outline-none focus:border-[#BFCDE2] focus:shadow-[0_0_0_4px_rgba(191,205,226,0.25)] transition-all text-sm font-medium"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-[#111827] tracking-wide">
                Password
              </label>
              <input
                placeholder="••••••••"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-[52px] px-5 rounded-[20px] bg-[#F7F8FA] border border-[rgba(17,24,39,0.07)] text-[#111827] placeholder:text-[#5F6B7A]/50 focus:outline-none focus:border-[#BFCDE2] focus:shadow-[0_0_0_4px_rgba(191,205,226,0.25)] transition-all text-sm font-medium"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[52px] mt-2 rounded-[18px] bg-[#111827] text-white font-semibold text-sm tracking-wide hover:bg-[#1e293b] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(17,24,39,0.25)] active:translate-y-0 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-[#5F6B7A]/60 mt-8 tracking-[0.15em] uppercase">
          ONEMISSION HQ · Internal Operations
        </p>
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
      setStats(await api.get("dashboard"));
      setFinance(await api.get("finance"));
      setProducts(await api.get("products"));
      setInventory(await api.get("inventory"));
      setContent(await api.get("content"));
      setEvents(await api.get("events"));
      setCreators(await api.get("creators"));
      setSchools(await api.get("schools"));
    })();
  }, []);

  const expenseBreakdown = useMemo(() => {
    if (!finance.length) return [];
    const totals = {};
    finance.forEach((f) =>
      Object.entries(f.categoryBreakdown || {}).forEach(
        ([k, v]) => (totals[k] = (totals[k] || 0) + v),
      ),
    );
    return Object.entries(totals).map(([name, value]) => ({ name, value }));
  }, [finance]);

  const lowStock = useMemo(() => {
    return inventory
      .filter((i) => i.quantity < i.threshold)
      .slice(0, 5)
      .map((i) => {
        const p = products.find((p) => p.id === i.productId);
        return { ...i, productName: p?.name || "Unknown" };
      });
  }, [inventory, products]);

  const chartColors = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
    "#94a3b8",
    "#64748b",
  ];

  if (!stats) return <DashboardSkeleton />;

  const KPI = ({ label, value, sub, icon: Icon, trend }) => (
    <div className="bg-white rounded-[28px] border border-[rgba(17,24,39,0.05)] shadow-[0_8px_32px_rgba(0,0,0,0.05)] p-6 hover:-translate-y-[3px] hover:shadow-[0_16px_40px_rgba(0,0,0,0.08)] transition-all duration-300 cursor-default">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-[14px] bg-gradient-to-br from-[#EEF3FA] to-[#D8E3F3] flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-[#5F6B7A]" />
        </div>
        {trend && (
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${trend === "up" ? "bg-[#4FAF73]/10 text-[#4FAF73]" : "bg-[#E26D6D]/10 text-[#E26D6D]"}`}
          >
            {trend === "up" ? (
              <TrendingUp className="h-2.5 w-2.5" />
            ) : (
              <TrendingDown className="h-2.5 w-2.5" />
            )}
          </div>
        )}
      </div>
      <p className="text-[10.5px] text-[#5F6B7A] uppercase tracking-[0.14em] font-bold">
        {label}
      </p>
      <p className="text-[1.55rem] font-bold tracking-tight text-[#111827] mt-1 leading-tight">
        {value}
      </p>
      {sub && (
        <p className="text-[11.5px] text-[#5F6B7A] mt-1.5 font-medium">{sub}</p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[1.6rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">
            CEO Dashboard
          </h2>
          <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">
            Real-time pulse of ONEMISSION operations
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#4FAF73]/10 border border-[#4FAF73]/20">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4FAF73] animate-pulse" />
          <span className="text-[11px] font-bold text-[#4FAF73] tracking-[0.12em] uppercase">
            Live
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPI
          label="Total Revenue"
          value={fmtShort(stats.totalRevenue)}
          sub="YTD 2026"
          icon={DollarSign}
          trend="up"
        />
        <KPI
          label="Monthly Revenue"
          value={fmtShort(stats.monthlyRevenue)}
          sub={`${stats.salesGrowth >= 0 ? "+" : ""}${stats.salesGrowth}% MoM`}
          icon={TrendingUp}
          trend={stats.salesGrowth >= 0 ? "up" : "down"}
        />
        <KPI
          label="Net Profit"
          value={fmtShort(stats.netProfit)}
          sub="After expenses"
          icon={Sparkles}
          trend="up"
        />
        <KPI
          label="Expenses"
          value={fmtShort(stats.expenses)}
          sub="YTD"
          icon={Wallet}
        />
        <KPI
          label="Cash Position"
          value={fmtShort(stats.cashPosition)}
          sub="Available"
          icon={ShoppingBag}
          trend="up"
        />
        <KPI
          label="Low Stock"
          value={stats.lowStockCount}
          sub="SKUs critical"
          icon={AlertTriangle}
          trend="down"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Revenue by Month</CardTitle>
            <CardDescription>2026 monthly performance</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={finance}>
                <defs>
                  <linearGradient id="revG" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="hsl(var(--chart-1))"
                      stopOpacity={0.5}
                    />
                    <stop
                      offset="100%"
                      stopColor="hsl(var(--chart-1))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="hsl(var(--border))"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickFormatter={(v) => fmtShort(v)}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                  formatter={(v) => fmt(v)}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  fill="url(#revG)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="">
          <CardHeader>
            <CardTitle className="text-base">Expense Breakdown</CardTitle>
            <CardDescription>Category distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={expenseBreakdown}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {expenseBreakdown.map((_, i) => (
                    <Cell key={i} fill={chartColors[i % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                  formatter={(v) => fmtShort(v)}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 text-xs mt-2">
              {expenseBreakdown.slice(0, 5).map((c, i) => (
                <div key={c.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{
                        background: chartColors[i % chartColors.length],
                      }}
                    />
                    {c.name}
                  </div>
                  <span className="text-muted-foreground">
                    {fmtShort(c.value)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="">
          <CardHeader>
            <CardTitle className="text-base">Cashflow Trend</CardTitle>
            <CardDescription>Net cash position over months</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={finance}>
                <CartesianGrid
                  stroke="hsl(var(--border))"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickFormatter={fmtShort}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                  formatter={fmt}
                />
                <Line
                  type="monotone"
                  dataKey="cashflow"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke="hsl(var(--chart-3))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="">
          <CardHeader>
            <CardTitle className="text-base">
              Product Sales Performance
            </CardTitle>
            <CardDescription>Top selling categories</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={[
                  { name: "2-in-1 Shorts", sales: 4200 },
                  { name: "Compression", sales: 2800 },
                  { name: "Jerseys", sales: 3600 },
                  { name: "Jackets", sales: 1500 },
                  { name: "Accessories", sales: 980 },
                ]}
              >
                <CartesianGrid
                  stroke="hsl(var(--border))"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                />
                <Bar
                  dataKey="sales"
                  fill="hsl(var(--chart-1))"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Critical
              Stock
            </CardTitle>
            <CardDescription>Restock immediately</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {lowStock.length === 0 && (
              <p className="text-sm text-muted-foreground">
                All stock above threshold
              </p>
            )}
            {lowStock.map((i) => (
              <div
                key={i.id}
                className="flex items-center justify-between text-sm"
              >
                <div>
                  <p className="font-medium truncate max-w-[180px]">
                    {i.productName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {i.color} · {i.size}
                  </p>
                </div>
                <Badge variant="destructive">{i.quantity} left</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="">
          <CardHeader>
            <CardTitle className="text-base">Upcoming Content</CardTitle>
            <CardDescription>Next pieces due</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {content.slice(0, 5).map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{c.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.platform} · {c.deadline}
                  </p>
                </div>
                <Badge variant="outline" className="ml-2 shrink-0">
                  {c.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="">
          <CardHeader>
            <CardTitle className="text-base">Upcoming Events</CardTitle>
            <CardDescription>One Goal regional dates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {events.slice(0, 5).map((e) => (
              <div
                key={e.id}
                className="flex items-start justify-between text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{e.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.venue} · {e.date}
                  </p>
                </div>
                <Badge variant="outline">{e.participants}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="">
          <CardHeader>
            <CardTitle className="text-base">
              Creator Collaboration Updates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {creators.slice(0, 4).map((c) => (
              <div key={c.id} className="flex items-center gap-3 text-sm">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {c.name
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{c.name}</p>
                  {c.username ? (
                    <a
                      href={creatorProfileUrl(c.username, c.platform)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-blue-400 hover:underline inline-flex items-center gap-1 truncate"
                    >
                      <span className="truncate">
                        {creatorHandleLabel(c.username, c.platform)}
                      </span>
                      <span className="text-muted-foreground">
                        · {(c.followers / 1000).toFixed(0)}K · {c.platform}
                      </span>
                    </a>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {(c.followers / 1000).toFixed(0)}K · {c.platform}
                    </p>
                  )}
                </div>
                <Badge variant="outline">{c.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="">
          <CardHeader>
            <CardTitle className="text-base">
              School Partnership Updates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {schools.slice(0, 4).map((s) => (
              <div key={s.id} className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                  <School className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.city} · {fmtShort(s.value)}
                  </p>
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
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-xl bg-card border animate-pulse"
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 h-72 rounded-xl bg-card border animate-pulse" />
        <div className="h-72 rounded-xl bg-card border animate-pulse" />
      </div>
    </div>
  );
}

// =========== PRODUCTS ===========
const PRODUCT_CATEGORIES = [
  "Two-In-One Shorts",
  "Compression Pants",
  "Jerseys",
  "Jackets",
  "Accessories",
];
const PRODUCT_STATUS = ["Active", "Draft", "Archived"];

function ProductsModule() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("");
  const [category, setCategory] = useState("all");
  const [viewMode, setViewMode] = useState("card");

  const load = async () => {
    setLoading(true);
    setItems(await api.get("products"));
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const empty = {
    name: "",
    sku: "",
    category: "Two-In-One Shorts",
    brand: "OneClaw",
    status: "Active",
    costPrice: 0,
    sellingPrice: 0,
    description: "",
    tags: [],
    colors: ["Black"],
    sizes: ["M", "L", "XL"],
    notes: "",
    imageUrl: "",
  };

  const save = async (data) => {
    if (editing?.id) {
      const updated = await api.put("products/" + editing.id, data);
      setItems((arr) => [updated, ...arr.filter((p) => p.id !== editing.id)]);
      toast.success("Product updated");
    } else {
      const created = await api.post("products", data);
      setItems((arr) => [created, ...arr]);
      toast.success("Product created");
    }
    setOpen(false);
    setEditing(null);
  };
  const del = async (id) => {
    await api.del("products/" + id);
    toast.success("Product deleted");
    load();
  };
  const duplicate = async (p) => {
    const { id, ...rest } = p;
    await api.post("products", {
      ...rest,
      name: rest.name + " (Copy)",
      sku: rest.sku + "-COPY",
    });
    toast.success("Duplicated");
    load();
  };
  const archive = async (p) => {
    await api.put("products/" + p.id, { ...p, status: "Archived" });
    toast.success("Archived");
    load();
  };

  const filtered = items.filter(
    (p) =>
      (category === "all" || p.category === category) &&
      (!filter ||
        p.name.toLowerCase().includes(filter.toLowerCase()) ||
        p.sku.toLowerCase().includes(filter.toLowerCase())),
  );

  if (loading)
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-48 bg-muted/60 rounded animate-pulse mb-1" />
          <div className="h-4 w-64 bg-muted/40 rounded animate-pulse" />
        </div>
        <ProductGridSkeleton count={8} />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">
            Product Catalog
          </h2>
          <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">
            Manage all ONEMISSION products
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" /> New product
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            className="pl-9"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {PRODUCT_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1 border border-border rounded-lg p-1 shrink-0">
          <Button
            variant={viewMode === "card" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewMode("card")}
            title="Card View"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "table" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewMode("table")}
            title="Table View"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {viewMode === "card" ? (
        filtered.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            <Package className="h-8 w-8 mx-auto mb-3 opacity-50" />
            No products found
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((p) => {
              const margin = p.sellingPrice
                ? (
                    ((p.sellingPrice - p.costPrice) / p.sellingPrice) *
                    100
                  ).toFixed(0)
                : 0;
              return (
                <Card
                  key={p.id}
                  className="overflow-hidden flex flex-col transition-colors"
                >
                  <div className="relative aspect-[4/3] h-80 bg-white/85 shrink-0">
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          e.target.style.display = "none";
                          e.target.nextSibling.style.display = "flex";
                        }}
                      />
                    ) : null}
                    <div
                      className={`absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground ${p.imageUrl ? "hidden" : "flex"}`}
                    >
                      <ImageOff className="h-8 w-8 opacity-40" />
                      <span className="text-xs opacity-60">No image</span>
                    </div>
                    <div className="absolute top-2 right-2">
                      <Badge
                        variant={
                          p.status === "Active"
                            ? "default"
                            : p.status === "Draft"
                              ? "secondary"
                              : "outline"
                        }
                        className="font-normal text-xs"
                      >
                        {p.status}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="p-4 flex flex-col flex-1 gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold leading-tight truncate">
                          {p.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {p.brand}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 -mr-1 -mt-0.5"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(p);
                              setOpen(true);
                            }}
                          >
                            <Edit3 className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicate(p)}>
                            <Copy className="h-4 w-4 mr-2" /> Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => archive(p)}>
                            <Archive className="h-4 w-4 mr-2" /> Archive
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => del(p.id)}
                            className="text-rose-400 focus:text-rose-400"
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="font-normal text-xs">
                        {p.category}
                      </Badge>
                      <span className="font-mono text-xs text-muted-foreground">
                        {p.sku}
                      </span>
                    </div>
                    {p.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {p.description}
                      </p>
                    )}
                    <div className="mt-auto pt-3 border-t grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Cost</p>
                        <p className="font-medium mt-0.5">
                          {fmtShort(p.costPrice)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Selling</p>
                        <p className="font-medium mt-0.5">
                          {fmtShort(p.sellingPrice)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Margin</p>
                        <p
                          className={`font-medium mt-0.5 ${margin >= 60 ? "text-emerald-400" : margin >= 40 ? "text-amber-400" : "text-rose-400"}`}
                        >
                          {margin}%
                        </p>
                      </div>
                    </div>
                    {(p.colors?.length > 0 || p.sizes?.length > 0) && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {p.colors?.slice(0, 3).map((c) => (
                          <span
                            key={c}
                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                          >
                            {c}
                          </span>
                        ))}
                        {p.sizes?.slice(0, 4).map((s) => (
                          <span
                            key={s}
                            className="text-[10px] px-1.5 py-0.5 rounded-full border border-border text-muted-foreground"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      ) : (
        <Card className="">
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
                {filtered.map((p) => {
                  const margin = p.sellingPrice
                    ? (
                        ((p.sellingPrice - p.costPrice) / p.sellingPrice) *
                        100
                      ).toFixed(0)
                    : 0;
                  return (
                    <tr
                      key={p.id}
                      className="border-b hover:bg-secondary/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              className="w-9 h-9 rounded-lg object-cover shrink-0"
                              onError={(e) => {
                                e.target.style.display = "none";
                                e.target.nextSibling.style.display = "flex";
                              }}
                            />
                          ) : null}
                          <div
                            className={`w-9 h-9 rounded-lg bg-gradient-to-br from-secondary to-accent items-center justify-center text-xs font-medium shrink-0 ${p.imageUrl ? "hidden" : "flex"}`}
                          >
                            {p.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {p.brand}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {p.sku}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="font-normal">
                          {p.category}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            p.status === "Active"
                              ? "default"
                              : p.status === "Draft"
                                ? "secondary"
                                : "outline"
                          }
                          className="font-normal"
                        >
                          {p.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {fmt(p.costPrice)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {fmt(p.sellingPrice)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`text-xs font-medium ${margin >= 60 ? "text-emerald-400" : margin >= 40 ? "text-amber-400" : "text-rose-400"}`}
                        >
                          {margin}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditing(p);
                                setOpen(true);
                              }}
                            >
                              <Edit3 className="h-4 w-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => duplicate(p)}>
                              <Copy className="h-4 w-4 mr-2" /> Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => archive(p)}>
                              <Archive className="h-4 w-4 mr-2" /> Archive
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => del(p.id)}
                              className="text-rose-400 focus:text-rose-400"
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="p-12 text-center text-muted-foreground"
                    >
                      <Package className="h-8 w-8 mx-auto mb-3 opacity-50" />
                      No products found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ProductModal
        open={open}
        onOpenChange={setOpen}
        initial={editing || empty}
        onSave={save}
      />
    </div>
  );
}

function ProductModal({ open, onOpenChange, initial, onSave }) {
  const [form, setForm] = useState(initial);
  useEffect(() => {
    setForm(initial);
  }, [initial, open]);
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {initial?.id ? "Edit product" : "New product"}
          </DialogTitle>
          <DialogDescription>
            Define product details for the catalog
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto scrollbar-thin pr-2">
          <div className="col-span-2 space-y-2">
            <Label>Product name</Label>
            <Input
              value={form.name || ""}
              onChange={(e) => update("name", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>SKU</Label>
            <Input
              value={form.sku || ""}
              onChange={(e) => update("sku", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Brand</Label>
            <Input
              value={form.brand || ""}
              onChange={(e) => update("brand", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={form.category}
              onValueChange={(v) => update("category", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => update("status", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_STATUS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Cost Price (IDR)</Label>
            <NumberInput
              value={form.costPrice || 0}
              onChange={(v) => update("costPrice", v)}
            />
          </div>
          <div className="space-y-2">
            <Label>Selling Price (IDR)</Label>
            <NumberInput
              value={form.sellingPrice || 0}
              onChange={(v) => update("sellingPrice", v)}
            />
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Description</Label>
            <Textarea
              value={form.description || ""}
              onChange={(e) => update("description", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Colors (comma)</Label>
            <Input
              value={(form.colors || []).join(", ")}
              onChange={(e) =>
                update(
                  "colors",
                  e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Sizes (comma)</Label>
            <Input
              value={(form.sizes || []).join(", ")}
              onChange={(e) =>
                update(
                  "sizes",
                  e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
            />
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Tags (comma)</Label>
            <Input
              value={(form.tags || []).join(", ")}
              onChange={(e) =>
                update(
                  "tags",
                  e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
            />
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Photo URL (optional)</Label>
            <Input
              value={form.imageUrl || ""}
              onChange={(e) => update("imageUrl", e.target.value)}
              placeholder="https://..."
            />
            {form.imageUrl && (
              <img
                src={form.imageUrl}
                alt="Preview"
                className="w-full max-h-36 object-cover rounded-md border mt-2"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            )}
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes || ""}
              onChange={(e) => update("notes", e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSave(form)}>
            {initial?.id ? "Save changes" : "Create product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =========== INVENTORY ===========
function InventoryModule() {
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState("all");
  useEffect(() => {
    (async () => {
      setLoading(true);
      // Silently repair any products that are missing inventory rows
      await api.post("products/repair-inventory", {}).catch(() => {});
      setItems(await api.get("inventory"));
      setProducts(await api.get("products"));
      setLoading(false);
    })();
  }, []);

  const adjust = async (item, delta) => {
    const updated = { ...item, quantity: Math.max(0, item.quantity + delta) };
    await api.put("inventory/" + item.id, updated);
    setItems((arr) => arr.map((i) => (i.id === item.id ? updated : i)));
  };

  const [editQty, setEditQty] = useState({});

  const setStock = async (item, newQty) => {
    const qty = Math.max(0, Math.floor(Number(newQty)));
    if (isNaN(qty)) return;
    const updated = { ...item, quantity: qty };
    await api.put("inventory/" + item.id, updated);
    setItems((arr) => arr.map((i) => (i.id === item.id ? updated : i)));
    toast.success("Stock updated");
  };

  const createItem = async (productId, color, size) => {
    const created = await api.post("inventory", {
      productId,
      color,
      size,
      quantity: 0,
      threshold: 5,
      incoming: 0,
    });
    setItems((arr) => [...arr, created]);
    toast.success(`${color} / ${size} initialized`);
  };

  const filtered =
    selectedProduct === "all"
      ? items
      : items.filter((i) => i.productId === selectedProduct);
  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach((i) => {
      if (!map[i.productId]) map[i.productId] = {};
      if (!map[i.productId][i.color]) map[i.productId][i.color] = {};
      map[i.productId][i.color][i.size] = i;
    });
    return map;
  }, [filtered]);

  const totalStock = filtered.reduce((s, i) => s + i.quantity, 0);
  const critical = filtered.filter((i) => i.quantity <= 5);

  const colorSwatch = {
    Black: "#0a0a0a",
    "Dark Grey": "#3f3f46",
    Navy: "#1e3a8a",
    White: "#fafafa",
    Olive: "#65733b",
    Burgundy: "#7a1f30",
  };

  if (loading)
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-32 bg-muted/60 rounded animate-pulse mb-1" />
          <div className="h-4 w-56 bg-muted/40 rounded animate-pulse" />
        </div>
        <InventorySkeleton />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">
            Inventory
          </h2>
          <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">
            Real-time stock by product, color, and size
          </p>
        </div>
        <Select value={selectedProduct} onValueChange={setSelectedProduct}>
          <SelectTrigger className="w-[260px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All products</SelectItem>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Total Units
            </p>
            <p className="text-2xl font-semibold mt-2">
              {totalStock.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className="">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              SKUs
            </p>
            <p className="text-2xl font-semibold mt-2">{filtered.length}</p>
          </CardContent>
        </Card>
        <Card className="">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider text-rose-400">
              Critical
            </p>
            <p className="text-2xl font-semibold mt-2 text-rose-400">
              {critical.length}
            </p>
          </CardContent>
        </Card>
        <Card className="">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Incoming
            </p>
            <p className="text-2xl font-semibold mt-2">
              {filtered.reduce((s, i) => s + (i.incoming || 0), 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {Object.entries(grouped).map(([pid, colors]) => {
          const product = products.find((p) => p.id === pid);
          if (!product) return null;
          return (
            <Card key={pid} className="">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{product.name}</CardTitle>
                    <CardDescription>
                      {product.sku} · {product.category}
                    </CardDescription>
                  </div>
                  <Badge variant="outline">
                    {Object.values(colors).reduce(
                      (s, sz) =>
                        s +
                        Object.values(sz).reduce((a, b) => a + b.quantity, 0),
                      0,
                    )}{" "}
                    units
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(product.colors?.length
                    ? product.colors
                    : Object.keys(colors)
                  ).map((color) => {
                    const sizeMap = colors[color] || {};
                    const catalogSizes = product.sizes?.length
                      ? product.sizes
                      : Object.keys(sizeMap);
                    return (
                      <div key={color}>
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className="w-3 h-3 rounded-full border border-border"
                            style={{ background: colorSwatch[color] || "#999" }}
                          />
                          <p className="text-sm font-medium">{color}</p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                          {catalogSizes.map((size) => {
                            const item = sizeMap[size];
                            if (!item) {
                              return (
                                <div
                                  key={size}
                                  className="rounded-lg border border-dashed border-border/30 bg-secondary/10 p-3"
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-muted-foreground font-medium">
                                      {size}
                                    </span>
                                  </div>
                                  <p className="text-xl font-semibold text-muted-foreground/30">
                                    —
                                  </p>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-full text-[10px] mt-2"
                                    onClick={() => createItem(pid, color, size)}
                                  >
                                    + Init
                                  </Button>
                                </div>
                              );
                            }
                            const crit = item.quantity <= 5;
                            return (
                              <div
                                key={size}
                                className={`rounded-lg border p-3 ${crit ? "border-rose-500/40 bg-rose-500/5" : "border-border bg-secondary/30"}`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-muted-foreground font-medium">
                                    {size}
                                  </span>
                                  {crit && (
                                    <AlertTriangle className="h-3 w-3 text-rose-400" />
                                  )}
                                </div>
                                <p
                                  className={`text-xl font-semibold ${crit ? "text-rose-400" : ""}`}
                                >
                                  {item.quantity}
                                </p>
                                <div className="flex gap-1 mt-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 text-xs"
                                    onClick={() => adjust(item, -1)}
                                  >
                                    -
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 text-xs"
                                    onClick={() => adjust(item, 1)}
                                  >
                                    +
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 flex-1 px-1 text-[10px]"
                                    onClick={() => adjust(item, 10)}
                                  >
                                    +10
                                  </Button>
                                </div>
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="Set qty…"
                                  value={editQty[item.id] ?? ""}
                                  onChange={(e) =>
                                    setEditQty((prev) => ({
                                      ...prev,
                                      [item.id]: e.target.value,
                                    }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      const val = parseInt(
                                        editQty[item.id],
                                        10,
                                      );
                                      if (!isNaN(val) && val >= 0)
                                        setStock(item, val);
                                      setEditQty((prev) => {
                                        const n = { ...prev };
                                        delete n[item.id];
                                        return n;
                                      });
                                    }
                                    if (e.key === "Escape") {
                                      setEditQty((prev) => {
                                        const n = { ...prev };
                                        delete n[item.id];
                                        return n;
                                      });
                                    }
                                  }}
                                  onBlur={() => {
                                    if (
                                      editQty[item.id] !== undefined &&
                                      editQty[item.id] !== ""
                                    ) {
                                      const val = parseInt(
                                        editQty[item.id],
                                        10,
                                      );
                                      if (!isNaN(val) && val >= 0)
                                        setStock(item, val);
                                    }
                                    setEditQty((prev) => {
                                      const n = { ...prev };
                                      delete n[item.id];
                                      return n;
                                    });
                                  }}
                                  className="mt-1.5 h-7 text-xs text-center px-2"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// =========== STOCK MOVEMENTS ===========
const MOVEMENT_TYPES = [
  {
    value: "MANUAL_IN",
    label: "Manual In",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 text-emerald-400",
  },
  {
    value: "MANUAL_OUT",
    label: "Manual Out",
    color: "text-rose-400",
    bg: "bg-rose-500/10 text-rose-400",
  },
  {
    value: "ADJUSTMENT_IN",
    label: "Adjustment In",
    color: "text-blue-400",
    bg: "bg-blue-500/10 text-blue-400",
  },
  {
    value: "ADJUSTMENT_OUT",
    label: "Adjustment Out",
    color: "text-orange-400",
    bg: "bg-orange-500/10 text-orange-400",
  },
  {
    value: "OPENING",
    label: "Opening Stock",
    color: "text-purple-400",
    bg: "bg-purple-500/10 text-purple-400",
  },
];

function movementTypeMeta(type) {
  return (
    MOVEMENT_TYPES.find((t) => t.value === type) || {
      label: type,
      bg: "bg-muted text-muted-foreground",
    }
  );
}

function isInboundType(type) {
  return ["MANUAL_IN", "ADJUSTMENT_IN", "OPENING"].includes(type);
}

function StockMovementAdjustDialog({
  open,
  onOpenChange,
  inventory,
  products,
  rawMaterials,
  onSave,
}) {
  const makeEmpty = () => ({
    itemType: "PRODUCT",
    inventoryId: "",
    rawMaterialId: "",
    movementType: "MANUAL_IN",
    quantity: "",
    notes: "",
    referenceNumber: "",
    movementDate: new Date().toISOString().split("T")[0],
  });
  const [form, setForm] = useState(makeEmpty());
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const invItem =
    form.itemType === "PRODUCT"
      ? inventory.find((i) => i.id === form.inventoryId)
      : null;
  const rawMat =
    form.itemType === "RAW_MATERIAL"
      ? rawMaterials.find((r) => r.id === form.rawMaterialId)
      : null;
  const currentStock =
    form.itemType === "PRODUCT" ? invItem?.quantity : rawMat?.currentStock;

  const handleOpen = (val) => {
    if (val) {
      setForm(makeEmpty());
      setErrors({});
    }
    onOpenChange(val);
  };

  const validate = () => {
    const e = {};
    if (form.itemType === "PRODUCT" && !form.inventoryId)
      e.inventoryId = "Select a stock item";
    if (form.itemType === "RAW_MATERIAL" && !form.rawMaterialId)
      e.rawMaterialId = "Select a raw material";
    if (!form.movementType) e.movementType = "Select movement type";
    const qty = Number(form.quantity);
    if (!form.quantity || isNaN(qty) || qty <= 0)
      e.quantity = "Enter a positive quantity";
    if (!form.movementDate) e.movementDate = "Select a date";
    return e;
  };

  const submit = async () => {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setLoading(true);
    try {
      const body = {
        movementType: form.movementType,
        quantity: Number(form.quantity),
        notes: form.notes,
        referenceNumber: form.referenceNumber,
        movementDate: form.movementDate,
      };
      if (form.itemType === "RAW_MATERIAL") {
        body.rawMaterialId = form.rawMaterialId;
      } else {
        body.inventoryId = form.inventoryId;
      }
      await api.post("stockmovements", body);
      toast.success("Stock movement recorded");
      onSave();
      handleOpen(false);
    } catch (err) {
      toast.error(err.message || "Failed to record movement");
    } finally {
      setLoading(false);
    }
  };

  const set = (k, v) => {
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === "itemType") {
        next.inventoryId = "";
        next.rawMaterialId = "";
      }
      return next;
    });
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manual Stock Adjustment</DialogTitle>
          <DialogDescription>
            Record a manual inbound or outbound stock movement for products or
            raw materials.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Item Type selector */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Item Type</label>
            <Select
              value={form.itemType}
              onValueChange={(v) => set("itemType", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PRODUCT">Product (Inventory)</SelectItem>
                <SelectItem value="RAW_MATERIAL">Raw Material</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Product stock item selector */}
          {form.itemType === "PRODUCT" && (
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Stock Item (Product · Color · Size)
              </label>
              <Select
                value={form.inventoryId}
                onValueChange={(v) => set("inventoryId", v)}
              >
                <SelectTrigger
                  className={errors.inventoryId ? "border-red-500" : ""}
                >
                  <SelectValue placeholder="Select stock item…" />
                </SelectTrigger>
                <SelectContent>
                  {inventory.map((inv) => {
                    const p = products.find((pr) => pr.id === inv.productId);
                    return (
                      <SelectItem key={inv.id} value={inv.id}>
                        {p ? p.name : inv.productId} · {inv.color} · {inv.size}{" "}
                        (stock: {inv.quantity})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {errors.inventoryId && (
                <p className="text-xs text-red-500">{errors.inventoryId}</p>
              )}
            </div>
          )}

          {/* Raw Material selector */}
          {form.itemType === "RAW_MATERIAL" && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Raw Material</label>
              <Select
                value={form.rawMaterialId}
                onValueChange={(v) => set("rawMaterialId", v)}
              >
                <SelectTrigger
                  className={errors.rawMaterialId ? "border-red-500" : ""}
                >
                  <SelectValue placeholder="Select raw material…" />
                </SelectTrigger>
                <SelectContent>
                  {rawMaterials.map((rm) => (
                    <SelectItem key={rm.id} value={rm.id}>
                      {rm.name}
                      {rm.category ? ` · ${rm.category}` : ""} (stock:{" "}
                      {rm.currentStock || 0}
                      {rm.unit ? " " + rm.unit : ""})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.rawMaterialId && (
                <p className="text-xs text-red-500">{errors.rawMaterialId}</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Movement Type</label>
              <Select
                value={form.movementType}
                onValueChange={(v) => set("movementType", v)}
              >
                <SelectTrigger
                  className={errors.movementType ? "border-red-500" : ""}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOVEMENT_TYPES.filter(
                    (t) =>
                      t.value !== "ADJUSTMENT_IN" &&
                      t.value !== "ADJUSTMENT_OUT",
                  ).map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.movementType && (
                <p className="text-xs text-red-500">{errors.movementType}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Quantity</label>
              <Input
                type="number"
                min="0.001"
                step="any"
                placeholder="0"
                value={form.quantity}
                onChange={(e) => set("quantity", e.target.value)}
                className={errors.quantity ? "border-red-500" : ""}
              />
              {errors.quantity && (
                <p className="text-xs text-red-500">{errors.quantity}</p>
              )}
              {currentStock !== undefined && currentStock !== null && (
                <p className="text-xs text-muted-foreground">
                  Current stock: {currentStock}
                  {!isInboundType(form.movementType) && form.quantity && (
                    <span
                      className={
                        Number(form.quantity) > currentStock
                          ? " text-red-400"
                          : " text-emerald-400"
                      }
                    >
                      {" → "}
                      {Math.max(0, currentStock - Number(form.quantity))}
                    </span>
                  )}
                  {isInboundType(form.movementType) && form.quantity && (
                    <span className=" text-emerald-400">
                      {" "}
                      →{" "}
                      {Number(
                        (currentStock + Number(form.quantity)).toFixed(4),
                      )}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Date</label>
              <Input
                type="date"
                value={form.movementDate}
                onChange={(e) => set("movementDate", e.target.value)}
                className={errors.movementDate ? "border-red-500" : ""}
              />
              {errors.movementDate && (
                <p className="text-xs text-red-500">{errors.movementDate}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Reference No. (optional)
              </label>
              <Input
                placeholder="Auto-generated if blank"
                value={form.referenceNumber}
                onChange={(e) => set("referenceNumber", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Notes (optional)</label>
            <Input
              placeholder="Reason for adjustment…"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={loading}>
            {loading ? "Saving…" : "Record Movement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StockMovementsModule() {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const today = now.toISOString().split("T")[0];

  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [itemTypeFilter, setItemTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);
  const [showAdjust, setShowAdjust] = useState(false);

  const buildParams = () => {
    const p = new URLSearchParams();
    if (search) p.append("search", search);
    if (typeFilter !== "all") p.append("type", typeFilter);
    if (itemTypeFilter !== "all") p.append("itemType", itemTypeFilter);
    if (dateFrom) p.append("from", dateFrom);
    if (dateTo) p.append("to", dateTo);
    return p.toString();
  };

  const load = async () => {
    setLoading(true);
    const qs = buildParams();
    const [data, statsData, prods, inv, rms] = await Promise.all([
      api.get("stockmovements" + (qs ? "?" + qs : "")),
      api.get("stockmovements/stats" + (qs ? "?" + qs : "")),
      api.get("products"),
      api.get("inventory"),
      api.get("rawmaterials"),
    ]);
    setItems(Array.isArray(data) ? data : []);
    setStats(statsData && !statsData.error ? statsData : null);
    setProducts(Array.isArray(prods) ? prods : []);
    setInventory(Array.isArray(inv) ? inv : []);
    setRawMaterials(Array.isArray(rms) ? rms : []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [search, typeFilter, itemTypeFilter, dateFrom, dateTo]);

  const netChange = stats ? stats.totalIn - stats.totalOut : 0;

  const fmtQty = (n) =>
    Number(n || 0).toLocaleString("id-ID", { maximumFractionDigits: 4 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">
            Stock Movement Ledger
          </h2>
          <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">
            Unified immutable record of all product and raw material movements
          </p>
        </div>
        <Button onClick={() => setShowAdjust(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Manual Adjustment
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Total Movements
            </p>
            <p className="text-2xl font-semibold mt-1">
              {loading ? "—" : (stats?.totalMovements ?? 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Product Movements
            </p>
            <p className="text-2xl font-semibold mt-1 text-blue-500">
              {loading ? "—" : (stats?.productMovements ?? 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Raw Material Movements
            </p>
            <p className="text-2xl font-semibold mt-1 text-purple-500">
              {loading
                ? "—"
                : (stats?.rawMaterialMovements ?? 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider text-emerald-500">
              Inbound
            </p>
            <p className="text-2xl font-semibold mt-1 text-emerald-500">
              {loading ? "—" : "+" + fmtQty(stats?.totalIn)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider text-rose-400">
              Outbound
            </p>
            <p className="text-2xl font-semibold mt-1 text-rose-400">
              {loading ? "—" : "−" + fmtQty(stats?.totalOut)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Net Change
            </p>
            <p
              className={`text-2xl font-semibold mt-1 ${netChange >= 0 ? "text-emerald-500" : "text-rose-400"}`}
            >
              {loading ? "—" : (netChange >= 0 ? "+" : "") + fmtQty(netChange)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[180px]">
              <p className="text-xs text-muted-foreground mb-1">
                Search item / SKU / reference
              </p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="min-w-[160px]">
              <p className="text-xs text-muted-foreground mb-1">Item Type</p>
              <Select value={itemTypeFilter} onValueChange={setItemTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Items</SelectItem>
                  <SelectItem value="PRODUCT">Product</SelectItem>
                  <SelectItem value="RAW_MATERIAL">Raw Material</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[170px]">
              <p className="text-xs text-muted-foreground mb-1">
                Movement Type
              </p>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {MOVEMENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Date From</p>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-36"
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Date To</p>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-36"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={load}
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ledger Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Loading movements…
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <Activity className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                No stock movements found
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Movements are recorded automatically when inventory is adjusted,
                or manually via the button above.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[rgba(17,24,39,0.04)]">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Date
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Reference
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Item Type
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Item Name
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Variant / Detail
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Movement Type
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Qty
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Before
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      After
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((m, idx) => {
                    const meta = movementTypeMeta(m.movementType);
                    const inbound = isInboundType(m.movementType);
                    const isProduct = (m.itemType || "PRODUCT") === "PRODUCT";
                    return (
                      <tr
                        key={m.id}
                        className={`border-b border-border/30 hover:bg-[#F7F8FA]/80 transition-colors ${idx % 2 === 0 ? "" : "bg-muted/10"}`}
                      >
                        <td className="px-4 py-3 text-muted-foreground">
                          {m.movementDate}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {m.referenceNumber || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${isProduct ? "bg-blue-500/10 text-blue-500" : "bg-purple-500/10 text-purple-500"}`}
                          >
                            {isProduct ? "PRODUCT" : "RAW MAT"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {isProduct ? (
                            <>
                              <p className="font-medium leading-none">
                                {m.product?.name || "—"}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {m.product?.sku}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="font-medium leading-none">
                                {m.rawMaterial?.name || "—"}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {m.rawMaterial?.category || ""}
                              </p>
                            </>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {isProduct
                            ? m.inventory
                              ? `${m.inventory.color} / ${m.inventory.size}`
                              : "—"
                            : m.rawMaterial?.unit || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${meta.bg}`}
                          >
                            {meta.label}
                          </span>
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-semibold tabular-nums ${inbound ? "text-emerald-400" : "text-rose-400"}`}
                        >
                          {inbound ? "+" : "−"}
                          {fmtQty(m.quantity)}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                          {fmtQty(m.previousQuantity)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">
                          {fmtQty(m.newQuantity)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs max-w-[200px] truncate">
                          {m.notes || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <StockMovementAdjustDialog
        open={showAdjust}
        onOpenChange={setShowAdjust}
        inventory={inventory}
        products={products}
        rawMaterials={rawMaterials}
        onSave={load}
      />
    </div>
  );
}

// =========== PLANNING ===========
const PLAN_LEVELS = ["Monthly", "Quarterly", "Six-Month", "Annual"];
const PLAN_STATUS = ["Planned", "In Progress", "At Risk", "Completed"];

function PlanningModule() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [level, setLevel] = useState("all");
  const load = async () => {
    setLoading(true);
    setItems(await api.get("plans"));
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const empty = {
    level: "Quarterly",
    title: "",
    objective: "",
    progress: 0,
    status: "Planned",
    owner: "",
    dueDate: "",
    notes: "",
    keyResults: [],
    actionItems: [],
  };
  const save = async (data) => {
    if (editing?.id) await api.put("plans/" + editing.id, data);
    else await api.post("plans", data);
    setOpen(false);
    setEditing(null);
    load();
    toast.success("Saved");
  };
  const del = async (id) => {
    await api.del("plans/" + id);
    load();
    toast.success("Deleted");
  };

  const filtered =
    level === "all" ? items : items.filter((p) => p.level === level);

  if (loading)
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-48 bg-muted/60 rounded animate-pulse mb-1" />
          <div className="h-4 w-64 bg-muted/40 rounded animate-pulse" />
        </div>
        <CardSkeleton
          count={6}
          cols="grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
        />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">
            Strategic Planning
          </h2>
          <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">
            Objectives, Key Results, and Action Items
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" /> New plan
        </Button>
      </div>

      <Tabs value={level} onValueChange={setLevel}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          {PLAN_LEVELS.map((l) => (
            <TabsTrigger key={l} value={l}>
              {l}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map((p) => (
          <Card key={p.id} className="hover:border-border transition-colors">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">
                      {p.level}
                    </Badge>
                    <Badge
                      variant={
                        p.status === "Completed"
                          ? "default"
                          : p.status === "At Risk"
                            ? "destructive"
                            : "secondary"
                      }
                      className="text-xs"
                    >
                      {p.status}
                    </Badge>
                  </div>
                  <CardTitle className="text-base leading-tight">
                    {p.title}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {p.objective}
                  </CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setEditing(p);
                        setOpen(true);
                      }}
                    >
                      <Edit3 className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => del(p.id)}
                      className="text-rose-400"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{p.progress}%</span>
                </div>
                <Progress value={p.progress} className="h-1.5" />
              </div>
              {p.keyResults?.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                    Key Results
                  </p>
                  <ul className="space-y-1.5 text-sm">
                    {p.keyResults.map((k, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                        <span>{k}</span>
                      </li>
                    ))}
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

      <PlanModal
        open={open}
        onOpenChange={setOpen}
        initial={editing || empty}
        onSave={save}
      />
    </div>
  );
}

function PlanModal({ open, onOpenChange, initial, onSave }) {
  const [form, setForm] = useState(initial);
  useEffect(() => setForm(initial), [initial, open]);
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Edit plan" : "New plan"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin pr-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Level</Label>
              <Select
                value={form.level}
                onValueChange={(v) => update("level", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => update("status", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_STATUS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={form.title || ""}
              onChange={(e) => update("title", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Objective</Label>
            <Textarea
              value={form.objective || ""}
              onChange={(e) => update("objective", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Owner</Label>
              <Input
                value={form.owner || ""}
                onChange={(e) => update("owner", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Due date</Label>
              <Input
                type="date"
                value={form.dueDate || ""}
                onChange={(e) => update("dueDate", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Progress %</Label>
            <NumberInput
              max={100}
              value={form.progress || 0}
              onChange={(v) => update("progress", v)}
            />
          </div>
          <div className="space-y-2">
            <Label>Key Results (one per line)</Label>
            <Textarea
              value={(form.keyResults || []).join("\n")}
              onChange={(e) =>
                update("keyResults", e.target.value.split("\n").filter(Boolean))
              }
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Action Items (one per line)</Label>
            <Textarea
              value={(form.actionItems || []).join("\n")}
              onChange={(e) =>
                update(
                  "actionItems",
                  e.target.value.split("\n").filter(Boolean),
                )
              }
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSave(form)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =========== CONTENT PLANNER ===========
const CONTENT_STATUS = [
  "Idea",
  "Draft",
  "Shooting",
  "Editing",
  "Scheduled",
  "Published",
];
const PLATFORMS = ["Instagram", "TikTok", "YouTube", "Threads"];

function ContentModule() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [view, setView] = useState("kanban");
  const load = async () => {
    setLoading(true);
    setItems(await api.get("content"));
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const empty = {
    title: "",
    platform: "Instagram",
    format: "Reel",
    caption: "",
    objective: "",
    cta: "",
    owner: "",
    deadline: "",
    status: "Idea",
  };
  const save = async (data) => {
    if (editing?.id) await api.put("content/" + editing.id, data);
    else await api.post("content", data);
    setOpen(false);
    setEditing(null);
    load();
    toast.success("Saved");
  };
  const del = async (id) => {
    await api.del("content/" + id);
    load();
    toast.success("Deleted");
  };
  const moveStatus = async (item, status) => {
    await api.put("content/" + item.id, { ...item, status });
    setItems((arr) =>
      arr.map((i) => (i.id === item.id ? { ...i, status } : i)),
    );
  };

  if (loading)
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-44 bg-muted/60 rounded animate-pulse mb-1" />
          <div className="h-4 w-56 bg-muted/40 rounded animate-pulse" />
        </div>
        <KanbanSkeleton columns={4} />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">
            Content Planner
          </h2>
          <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">
            Manage all content across platforms
          </p>
        </div>
        <div className="flex gap-3">
          <Tabs value={view} onValueChange={setView}>
            <TabsList>
              <TabsTrigger value="kanban">Kanban</TabsTrigger>
              <TabsTrigger value="list">List</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" /> New content
          </Button>
        </div>
      </div>

      {view === "kanban" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {CONTENT_STATUS.map((s) => {
            const col = items.filter((i) => i.status === s);
            return (
              <div key={s} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {s}
                  </p>
                  <Badge variant="outline" className="text-xs">
                    {col.length}
                  </Badge>
                </div>
                <div className="space-y-2 min-h-[200px]">
                  {col.map((item) => (
                    <Card
                      key={item.id}
                      className="cursor-pointer"
                      onClick={() => {
                        setEditing(item);
                        setOpen(true);
                      }}
                    >
                      <CardContent className="p-3 space-y-2">
                        <Badge
                          variant="outline"
                          className="text-[10px] font-normal"
                        >
                          {item.platform}
                        </Badge>
                        <p className="text-sm font-medium leading-tight">
                          {item.title}
                        </p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{item.owner?.split(" ")[0]}</span>
                          <span>{item.deadline?.slice(5)}</span>
                        </div>
                        <Select
                          value={item.status}
                          onValueChange={(v) => moveStatus(item, v)}
                        >
                          <SelectTrigger
                            className="h-7 text-xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CONTENT_STATUS.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
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
        <Card className="">
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
              {items.map((c) => (
                <tr key={c.id} className="border-b hover:bg-secondary/30">
                  <td className="px-4 py-3 font-medium">{c.title}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{c.platform}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.format}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.owner}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.deadline}
                  </td>
                  <td className="px-4 py-3">
                    <Badge>{c.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditing(c);
                            setOpen(true);
                          }}
                        >
                          <Edit3 className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => del(c.id)}
                          className="text-rose-400"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <ContentModal
        open={open}
        onOpenChange={setOpen}
        initial={editing || empty}
        onSave={save}
      />
    </div>
  );
}

function ContentModal({ open, onOpenChange, initial, onSave }) {
  const [form, setForm] = useState(initial);
  useEffect(() => setForm(initial), [initial, open]);
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {initial?.id ? "Edit content" : "New content"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin pr-2">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={form.title || ""}
              onChange={(e) => update("title", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select
                value={form.platform}
                onValueChange={(v) => update("platform", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Format</Label>
              <Input
                value={form.format || ""}
                onChange={(e) => update("format", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Caption</Label>
            <Textarea
              value={form.caption || ""}
              onChange={(e) => update("caption", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Objective</Label>
              <Input
                value={form.objective || ""}
                onChange={(e) => update("objective", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>CTA</Label>
              <Input
                value={form.cta || ""}
                onChange={(e) => update("cta", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Owner</Label>
              <Input
                value={form.owner || ""}
                onChange={(e) => update("owner", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Deadline</Label>
              <Input
                type="date"
                value={form.deadline || ""}
                onChange={(e) => update("deadline", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => update("status", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_STATUS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSave(form)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =========== CREATOR CRM ===========
const CREATOR_STATUS = [
  "Not Contacted",
  "DM Sent",
  "Negotiation",
  "Deal",
  "Completed",
];

function CreatorCRM() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const load = async () => {
    setLoading(true);
    setItems(await api.get("creators"));
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);
  const updateStatus = async (item, status) => {
    await api.put("creators/" + item.id, { ...item, status });
    setItems((arr) =>
      arr.map((i) => (i.id === item.id ? { ...i, status } : i)),
    );
  };

  const empty = {
    name: "",
    username: "",
    platform: "Instagram",
    followers: 0,
    engagement: 0,
    niche: "",
    audienceFit: 80,
    valuesScore: 90,
    contact: "",
    fee: 0,
    status: "Not Contacted",
    notes: "",
  };
  const save = async (data) => {
    if (editing?.id) {
      await api.put("creators/" + editing.id, data);
      toast.success("Creator updated");
    } else {
      await api.post("creators", data);
      toast.success("Creator added");
    }
    setOpen(false);
    setEditing(null);
    load();
  };
  const del = async (id) => {
    await api.del("creators/" + id);
    load();
    toast.success("Creator deleted");
  };

  const filtered =
    status === "all" ? items : items.filter((i) => i.status === status);

  if (loading)
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-36 bg-muted/60 rounded animate-pulse mb-1" />
          <div className="h-4 w-72 bg-muted/40 rounded animate-pulse" />
        </div>
        <CardSkeleton
          count={6}
          cols="grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
        />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">
            Creator CRM
          </h2>
          <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">
            Manage influencer collaborations with Islamic values alignment
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" /> New creator
        </Button>
      </div>
      <Tabs value={status} onValueChange={setStatus}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          {CREATOR_STATUS.map((s) => (
            <TabsTrigger key={s} value={s}>
              {s}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Card className="overflow-x-auto">
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
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-b hover:bg-secondary/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {c.name
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium">{c.name}</p>
                      {c.username ? (
                        <a
                          href={creatorProfileUrl(c.username, c.platform)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-muted-foreground hover:text-blue-400 hover:underline inline-flex items-center gap-1 max-w-[220px] truncate"
                          title={creatorProfileUrl(c.username, c.platform)}
                        >
                          <span className="truncate">
                            {creatorHandleLabel(c.username, c.platform)}
                          </span>
                          <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                        </a>
                      ) : (
                        <p className="text-xs text-muted-foreground">—</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline">{c.platform}</Badge>
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {(c.followers / 1000).toFixed(0)}K
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {c.engagement}%
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {c.niche}
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={`font-medium ${c.valuesScore >= 90 ? "text-emerald-400" : c.valuesScore >= 80 ? "text-amber-400" : "text-rose-400"}`}
                  >
                    {c.valuesScore}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {fmtShort(c.fee)}
                </td>
                <td className="px-4 py-3">
                  <Select
                    value={c.status}
                    onValueChange={(v) => updateStatus(c, v)}
                  >
                    <SelectTrigger className="h-8 text-xs w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CREATOR_STATUS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditing(c);
                          setOpen(true);
                        }}
                      >
                        <Edit3 className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => del(c.id)}
                        className="text-rose-400"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="p-12 text-center text-muted-foreground"
                >
                  <Users2 className="h-8 w-8 mx-auto mb-3 opacity-50" />
                  No creators yet. Click "New creator" to add one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      <CreatorModal
        open={open}
        onOpenChange={setOpen}
        initial={editing || empty}
        onSave={save}
      />
    </div>
  );
}

function CreatorModal({ open, onOpenChange, initial, onSave }) {
  const [form, setForm] = useState(initial);
  useEffect(() => setForm(initial), [initial, open]);
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {initial?.id ? "Edit creator" : "New creator"}
          </DialogTitle>
          <DialogDescription>
            Add a creator or influencer to the CRM
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto scrollbar-thin pr-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={form.name || ""}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Ahmad Fauzan"
            />
          </div>
          <div className="space-y-2">
            <Label>Username</Label>
            <Input
              value={form.username || ""}
              onChange={(e) => update("username", e.target.value)}
              placeholder="@ahmadfauzan"
            />
          </div>
          <div className="space-y-2">
            <Label>Platform</Label>
            <Select
              value={form.platform}
              onValueChange={(v) => update("platform", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => update("status", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CREATOR_STATUS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Followers</Label>
            <NumberInput
              value={form.followers || 0}
              onChange={(v) => update("followers", v)}
            />
          </div>
          <div className="space-y-2">
            <Label>Engagement Rate (%)</Label>
            <NumberInput
              decimal
              value={form.engagement || 0}
              onChange={(v) => update("engagement", v)}
            />
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Niche</Label>
            <Input
              value={form.niche || ""}
              onChange={(e) => update("niche", e.target.value)}
              placeholder="Athletic & Lifestyle"
            />
          </div>
          <div className="space-y-2">
            <Label>Audience Fit (0-100)</Label>
            <NumberInput
              max={100}
              value={form.audienceFit || 0}
              onChange={(v) => update("audienceFit", v)}
            />
          </div>
          <div className="space-y-2">
            <Label>Islamic Values Score (0-100)</Label>
            <NumberInput
              max={100}
              value={form.valuesScore || 0}
              onChange={(v) => update("valuesScore", v)}
            />
          </div>
          <div className="space-y-2">
            <Label>Contact (email/phone)</Label>
            <Input
              value={form.contact || ""}
              onChange={(e) => update("contact", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Estimated Fee (IDR)</Label>
            <NumberInput
              value={form.fee || 0}
              onChange={(v) => update("fee", v)}
            />
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes || ""}
              onChange={(e) => update("notes", e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSave(form)}>
            {initial?.id ? "Save changes" : "Add creator"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =========== SCHOOL CRM ===========
const SCHOOL_STATUS = [
  "Prospect",
  "Contacted",
  "Meeting",
  "Negotiation",
  "Deal",
  "Completed",
];

function SchoolCRM() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const load = async () => {
    setLoading(true);
    setItems(await api.get("schools"));
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);
  const updateStatus = async (item, status) => {
    await api.put("schools/" + item.id, { ...item, status });
    setItems((arr) =>
      arr.map((i) => (i.id === item.id ? { ...i, status } : i)),
    );
  };

  const empty = {
    name: "",
    city: "",
    province: "",
    contactPerson: "",
    phone: "",
    email: "",
    segment: "Premium Islamic School",
    value: 0,
    status: "Prospect",
    notes: "",
  };
  const save = async (data) => {
    if (editing?.id) {
      await api.put("schools/" + editing.id, data);
      toast.success("School updated");
    } else {
      await api.post("schools", data);
      toast.success("School added");
    }
    setOpen(false);
    setEditing(null);
    load();
  };
  const del = async (id) => {
    await api.del("schools/" + id);
    load();
    toast.success("School deleted");
  };

  if (loading)
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-32 bg-muted/60 rounded animate-pulse mb-1" />
          <div className="h-4 w-60 bg-muted/40 rounded animate-pulse" />
        </div>
        <TableSkeleton rows={6} cols={5} />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">
            School CRM
          </h2>
          <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">
            Islamic school partnerships pipeline
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" /> New school
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {SCHOOL_STATUS.map((s) => {
          const col = items.filter((i) => i.status === s);
          const val = col.reduce((a, b) => a + (b.value || 0), 0);
          return (
            <div key={s} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {s}
                </p>
                <Badge variant="outline" className="text-xs">
                  {col.length}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground px-1">
                {fmtShort(val)}
              </p>
              <div className="space-y-2 min-h-[200px]">
                {col.map((item) => {
                  const wa = whatsappUrl(item.phone);
                  return (
                    <Card key={item.id} className="group">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium leading-tight flex-1">
                            {item.name}
                          </p>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition"
                              >
                                <MoreHorizontal className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditing(item);
                                  setOpen(true);
                                }}
                              >
                                <Edit3 className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => del(item.id)}
                                className="text-rose-400"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {item.city}
                          {item.province ? `, ${item.province}` : ""}
                        </p>
                        {item.contactPerson && (
                          <p className="text-xs text-foreground/80">
                            👤 {item.contactPerson}
                          </p>
                        )}
                        {wa && (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-400 hover:text-emerald-300 px-2.5 py-1 text-xs font-medium transition w-fit max-w-full"
                            title={`WhatsApp ${item.phone}`}
                          >
                            <MessageCircle className="h-3 w-3 shrink-0" />
                            <span className="truncate">{item.phone}</span>
                          </a>
                        )}
                        {item.email && (
                          <a
                            href={`mailto:${item.email}`}
                            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-blue-400 hover:underline truncate w-full"
                          >
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{item.email}</span>
                          </a>
                        )}
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs font-medium text-emerald-400">
                            {fmtShort(item.value)}
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            {item.segment}
                          </Badge>
                        </div>
                        <Select
                          value={item.status}
                          onValueChange={(v) => updateStatus(item, v)}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SCHOOL_STATUS.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <SchoolModal
        open={open}
        onOpenChange={setOpen}
        initial={editing || empty}
        onSave={save}
      />
    </div>
  );
}

const SCHOOL_SEGMENTS = [
  "Premium Islamic School",
  "Modern Islamic",
  "Pesantren",
  "Pondok Modern",
  "Madrasah",
  "Other",
];

function SchoolModal({ open, onOpenChange, initial, onSave }) {
  const [form, setForm] = useState(initial);
  useEffect(() => setForm(initial), [initial, open]);
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {initial?.id ? "Edit school" : "New school"}
          </DialogTitle>
          <DialogDescription>
            Add an Islamic school to the partnership pipeline
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto scrollbar-thin pr-2">
          <div className="col-span-2 space-y-2">
            <Label>School name</Label>
            <Input
              value={form.name || ""}
              onChange={(e) => update("name", e.target.value)}
              placeholder="SMA Al-Azhar Jakarta"
            />
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Input
              value={form.city || ""}
              onChange={(e) => update("city", e.target.value)}
              placeholder="Jakarta"
            />
          </div>
          <div className="space-y-2">
            <Label>Province</Label>
            <Input
              value={form.province || ""}
              onChange={(e) => update("province", e.target.value)}
              placeholder="DKI Jakarta"
            />
          </div>
          <div className="space-y-2">
            <Label>Contact person</Label>
            <Input
              value={form.contactPerson || ""}
              onChange={(e) => update("contactPerson", e.target.value)}
              placeholder="Ustaz Hamzah"
            />
          </div>
          <div className="space-y-2">
            <Label>WhatsApp number</Label>
            <Input
              value={form.phone || ""}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="+62 812 3456 7890"
            />
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email || ""}
              onChange={(e) => update("email", e.target.value)}
              placeholder="contact@school.id"
            />
          </div>
          <div className="space-y-2">
            <Label>Segment</Label>
            <Select
              value={form.segment}
              onValueChange={(v) => update("segment", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCHOOL_SEGMENTS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => update("status", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCHOOL_STATUS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Opportunity Value (IDR)</Label>
            <NumberInput
              value={form.value || 0}
              onChange={(v) => update("value", v)}
            />
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes || ""}
              onChange={(e) => update("notes", e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSave(form)}>
            {initial?.id ? "Save changes" : "Add school"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =========== TIMELINE ===========
function TimelineModule() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    setItems(await api.get("timeline"));
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const years = [2026, 2027, 2028];
  const grouped = years.reduce((acc, y) => {
    acc[y] = items.filter((i) => i.year === y);
    return acc;
  }, {});

  const priorityColor = {
    Critical: "bg-rose-500",
    High: "bg-amber-500",
    Medium: "bg-blue-500",
    Low: "bg-emerald-500",
  };

  if (loading)
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-48 bg-muted/60 rounded animate-pulse mb-1" />
          <div className="h-4 w-40 bg-muted/40 rounded animate-pulse" />
        </div>
        <TimelineSkeleton years={3} items={4} />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">
            Business Timeline
          </h2>
          <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">
            Roadmap 2026 to 2028
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {years.map((year) => (
          <div key={year}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-foreground text-background flex items-center justify-center font-bold text-sm">
                {year.toString().slice(2)}
              </div>
              <div>
                <h3 className="text-xl font-semibold">{year}</h3>
                <p className="text-xs text-muted-foreground">
                  {grouped[year].length} initiatives ·{" "}
                  {fmtShort(
                    grouped[year].reduce((s, i) => s + (i.budget || 0), 0),
                  )}{" "}
                  budget
                </p>
              </div>
            </div>
            <div className="relative pl-6 ml-5 border-l-2 border-border space-y-4">
              {grouped[year].map((init, i) => (
                <motion.div
                  key={init.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="relative"
                >
                  <div
                    className={`absolute -left-[31px] top-4 w-3 h-3 rounded-full ${priorityColor[init.priority] || "bg-muted-foreground"} ring-4 ring-background`}
                  />
                  <Card className="hover:border-border transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{init.name}</h4>
                            <Badge variant="outline" className="text-[10px]">
                              {init.priority}
                            </Badge>
                            <Badge variant="secondary" className="text-[10px]">
                              {init.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {init.description}
                          </p>
                          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                            <span>
                              {init.startDate} → {init.endDate}
                            </span>
                            <span>{init.owner}</span>
                            <span className="font-medium text-emerald-400">
                              {fmtShort(init.budget)}
                            </span>
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
  const [loading, setLoading] = useState(true);
  const [scenario, setScenario] = useState("Normal");
  useEffect(() => {
    (async () => {
      setLoading(true);
      setFinance(await api.get("finance"));
      setLoading(false);
    })();
  }, []);

  const scenarioMultiplier = {
    Optimistic: 1.25,
    Normal: 1.0,
    Pessimistic: 0.75,
  }[scenario];
  const adjustedFinance = finance.map((f) => ({
    ...f,
    revenue: Math.round(f.revenue * scenarioMultiplier),
    profit: Math.round(f.revenue * scenarioMultiplier - f.expenses),
  }));

  const totalRev = adjustedFinance.reduce((s, f) => s + f.revenue, 0);
  const totalExp = finance.reduce((s, f) => s + f.expenses, 0);
  const totalProfit = totalRev - totalExp;

  if (loading)
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-40 bg-muted/60 rounded animate-pulse mb-1" />
          <div className="h-4 w-64 bg-muted/40 rounded animate-pulse" />
        </div>
        <StatsSkeleton stats={4} showChart={true} />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">
            Finance Center
          </h2>
          <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">
            Revenue, expenses, cashflow, and forecasting
          </p>
        </div>
        <Select value={scenario} onValueChange={setScenario}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Scenario" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Optimistic">Optimistic (+25%)</SelectItem>
            <SelectItem value="Normal">Normal forecast</SelectItem>
            <SelectItem value="Pessimistic">Pessimistic (-25%)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Revenue
            </p>
            <p className="text-2xl font-semibold mt-2">{fmtShort(totalRev)}</p>
            <p className="text-xs text-emerald-400 mt-1">
              {((scenarioMultiplier - 1) * 100).toFixed(0)}% vs base
            </p>
          </CardContent>
        </Card>
        <Card className="">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Expenses
            </p>
            <p className="text-2xl font-semibold mt-2">{fmtShort(totalExp)}</p>
          </CardContent>
        </Card>
        <Card className="">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Net Profit
            </p>
            <p
              className={`text-2xl font-semibold mt-2 ${totalProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}
            >
              {fmtShort(totalProfit)}
            </p>
          </CardContent>
        </Card>
        <Card className="">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Margin
            </p>
            <p className="text-2xl font-semibold mt-2">
              {totalRev ? ((totalProfit / totalRev) * 100).toFixed(1) : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="">
        <CardHeader>
          <CardTitle className="text-base">
            Revenue · Expenses · Profit Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={adjustedFinance}>
              <CartesianGrid
                stroke="hsl(var(--border))"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={fmtShort}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                }}
                formatter={fmt}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="expenses"
                stroke="hsl(var(--chart-5))"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="profit"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="">
          <CardHeader>
            <CardTitle className="text-base">Cashflow Projection</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={adjustedFinance}>
                <CartesianGrid
                  stroke="hsl(var(--border))"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickFormatter={fmtShort}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                  formatter={fmt}
                />
                <Bar
                  dataKey="cashflow"
                  fill="hsl(var(--chart-2))"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="">
          <CardHeader>
            <CardTitle className="text-base">Monthly Detail</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[260px]">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground uppercase">
                  <tr>
                    <th className="text-left py-2">Month</th>
                    <th className="text-right">Revenue</th>
                    <th className="text-right">Expenses</th>
                    <th className="text-right">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {adjustedFinance.map((f) => (
                    <tr key={f.id} className="border-b">
                      <td className="py-2 font-medium">{f.month}</td>
                      <td className="text-right">{fmtShort(f.revenue)}</td>
                      <td className="text-right text-muted-foreground">
                        {fmtShort(f.expenses)}
                      </td>
                      <td
                        className={`text-right font-medium ${f.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}
                      >
                        {fmtShort(f.profit)}
                      </td>
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
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    setItems(await api.get("events"));
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);
  const toggleCheck = async (event, idx) => {
    const newChecklist = event.checklist.map((c, i) =>
      i === idx ? { ...c, done: !c.done } : c,
    );
    await api.put("events/" + event.id, { ...event, checklist: newChecklist });
    setItems((arr) =>
      arr.map((e) =>
        e.id === event.id ? { ...e, checklist: newChecklist } : e,
      ),
    );
  };

  if (loading)
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-44 bg-muted/60 rounded animate-pulse mb-1" />
          <div className="h-4 w-52 bg-muted/40 rounded animate-pulse" />
        </div>
        <CardSkeleton
          count={6}
          cols="grid-cols-1 lg:grid-cols-2 xl:grid-cols-3"
        />
      </div>
    );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">
          Events · One Goal
        </h2>
        <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">
          Manage events end-to-end
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map((e) => {
          const total = e.checklist?.length || 0;
          const done = e.checklist?.filter((c) => c.done).length || 0;
          const pct = total ? (done / total) * 100 : 0;
          return (
            <Card key={e.id} className="">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{e.name}</CardTitle>
                    <CardDescription>
                      {e.venue} · {e.date}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">{e.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Budget</p>
                    <p className="font-medium">{fmtShort(e.budget)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Participants</p>
                    <p className="font-medium">{e.participants}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Sponsors</p>
                    <p className="font-medium">{e.sponsors?.length || 0}</p>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">Checklist</span>
                    <span>
                      {done}/{total}
                    </span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
                <div className="space-y-1.5 pt-2 border-t border-border">
                  {e.checklist?.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => toggleCheck(e, i)}
                      className="flex items-center gap-2 text-sm w-full text-left hover:bg-secondary/50 rounded px-1 py-0.5"
                    >
                      {c.done ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span
                        className={
                          c.done ? "line-through text-muted-foreground" : ""
                        }
                      >
                        {c.task}
                      </span>
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
    const rows = data.map((d) =>
      headers
        .map((h) => {
          const val = d[columns[h]];
          if (Array.isArray(val)) return `"${val.join("; ")}"`;
          if (typeof val === "string") return `"${val.replace(/"/g, '""')}"`;
          return val ?? "";
        })
        .join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${collection}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${collection}.csv`);
  };

  const reports = [
    {
      id: "sales",
      title: "Sales Report",
      desc: "Product revenue & margin analysis",
      collection: "products",
      columns: {
        Name: "name",
        SKU: "sku",
        Category: "category",
        Status: "status",
        Cost: "costPrice",
        Selling: "sellingPrice",
      },
    },
    {
      id: "inventory",
      title: "Inventory Report",
      desc: "Stock by SKU, color, size",
      collection: "inventory",
      columns: {
        ProductId: "productId",
        Color: "color",
        Size: "size",
        Quantity: "quantity",
        Threshold: "threshold",
        Incoming: "incoming",
      },
    },
    {
      id: "content",
      title: "Content Performance",
      desc: "Content pipeline export",
      collection: "content",
      columns: {
        Title: "title",
        Platform: "platform",
        Format: "format",
        Owner: "owner",
        Deadline: "deadline",
        Status: "status",
      },
    },
    {
      id: "creators",
      title: "Creator Collaborations",
      desc: "Creator CRM full export",
      collection: "creators",
      columns: {
        Name: "name",
        Username: "username",
        Platform: "platform",
        Followers: "followers",
        Engagement: "engagement",
        Fee: "fee",
        Status: "status",
      },
    },
    {
      id: "schools",
      title: "School Partnerships",
      desc: "School pipeline & values",
      collection: "schools",
      columns: {
        Name: "name",
        City: "city",
        Province: "province",
        Segment: "segment",
        Value: "value",
        Status: "status",
      },
    },
    {
      id: "finance",
      title: "Financial Report",
      desc: "Monthly P&L and cashflow",
      collection: "finance",
      columns: {
        Month: "month",
        Year: "year",
        Revenue: "revenue",
        Expenses: "expenses",
        Profit: "profit",
        Cashflow: "cashflow",
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">
          Reports
        </h2>
        <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">
          Generate and export business reports
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((r) => (
          <Card key={r.id} className="hover:border-border transition-colors">
            <CardHeader>
              <CardTitle className="text-base">{r.title}</CardTitle>
              <CardDescription>{r.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => exportCSV(r.collection, r.columns)}
              >
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
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    setItems(await api.get("notifications"));
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);
  const markRead = async (item) => {
    await api.put("notifications/" + item.id, { ...item, read: true });
    load();
  };
  const sevColor = {
    critical: "text-rose-400 bg-rose-500/10 border-rose-500/30",
    warning: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    info: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    success: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  };

  if (loading)
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-40 bg-muted/60 rounded animate-pulse mb-1" />
          <div className="h-4 w-64 bg-muted/40 rounded animate-pulse" />
        </div>
        <ListSkeleton count={7} />
      </div>
    );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">
          Notifications
        </h2>
        <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">
          Alerts and updates across all modules
        </p>
      </div>
      <div className="space-y-2">
        {items.map((n) => (
          <Card
            key={n.id}
            className={`${!n.read ? "bg-secondary/30" : ""} cursor-pointer`}
            onClick={() => !n.read && markRead(n)}
          >
            <CardContent className="p-4 flex items-start gap-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center ${sevColor[n.severity] || ""}`}
              >
                <Bell className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium">{n.title}</p>
                  <Badge variant="outline" className="text-[10px]">
                    {n.type}
                  </Badge>
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{n.message}</p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {new Date(n.createdAt).toLocaleDateString()}
              </span>
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
  useEffect(() => {
    (async () => setUsers(await api.get("users")))();
  }, []);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">
          Settings
        </h2>
        <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">
          Manage your workspace
        </p>
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
          <Card className="">
            <CardHeader>
              <CardTitle className="text-base">Company Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input defaultValue="ONEMISSION" />
                </div>
                <div className="space-y-2">
                  <Label>Tagline</Label>
                  <Input defaultValue="VALUES MATTER" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Mission</Label>
                <Textarea defaultValue="Empower Muslim athletes worldwide through premium values-aligned apparel and community." />
              </div>
              <Button>Save changes</Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="users" className="space-y-4 mt-4">
          <Card className="">
            <CardHeader>
              <CardTitle className="text-base">Team Members</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-secondary/30">
                  <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {u.avatar}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {u.email}
                      </td>
                      <td className="px-4 py-3">
                        <Badge>{u.role}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="notifications" className="space-y-4 mt-4">
          <Card className="">
            <CardHeader>
              <CardTitle className="text-base">
                Notification Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                "Low stock alerts",
                "Upcoming deadlines",
                "Event reminders",
                "Creator updates",
                "School updates",
                "Financial alerts",
              ].map((p) => (
                <div key={p} className="flex items-center justify-between">
                  <Label>{p}</Label>
                  <Switch defaultChecked />
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="">
            <CardHeader>
              <CardTitle className="text-base">Stock Thresholds</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Critical threshold (units)</Label>
                  <NumberInput value={15} onChange={() => {}} />
                </div>
                <div className="space-y-2">
                  <Label>Warning threshold (units)</Label>
                  <NumberInput value={30} onChange={() => {}} />
                </div>
              </div>
              <Button>Save</Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="appearance" className="space-y-4 mt-4">
          <Card className="">
            <CardHeader>
              <CardTitle className="text-base">Appearance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Dark Mode</Label>
                <Switch
                  defaultChecked
                  onCheckedChange={(v) =>
                    document.documentElement.classList.toggle("dark", v)
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Reduced Motion</Label>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <Label>Compact spacing</Label>
                <Switch />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="integrations" className="space-y-4 mt-4">
          <Card className="">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4" /> Public Product API
              </CardTitle>
              <CardDescription>
                Sync approved products to the main ONEMISSION website in
                real-time
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-border bg-secondary/30 p-3 font-mono text-xs flex items-center justify-between">
                <span className="text-muted-foreground">GET</span>
                <span className="text-foreground/90">/api/public/products</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText("/api/public/products");
                    toast.success("Copied");
                  }}
                >
                  Copy
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Exposes Active products with aggregated stock. Updates
                automatically when inventory changes.
              </p>
              <Button
                variant="outline"
                onClick={async () => {
                  const r = await fetch("/api/public/products");
                  const d = await r.json();
                  console.log(d);
                  toast.success(`${d.length} products synced`);
                }}
              >
                Test endpoint
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// =========== FINANCIAL ACCOUNTS ===========
const PAGE_SIZE_FA = 15;
const FA_TYPES = ["Cash", "Bank", "E-Wallet"];
const FA_TYPE_COLORS = {
  Cash: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  Bank: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  "E-Wallet": "bg-purple-500/10 text-purple-600 border-purple-500/20",
};

function FinancialAccountModule() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [coaAccounts, setCoaAccounts] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterActive, setFilterActive] = useState("all");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => {
    setLoading(true);
    const [data, coas] = await Promise.all([
      api.get("financialaccounts"),
      api.get("chartofaccounts"),
    ]);
    setItems(Array.isArray(data) ? data : []);
    setCoaAccounts(Array.isArray(coas) ? coas.filter((c) => c.isActive) : []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const emptyForm = {
    name: "",
    type: "Cash",
    accountNumber: "",
    bankName: "",
    openingBalance: 0,
    description: "",
    isActive: true,
    linkedCoaId: "",
  };

  const save = async (data) => {
    if (editing?.id) {
      await api.put("financialaccounts/" + editing.id, data);
      toast.success("Financial account updated");
    } else {
      await api.post("financialaccounts", data);
      toast.success("Financial account created");
    }
    setOpen(false);
    setEditing(null);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await api.del("financialaccounts/" + deleteTarget.id);
    toast.success("Account deleted");
    setDeleteTarget(null);
    load();
  };

  const filtered = items.filter((a) => {
    const matchSearch =
      !search || a.name.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "all" || a.type === filterType;
    const matchActive =
      filterActive === "all" ||
      (filterActive === "active" && a.isActive) ||
      (filterActive === "inactive" && !a.isActive);
    return matchSearch && matchType && matchActive;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE_FA));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * PAGE_SIZE_FA,
    safePage * PAGE_SIZE_FA,
  );

  const counts = FA_TYPES.reduce((acc, t) => {
    acc[t] = items.filter((a) => a.type === t && a.isActive).length;
    return acc;
  }, {});

  if (loading)
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-48 bg-muted/60 rounded animate-pulse mb-1" />
          <div className="h-4 w-60 bg-muted/40 rounded animate-pulse" />
        </div>
        <StatsSkeleton stats={3} showChart={false} />
        <TableSkeleton rows={6} cols={5} />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">
            Financial Accounts
          </h2>
          <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">
            Manage cash, bank, and e-wallet accounts
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" /> New Account
        </Button>
      </div>

      {/* Type Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        {FA_TYPES.map((t) => (
          <Card
            key={t}
            className={`cursor-pointer transition-colors ${filterType === t ? "ring-1 ring-border" : "hover:border-border"}`}
            onClick={() => {
              setFilterType(filterType === t ? "all" : t);
              setPage(1);
            }}
          >
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{t}</p>
              <p className="text-xl font-semibold mt-1">{counts[t] || 0}</p>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium mt-1 inline-block ${FA_TYPE_COLORS[t]}`}
              >
                Active
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search by account name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={filterType}
          onValueChange={(v) => {
            setFilterType(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {FA_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filterActive}
          onValueChange={(v) => {
            setFilterActive(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Account Name
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Type
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">
                  Account Number
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">
                  Bank Name
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                  Opening Balance
                </th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    <DollarSign className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No financial accounts yet</p>
                  </td>
                </tr>
              ) : (
                paginated.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-[rgba(17,24,39,0.04)] hover:bg-[#F7F8FA]/80 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{a.name}</p>
                      {a.linkedCoa ? (
                        <p className="text-[10px] text-emerald-500 mt-0.5">
                          COA: {a.linkedCoa.accountCode} —{" "}
                          {a.linkedCoa.accountName}
                        </p>
                      ) : (
                        <p className="text-[10px] text-amber-500 mt-0.5 flex items-center gap-0.5">
                          <AlertTriangle className="h-2.5 w-2.5 inline" /> No
                          linked COA
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${FA_TYPE_COLORS[a.type] || ""}`}
                      >
                        {a.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      {a.accountNumber || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {a.bankName || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {fmt(a.openingBalance || 0)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        variant="outline"
                        className={
                          a.isActive
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {a.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditing(a);
                            setOpen(true);
                          }}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-rose-400 hover:text-rose-500"
                          onClick={() => setDeleteTarget(a)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Showing {(safePage - 1) * PAGE_SIZE_FA + 1}–
              {Math.min(safePage * PAGE_SIZE_FA, filtered.length)} of{" "}
              {filtered.length}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={safePage === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={safePage === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Modal */}
      <FinancialAccountModal
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditing(null);
        }}
        initial={editing || emptyForm}
        coaAccounts={coaAccounts}
        onSave={save}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Financial Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;?
              Transactions linked to this account may be affected. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-500 hover:bg-rose-600 text-white"
              onClick={confirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FinancialAccountModal({
  open,
  onOpenChange,
  initial,
  coaAccounts = [],
  onSave,
}) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [checkingName, setCheckingName] = useState(false);

  useEffect(() => {
    setForm(initial);
    setErrors({});
  }, [initial, open]);

  const update = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: null }));
  };

  const validate = async () => {
    const errs = {};
    if (!form.name?.trim()) errs.name = "Account name is required";
    if (!form.type) errs.type = "Account type is required";
    if (Number(form.openingBalance) < 0)
      errs.openingBalance = "Opening balance cannot be negative";

    if (form.name?.trim() && !errs.name) {
      setCheckingName(true);
      try {
        const res = await api.get(
          `financialaccounts/check-name?name=${encodeURIComponent(form.name.trim())}${initial?.id ? `&excludeId=${initial.id}` : ""}`,
        );
        if (res.exists) errs.name = "Account name already exists";
      } catch {}
      setCheckingName(false);
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    const valid = await validate();
    if (!valid) return;
    onSave({
      name: form.name.trim(),
      type: form.type,
      accountNumber: form.accountNumber?.trim() || "",
      bankName: form.bankName?.trim() || "",
      openingBalance: Number(form.openingBalance) || 0,
      description: form.description?.trim() || "",
      isActive: form.isActive ?? true,
      linkedCoaId: form.linkedCoaId || null,
    });
  };

  const isEdit = !!initial?.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Financial Account" : "New Financial Account"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this financial account"
              : "Add a new cash, bank, or e-wallet account"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {/* Name */}
          <div className="space-y-1.5">
            <Label>
              Account Name <span className="text-rose-400">*</span>
            </Label>
            <Input
              value={form.name || ""}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Main Cash, BCA Giro"
              className={errors.name ? "border-rose-500" : ""}
            />
            {errors.name && (
              <p className="text-xs text-rose-400">{errors.name}</p>
            )}
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label>
              Account Type <span className="text-rose-400">*</span>
            </Label>
            <Select
              value={form.type || "Cash"}
              onValueChange={(v) => update("type", v)}
            >
              <SelectTrigger className={errors.type ? "border-rose-500" : ""}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FA_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.type && (
              <p className="text-xs text-rose-400">{errors.type}</p>
            )}
          </div>

          {/* Account Number */}
          <div className="space-y-1.5">
            <Label>Account Number</Label>
            <Input
              value={form.accountNumber || ""}
              onChange={(e) => update("accountNumber", e.target.value)}
              placeholder="e.g. 1234567890"
            />
          </div>

          {/* Bank Name */}
          <div className="space-y-1.5">
            <Label>Bank Name</Label>
            <Input
              value={form.bankName || ""}
              onChange={(e) => update("bankName", e.target.value)}
              placeholder="e.g. BCA, Mandiri, BNI"
            />
          </div>

          {/* Opening Balance */}
          <div className="space-y-1.5">
            <Label>Opening Balance</Label>
            <NumberInput
              value={form.openingBalance || 0}
              onChange={(v) => update("openingBalance", v)}
              min={0}
              placeholder="0"
              className={errors.openingBalance ? "border-rose-500" : ""}
            />
            {errors.openingBalance && (
              <p className="text-xs text-rose-400">{errors.openingBalance}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Initial balance when this account was set up
            </p>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={form.description || ""}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Add notes or description..."
              rows={2}
            />
          </div>

          {/* Linked COA Account */}
          <div className="space-y-1.5">
            <Label>Linked COA Account</Label>
            <Select
              value={form.linkedCoaId || "none"}
              onValueChange={(v) =>
                update("linkedCoaId", v === "none" ? "" : v)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Link to Chart of Accounts..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Not linked —</SelectItem>
                {coaAccounts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.accountCode} — {c.accountName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Required for automatic journal entry generation in Cash In / Cash
              Out
            </p>
          </div>

          {/* Is Active */}
          <div className="flex items-center justify-between py-1 border-t border-border/50">
            <div>
              <Label>Active</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Inactive accounts cannot be used in transactions
              </p>
            </div>
            <Switch
              checked={form.isActive ?? true}
              onCheckedChange={(v) => update("isActive", v)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={checkingName}>
            {checkingName && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isEdit ? "Save Changes" : "Create Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =========== CASH MANAGEMENT ===========
const PAGE_SIZE_CASH = 15;

function CashTransactionModule({ type }) {
  const label = type === "IN" ? "Cash In" : "Cash Out";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [financialAccounts, setFinancialAccounts] = useState([]);
  const [coaAccounts, setCoaAccounts] = useState([]);
  const [open, setOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => {
    setLoading(true);
    const [txns, fas, coas] = await Promise.all([
      api.get("cashtransactions?type=" + type),
      api.get("financialaccounts"),
      api.get("chartofaccounts"),
    ]);
    setItems(Array.isArray(txns) ? txns : []);
    setFinancialAccounts(
      Array.isArray(fas) ? fas.filter((f) => f.isActive) : [],
    );
    setCoaAccounts(
      Array.isArray(coas)
        ? coas.filter((c) => c.allowTransaction && c.isActive)
        : [],
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [type]);

  const emptyForm = {
    transactionDate: new Date().toISOString().split("T")[0],
    transactionType: type,
    financialAccountId: "",
    chartOfAccountId: "",
    amount: 0,
    referenceNumber: "",
    description: "",
    attachment: "",
    createdBy: "",
  };

  const save = async (data) => {
    let result;
    if (editing?.id) {
      result = await api.put("cashtransactions/" + editing.id, data);
    } else {
      result = await api.post("cashtransactions", data);
    }
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success(
      editing?.id
        ? label + " transaction updated"
        : label + " transaction created",
    );
    setOpen(false);
    setEditing(null);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await api.del("cashtransactions/" + deleteTarget.id);
    toast.success("Transaction deleted");
    setDeleteTarget(null);
    load();
  };

  const filtered = items.filter((t) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      t.referenceNumber?.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      t.financialAccount?.name?.toLowerCase().includes(q) ||
      t.chartOfAccount?.accountName?.toLowerCase().includes(q);
    const matchFrom = !dateFrom || t.transactionDate >= dateFrom;
    const matchTo = !dateTo || t.transactionDate <= dateTo;
    return matchSearch && matchFrom && matchTo;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE_CASH));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * PAGE_SIZE_CASH,
    safePage * PAGE_SIZE_CASH,
  );

  const totalAmount = items.reduce((s, t) => s + (t.amount || 0), 0);
  const now = new Date();
  const monthStr =
    now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  const monthAmount = items
    .filter((t) => t.transactionDate?.startsWith(monthStr))
    .reduce((s, t) => s + (t.amount || 0), 0);

  const isIn = type === "IN";
  const amtClass = isIn ? "text-emerald-500" : "text-rose-500";

  if (loading)
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-32 bg-muted/60 rounded animate-pulse mb-1" />
          <div className="h-4 w-64 bg-muted/40 rounded animate-pulse" />
        </div>
        <StatsSkeleton stats={3} showChart={false} />
        <TableSkeleton rows={8} cols={6} />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">
            {label}
          </h2>
          <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">
            {isIn
              ? "Record incoming cash and bank receipts"
              : "Record outgoing cash and bank payments"}
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" /> New {label}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Transactions</p>
            <p className="text-2xl font-semibold mt-1">{items.length}</p>
          </CardContent>
        </Card>
        <Card className="">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Amount</p>
            <p className={"text-xl font-semibold mt-1 " + amtClass}>
              {fmtShort(totalAmount)}
            </p>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">This Month</p>
            <p className={"text-xl font-semibold mt-1 " + amtClass}>
              {fmtShort(monthAmount)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search by reference, description, or account..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Input
          type="date"
          className="w-full sm:w-36"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
        />
        <Input
          type="date"
          className="w-full sm:w-36"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
        />
        {(search || dateFrom || dateTo) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setDateFrom("");
              setDateTo("");
              setPage(1);
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <Card className="">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Date
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Reference
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Financial Account
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  COA Account
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                  Amount
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">
                  Description
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    <DollarSign className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">
                      No {label.toLowerCase()} transactions yet
                    </p>
                  </td>
                </tr>
              ) : (
                paginated.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-[rgba(17,24,39,0.04)] hover:bg-[#F7F8FA]/80 transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      {t.transactionDate}
                    </td>
                    <td className="px-4 py-3">
                      {t.referenceNumber ? (
                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                          {t.referenceNumber}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {t.financialAccount?.name || "—"}
                      {t.financialAccount && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({t.financialAccount.type})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground mr-1">
                        {t.chartOfAccount?.accountCode}
                      </span>
                      {t.chartOfAccount?.accountName}
                    </td>
                    <td
                      className={
                        "px-4 py-3 text-right font-semibold whitespace-nowrap " +
                        amtClass
                      }
                    >
                      {fmt(t.amount)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[180px] truncate hidden md:table-cell">
                      {t.description || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="View"
                          onClick={() => {
                            setViewItem(t);
                            setViewOpen(true);
                          }}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Edit"
                          onClick={() => {
                            setEditing(t);
                            setOpen(true);
                          }}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-rose-400 hover:text-rose-500"
                          title="Delete"
                          onClick={() => setDeleteTarget(t)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Showing {(safePage - 1) * PAGE_SIZE_CASH + 1}–
              {Math.min(safePage * PAGE_SIZE_CASH, filtered.length)} of{" "}
              {filtered.length}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={safePage === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={safePage === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Create / Edit Modal */}
      <CashTransactionModal
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditing(null);
        }}
        initial={editing || emptyForm}
        financialAccounts={financialAccounts}
        coaAccounts={coaAccounts}
        transactionType={type}
        onSave={save}
      />

      {/* View Modal */}
      <CashTransactionViewModal
        open={viewOpen}
        onOpenChange={setViewOpen}
        item={viewItem}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this {label.toLowerCase()}{" "}
              transaction
              {deleteTarget?.referenceNumber
                ? " (" + deleteTarget.referenceNumber + ")"
                : ""}
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-500 hover:bg-rose-600 text-white"
              onClick={confirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CashTransactionModal({
  open,
  onOpenChange,
  initial,
  financialAccounts,
  coaAccounts,
  transactionType,
  onSave,
}) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setForm(initial);
    setErrors({});
  }, [initial, open]);

  const update = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: null }));
  };

  const validate = () => {
    const errs = {};
    if (!form.transactionDate) errs.transactionDate = "Date is required";
    if (!form.financialAccountId)
      errs.financialAccountId = "Financial account is required";
    if (!form.chartOfAccountId)
      errs.chartOfAccountId = "COA account is required";
    if (!form.amount || Number(form.amount) <= 0)
      errs.amount = "Amount must be greater than 0";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave({
      transactionDate: form.transactionDate,
      transactionType,
      financialAccountId: form.financialAccountId,
      chartOfAccountId: form.chartOfAccountId,
      amount: Number(form.amount),
      referenceNumber: form.referenceNumber?.trim() || "",
      description: form.description?.trim() || "",
      attachment: form.attachment?.trim() || "",
      createdBy: form.createdBy?.trim() || "",
    });
  };

  const isEdit = !!initial?.id;
  const typeLabel = transactionType === "IN" ? "Cash In" : "Cash Out";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit " + typeLabel : "New " + typeLabel}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this " + typeLabel.toLowerCase() + " transaction"
              : "Record a new " + typeLabel.toLowerCase() + " transaction"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {/* Transaction Date */}
          <div className="space-y-1.5">
            <Label>
              Transaction Date <span className="text-rose-400">*</span>
            </Label>
            <Input
              type="date"
              value={form.transactionDate || ""}
              onChange={(e) => update("transactionDate", e.target.value)}
              className={errors.transactionDate ? "border-rose-500" : ""}
            />
            {errors.transactionDate && (
              <p className="text-xs text-rose-400">{errors.transactionDate}</p>
            )}
          </div>

          {/* Financial Account */}
          <div className="space-y-1.5">
            <Label>
              Financial Account <span className="text-rose-400">*</span>
            </Label>
            <Select
              value={form.financialAccountId || ""}
              onValueChange={(v) => update("financialAccountId", v)}
            >
              <SelectTrigger
                className={errors.financialAccountId ? "border-rose-500" : ""}
              >
                <SelectValue placeholder="Select financial account" />
              </SelectTrigger>
              <SelectContent>
                {financialAccounts.map((fa) => (
                  <SelectItem key={fa.id} value={fa.id}>
                    {fa.name}
                    <span className="text-muted-foreground ml-1 text-xs">
                      ({fa.type})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.financialAccountId && (
              <p className="text-xs text-rose-400">
                {errors.financialAccountId}
              </p>
            )}
          </div>

          {/* COA Account */}
          <div className="space-y-1.5">
            <Label>
              COA Account <span className="text-rose-400">*</span>
            </Label>
            <Select
              value={form.chartOfAccountId || ""}
              onValueChange={(v) => update("chartOfAccountId", v)}
            >
              <SelectTrigger
                className={errors.chartOfAccountId ? "border-rose-500" : ""}
              >
                <SelectValue placeholder="Select account (transactional only)" />
              </SelectTrigger>
              <SelectContent>
                {coaAccounts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.accountCode} — {c.accountName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.chartOfAccountId && (
              <p className="text-xs text-rose-400">{errors.chartOfAccountId}</p>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label>
              Amount <span className="text-rose-400">*</span>
            </Label>
            <NumberInput
              value={form.amount || 0}
              onChange={(v) => update("amount", v)}
              min={0}
              placeholder="0"
              className={errors.amount ? "border-rose-500" : ""}
            />
            {errors.amount && (
              <p className="text-xs text-rose-400">{errors.amount}</p>
            )}
          </div>

          {/* Reference Number */}
          <div className="space-y-1.5">
            <Label>Reference Number</Label>
            <Input
              value={form.referenceNumber || ""}
              onChange={(e) => update("referenceNumber", e.target.value)}
              placeholder="e.g. INV-001, REC-2026-001"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={form.description || ""}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Add notes or description..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {isEdit ? "Save Changes" : "Create " + typeLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CashTransactionViewModal({ open, onOpenChange, item }) {
  if (!item) return null;
  const isIn = item.transactionType === "IN";
  const rows = [
    { label: "Date", value: item.transactionDate },
    { label: "Type", value: isIn ? "Cash In" : "Cash Out" },
    {
      label: "Financial Account",
      value: item.financialAccount
        ? item.financialAccount.name + " (" + item.financialAccount.type + ")"
        : "—",
    },
    {
      label: "COA Account",
      value: item.chartOfAccount
        ? item.chartOfAccount.accountCode +
          " — " +
          item.chartOfAccount.accountName
        : "—",
    },
    { label: "Amount", value: fmt(item.amount), highlight: true },
    { label: "Reference", value: item.referenceNumber || "—" },
    { label: "Description", value: item.description || "—" },
    {
      label: "Created",
      value: item.createdAt
        ? new Date(item.createdAt).toLocaleString("id-ID")
        : "—",
    },
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transaction Detail</DialogTitle>
          <DialogDescription>
            {isIn ? "Cash In" : "Cash Out"} transaction record
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-start justify-between gap-4 py-1 border-b border-[rgba(17,24,39,0.04)] last:border-0"
            >
              <span className="text-sm text-muted-foreground shrink-0 w-36">
                {r.label}
              </span>
              <span
                className={
                  "text-sm font-medium text-right break-all " +
                  (r.highlight
                    ? isIn
                      ? "text-emerald-500"
                      : "text-rose-500"
                    : "")
                }
              >
                {r.value}
              </span>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =========== CHART OF ACCOUNTS ===========
const ACCOUNT_TYPES = ["Asset", "Liability", "Equity", "Revenue", "Expense"];
const NORMAL_BALANCES = ["Debit", "Credit"];
const PAGE_SIZE_COA = 15;

const ACCOUNT_TYPE_COLORS = {
  Asset: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  Liability: "text-rose-400 bg-rose-400/10 border-rose-400/20",
  Equity: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  Revenue: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  Expense: "text-amber-400 bg-amber-400/10 border-amber-400/20",
};

function ChartOfAccountsModule() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterActive, setFilterActive] = useState("all");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => {
    setLoading(true);
    const data = await api.get("chartofaccounts");
    setItems(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const emptyForm = {
    accountCode: "",
    accountName: "",
    accountType: "Asset",
    normalBalance: "Debit",
    description: "",
    isActive: true,
    allowTransaction: true,
    parentId: null,
  };

  const save = async (data) => {
    if (editing?.id) {
      await api.put("chartofaccounts/" + editing.id, data);
      toast.success("Account updated");
    } else {
      await api.post("chartofaccounts", data);
      toast.success("Account created");
    }
    setOpen(false);
    setEditing(null);
    load();
  };

  const confirmDeactivate = async () => {
    if (!deleteTarget) return;
    await api.del("chartofaccounts/" + deleteTarget.id);
    toast.success("Account deactivated");
    setDeleteTarget(null);
    load();
  };

  const filtered = items.filter((a) => {
    const matchSearch =
      !search ||
      a.accountCode.toLowerCase().includes(search.toLowerCase()) ||
      a.accountName.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "all" || a.accountType === filterType;
    const matchActive =
      filterActive === "all" ||
      (filterActive === "active" && a.isActive) ||
      (filterActive === "inactive" && !a.isActive);
    return matchSearch && matchType && matchActive;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE_COA));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * PAGE_SIZE_COA,
    safePage * PAGE_SIZE_COA,
  );

  const getParentName = (parentId) => {
    if (!parentId) return null;
    const p = items.find((a) => a.id === parentId);
    return p ? `${p.accountCode} — ${p.accountName}` : null;
  };

  const counts = ACCOUNT_TYPES.reduce((acc, t) => {
    acc[t] = items.filter((a) => a.accountType === t && a.isActive).length;
    return acc;
  }, {});

  if (loading)
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-44 bg-muted/60 rounded animate-pulse mb-1" />
          <div className="h-4 w-60 bg-muted/40 rounded animate-pulse" />
        </div>
        <StatsSkeleton stats={4} showChart={false} />
        <TableSkeleton rows={8} cols={6} />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">
            Chart of Accounts
          </h2>
          <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">
            Master account structure for financial reporting
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" /> New Account
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {ACCOUNT_TYPES.map((t) => (
          <Card
            key={t}
            className={`cursor-pointer transition-colors ${filterType === t ? "border-border ring-1 ring-border" : "hover:border-border"}`}
            onClick={() => {
              setFilterType(filterType === t ? "all" : t);
              setPage(1);
            }}
          >
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{t}</p>
              <p className="text-xl font-semibold mt-1">{counts[t] || 0}</p>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium mt-1 inline-block ${ACCOUNT_TYPE_COLORS[t]}`}
              >
                active
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search code or name..."
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={filterType}
          onValueChange={(v) => {
            setFilterType(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Account Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {ACCOUNT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filterActive}
          onValueChange={(v) => {
            setFilterActive(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-[#F7F8FA]">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground w-28">
                  Code
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Account Name
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Type
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Normal Balance
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">
                  Parent Account
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">
                  Transaction
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {paginated.map((a) => {
                const parentName = getParentName(a.parentId);
                const typeColor =
                  ACCOUNT_TYPE_COLORS[a.accountType] ||
                  "text-muted-foreground bg-secondary border-border";
                return (
                  <tr
                    key={a.id}
                    className={`border-b hover:bg-[#F7F8FA] transition-colors ${!a.isActive ? "opacity-50" : ""}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-medium">
                      {a.accountCode}
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className={`font-medium ${a.parentId ? "pl-3 border-l-2 border-border/40" : ""}`}
                      >
                        {a.accountName}
                      </div>
                      {a.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {a.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border font-medium ${typeColor}`}
                      >
                        {a.accountType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {a.normalBalance}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                      {parentName || (
                        <span className="italic opacity-50">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <Badge
                        variant={a.allowTransaction ? "default" : "outline"}
                        className="font-normal text-xs"
                      >
                        {a.allowTransaction ? "Allowed" : "Header"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={a.isActive ? "default" : "secondary"}
                        className="font-normal text-xs"
                      >
                        {a.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(a);
                              setOpen(true);
                            }}
                          >
                            <Edit3 className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          {a.isActive && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeleteTarget(a)}
                                className="text-rose-400 focus:text-rose-400"
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Deactivate
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
              {paginated.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="p-12 text-center text-muted-foreground"
                  >
                    <BookOpen className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    No accounts found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-xs text-muted-foreground">
              Showing {(safePage - 1) * PAGE_SIZE_COA + 1}–
              {Math.min(safePage * PAGE_SIZE_COA, filtered.length)} of{" "}
              {filtered.length} accounts
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground px-2">
                {safePage} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <ChartOfAccountModal
        open={open}
        onOpenChange={setOpen}
        initial={editing || emptyForm}
        accounts={items}
        onSave={save}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate{" "}
              <strong>
                {deleteTarget?.accountCode} — {deleteTarget?.accountName}
              </strong>
              ? The account will be hidden from active lists but the data will
              be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeactivate}
              className="bg-rose-500 hover:bg-rose-600"
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ChartOfAccountModal({
  open,
  onOpenChange,
  initial,
  accounts,
  onSave,
}) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [checkingCode, setCheckingCode] = useState(false);

  useEffect(() => {
    setForm(initial);
    setErrors({});
  }, [initial, open]);

  const update = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: null }));
  };

  const validate = async () => {
    const errs = {};
    if (!form.accountCode?.trim())
      errs.accountCode = "Account code is required";
    if (!form.accountName?.trim())
      errs.accountName = "Account name is required";
    if (!form.accountType) errs.accountType = "Account type is required";
    if (!form.normalBalance) errs.normalBalance = "Normal balance is required";

    if (form.accountCode?.trim() && !errs.accountCode) {
      setCheckingCode(true);
      try {
        const res = await api.get(
          `chartofaccounts/check-code?code=${encodeURIComponent(form.accountCode.trim())}${initial?.id ? `&excludeId=${initial.id}` : ""}`,
        );
        if (res.exists) errs.accountCode = "Account code already exists";
      } catch {}
      setCheckingCode(false);
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    const valid = await validate();
    if (!valid) return;
    const payload = {
      accountCode: form.accountCode.trim(),
      accountName: form.accountName.trim(),
      accountType: form.accountType,
      normalBalance: form.normalBalance,
      description: form.description?.trim() || "",
      isActive: form.isActive ?? true,
      allowTransaction: form.allowTransaction ?? true,
      parentId: form.parentId || null,
    };
    onSave(payload);
  };

  const parentOptions = accounts.filter(
    (a) => a.id !== initial?.id && a.isActive,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {initial?.id ? "Edit Account" : "New Account"}
          </DialogTitle>
          <DialogDescription>
            {initial?.id
              ? "Update the chart of accounts entry"
              : "Add a new account to the chart of accounts"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>
                Account Code <span className="text-rose-400">*</span>
              </Label>
              <Input
                value={form.accountCode || ""}
                onChange={(e) => update("accountCode", e.target.value)}
                placeholder="e.g. 1100"
                className={errors.accountCode ? "border-rose-500" : ""}
              />
              {errors.accountCode && (
                <p className="text-xs text-rose-400">{errors.accountCode}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>
                Account Type <span className="text-rose-400">*</span>
              </Label>
              <Select
                value={form.accountType || "Asset"}
                onValueChange={(v) => update("accountType", v)}
              >
                <SelectTrigger
                  className={errors.accountType ? "border-rose-500" : ""}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.accountType && (
                <p className="text-xs text-rose-400">{errors.accountType}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>
              Account Name <span className="text-rose-400">*</span>
            </Label>
            <Input
              value={form.accountName || ""}
              onChange={(e) => update("accountName", e.target.value)}
              placeholder="e.g. Cash on Hand"
              className={errors.accountName ? "border-rose-500" : ""}
            />
            {errors.accountName && (
              <p className="text-xs text-rose-400">{errors.accountName}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>
              Normal Balance <span className="text-rose-400">*</span>
            </Label>
            <Select
              value={form.normalBalance || "Debit"}
              onValueChange={(v) => update("normalBalance", v)}
            >
              <SelectTrigger
                className={errors.normalBalance ? "border-rose-500" : ""}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NORMAL_BALANCES.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.normalBalance && (
              <p className="text-xs text-rose-400">{errors.normalBalance}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Parent Account</Label>
            <Select
              value={form.parentId || "__none__"}
              onValueChange={(v) =>
                update("parentId", v === "__none__" ? null : v)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="None (top-level account)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  None (top-level account)
                </SelectItem>
                {parentOptions.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.accountCode} — {a.accountName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={form.description || ""}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Optional description..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-1">
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Allow Transaction</p>
                <p className="text-xs text-muted-foreground">
                  Can be used in journal entries
                </p>
              </div>
              <Switch
                checked={form.allowTransaction ?? true}
                onCheckedChange={(v) => update("allowTransaction", v)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Is Active</p>
                <p className="text-xs text-muted-foreground">
                  Account is available for use
                </p>
              </div>
              <Switch
                checked={form.isActive ?? true}
                onCheckedChange={(v) => update("isActive", v)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={checkingCode}>
            {checkingCode ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {initial?.id ? "Save Changes" : "Create Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RawMaterialModule() {
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const load = async () => {
    setLoading(true);
    const [rms, sups] = await Promise.all([
      api.get("rawmaterials"),
      api.get("suppliers"),
    ]);
    setItems(Array.isArray(rms) ? rms : []);
    setSuppliers(Array.isArray(sups) ? sups : []);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const empty = {
    name: "",
    color: "",
    weight: 0,
    photo: "",
    category: "",
    unit: "",
    currentStock: 0,
    minimumStock: 0,
    unitCost: 0,
    supplierId: "",
    supplierName: "",
    notes: "",
    status: "Active",
  };

  const save = async (data) => {
    // Sync supplierName from linked supplier for backward compatibility
    const linkedSupplier = data.supplierId
      ? suppliers.find((s) => s.id === data.supplierId)
      : null;
    const body = {
      name: data.name,
      color: data.color,
      weight: Number(data.weight),
      photo: data.photo || null,
      category: data.category || "",
      unit: data.unit || "",
      currentStock: Number(data.currentStock) || 0,
      minimumStock: Number(data.minimumStock) || 0,
      unitCost: Number(data.unitCost) || 0,
      supplierId: data.supplierId || null,
      supplierName: linkedSupplier
        ? linkedSupplier.supplierName
        : data.supplierName || "",
      notes: data.notes || "",
      status: data.status || "Active",
    };
    if (editing?.id) {
      await api.put("rawmaterials/" + editing.id, body);
      toast.success("Raw material updated successfully");
    } else {
      await api.post("rawmaterials", body);
      toast.success("Raw material added successfully");
    }
    setOpen(false);
    setEditing(null);
    load();
  };

  const del = async (id) => {
    await api.del("rawmaterials/" + id);
    load();
    toast.success("Raw material deleted successfully");
  };

  const isLowStock = (item) =>
    (item.minimumStock || 0) > 0 &&
    (item.currentStock || 0) <= (item.minimumStock || 0);

  const filtered = items.filter((item) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      item.name.toLowerCase().includes(q) ||
      (item.color || "").toLowerCase().includes(q) ||
      (item.category || "").toLowerCase().includes(q) ||
      (item.supplierName || "").toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === "all" || (item.status || "Active") === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalWeight = items.reduce((s, i) => s + (i.weight || 0), 0);
  const lowStockCount = items.filter(isLowStock).length;
  const totalInventoryValue = items.reduce(
    (s, i) => s + (i.unitCost || 0) * (i.currentStock || 0),
    0,
  );
  const activeCount = items.filter(
    (i) => (i.status || "Active") === "Active",
  ).length;

  const fmtDate = (dt) => {
    if (!dt) return "—";
    return new Date(dt).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (loading)
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-40 bg-muted/60 rounded animate-pulse mb-1" />
          <div className="h-4 w-64 bg-muted/40 rounded animate-pulse" />
        </div>
        <StatsSkeleton stats={4} showChart={false} />
        <TableSkeleton rows={6} cols={8} />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">
            Raw Materials
          </h2>
          <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">
            Manufacturing-ready material master
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" /> Add Raw Material
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">
              Total Materials
            </p>
            <p className="text-2xl font-bold">{items.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {activeCount} active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">
              Inventory Value
            </p>
            <p className="text-2xl font-bold">
              {fmtShort(totalInventoryValue)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">at unit cost</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Weight</p>
            <p className="text-2xl font-bold">
              {totalWeight.toLocaleString("id-ID", {
                maximumFractionDigits: 2,
              })}{" "}
              kg
            </p>
          </CardContent>
        </Card>
        <Card
          className={lowStockCount > 0 ? "border-amber-300 bg-amber-50" : ""}
        >
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              {lowStockCount > 0 && (
                <AlertTriangle className="h-3 w-3 text-amber-500" />
              )}
              Low Stock
            </p>
            <p
              className={`text-2xl font-bold ${lowStockCount > 0 ? "text-amber-600" : ""}`}
            >
              {lowStockCount}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              items need reorder
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, category, supplier..."
            className="pl-8 h-9 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-[#F7F8FA]">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Photo
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Name
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Category
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Unit
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Current Stock
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Min Stock
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Unit Cost
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Supplier
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const lowStock = isLowStock(item);
                return (
                  <tr
                    key={item.id}
                    className={`border-b hover:bg-[#F7F8FA] transition-colors ${lowStock ? "bg-amber-50/40" : ""}`}
                  >
                    <td className="px-4 py-3">
                      {item.photo ? (
                        <img
                          src={item.photo}
                          alt={item.name}
                          className="w-10 h-10 object-cover rounded-md border"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-md border bg-[#F7F8FA] flex items-center justify-center text-muted-foreground">
                          <Package className="h-4 w-4" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.color && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <div
                              className="w-2.5 h-2.5 rounded-full border shrink-0"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="text-xs text-muted-foreground">
                              {item.color}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.category || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.unit || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {lowStock && (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        )}
                        <span
                          className={`font-medium ${lowStock ? "text-amber-600" : ""}`}
                        >
                          {Number(item.currentStock || 0).toLocaleString(
                            "id-ID",
                            { maximumFractionDigits: 2 },
                          )}
                        </span>
                      </div>
                      {lowStock && (
                        <Badge
                          variant="outline"
                          className="text-[10px] mt-0.5 border-amber-300 text-amber-600 bg-amber-50"
                        >
                          Low Stock
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {Number(item.minimumStock || 0).toLocaleString("id-ID", {
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {item.unitCost ? fmt(item.unitCost) : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.supplierName || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={
                          (item.status || "Active") === "Active"
                            ? "border-green-300 text-green-700 bg-green-50"
                            : "border-gray-300 text-gray-500 bg-gray-50"
                        }
                      >
                        {item.status || "Active"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(item);
                              setOpen(true);
                            }}
                          >
                            <Edit3 className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => del(item.id)}
                            className="text-rose-400"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="p-12 text-center text-muted-foreground"
                  >
                    {items.length === 0
                      ? "There are currently no raw materials in the inventory. Click 'Add Raw Material' to get started."
                      : "No materials match your search criteria."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <RawMaterialModal
        open={open}
        onOpenChange={setOpen}
        initial={editing || empty}
        onSave={save}
        suppliers={suppliers}
      />
    </div>
  );
}

function RawMaterialModal({
  open,
  onOpenChange,
  initial,
  onSave,
  suppliers = [],
}) {
  const [form, setForm] = useState(initial);
  useEffect(() => setForm(initial), [initial, open]);
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const SectionHeader = ({ children }) => (
    <div className="col-span-2 pt-2">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground border-b pb-1.5">
        {children}
      </p>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initial?.id ? "Edit Raw Material" : "Add Raw Material"}
          </DialogTitle>
          <DialogDescription>Manage raw material master data</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          {/* ── Material Information ── */}
          <SectionHeader>Material Information</SectionHeader>

          <div className="space-y-2 col-span-2">
            <Label>
              Name <span className="text-rose-500">*</span>
            </Label>
            <Input
              value={form.name || ""}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Raw material name"
            />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Input
              value={form.category || ""}
              onChange={(e) => update("category", e.target.value)}
              placeholder="e.g. Fabric, Thread, Dye"
            />
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <Input
              value={form.color || ""}
              onChange={(e) => update("color", e.target.value)}
              placeholder="e.g. White, Navy Blue, #FF0000"
            />
          </div>

          <div className="space-y-2 col-span-2">
            <Label>Photo URL (optional)</Label>
            <Input
              value={form.photo || ""}
              onChange={(e) => update("photo", e.target.value)}
              placeholder="https://..."
            />
            {form.photo && (
              <img
                src={form.photo}
                alt="Preview"
                className="w-full max-h-32 object-cover rounded-md border mt-2"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            )}
          </div>

          {/* ── Inventory Information ── */}
          <SectionHeader>Inventory Information</SectionHeader>

          <div className="space-y-2">
            <Label>Unit</Label>
            <Input
              value={form.unit || ""}
              onChange={(e) => update("unit", e.target.value)}
              placeholder="e.g. kg, meter, pcs, roll"
            />
          </div>

          <div className="space-y-2">
            <Label>Weight (kg)</Label>
            <NumberInput
              decimal
              value={form.weight || 0}
              onChange={(v) => update("weight", v)}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label>Current Stock</Label>
            <NumberInput
              decimal
              value={form.currentStock || 0}
              onChange={(v) => update("currentStock", v)}
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label>Minimum Stock</Label>
            <NumberInput
              decimal
              value={form.minimumStock || 0}
              onChange={(v) => update("minimumStock", v)}
              placeholder="0"
            />
            <p className="text-[11px] text-muted-foreground">
              A low stock warning appears when current stock falls at or below
              this value.
            </p>
          </div>

          {/* ── Cost Information ── */}
          <SectionHeader>Cost Information</SectionHeader>

          <div className="space-y-2 col-span-2">
            <Label>Unit Cost (Rp)</Label>
            <NumberInput
              decimal
              value={form.unitCost || 0}
              onChange={(v) => update("unitCost", v)}
              placeholder="0"
            />
          </div>

          {/* ── Supplier Information ── */}
          <SectionHeader>Supplier Information</SectionHeader>

          <div className="space-y-2 col-span-2">
            <Label>Supplier</Label>
            {suppliers.length > 0 ? (
              <Select
                value={form.supplierId || "none"}
                onValueChange={(v) => {
                  const sid = v === "none" ? "" : v;
                  const sup = suppliers.find((s) => s.id === sid);
                  update("supplierId", sid);
                  if (sup) update("supplierName", sup.supplierName);
                  else if (!sid) update("supplierName", "");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— No Supplier —</SelectItem>
                  {suppliers
                    .filter((s) => (s.status || "Active") === "Active")
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.supplierCode} · {s.supplierName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={form.supplierName || ""}
                onChange={(e) => update("supplierName", e.target.value)}
                placeholder="Supplier or vendor name"
              />
            )}
            {!suppliers.length && (
              <p className="text-[11px] text-muted-foreground">
                Add suppliers in Operations → Suppliers to link raw materials to
                a supplier.
              </p>
            )}
          </div>

          {/* ── Additional Information ── */}
          <SectionHeader>Additional Information</SectionHeader>

          <div className="space-y-2 col-span-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes || ""}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Internal notes about this material..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.status || "Active"}
              onValueChange={(v) => update("status", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSave(form)} disabled={!form.name?.trim()}>
            {initial?.id ? "Save Changes" : "Add Raw Material"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =========== JOURNAL ENTRIES ===========
const JOURNAL_SOURCES = [
  "Manual",
  "Cash In",
  "Cash Out",
  "Inventory",
  "Purchasing",
  "Sales",
  "Adjustment",
];
const PAGE_SIZE_JE = 15;

function JournalEntriesModule() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [coaAccounts, setCoaAccounts] = useState([]);
  const [open, setOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [postTarget, setPostTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editing, setEditing] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [page, setPage] = useState(1);

  const load = async () => {
    setLoading(true);
    const [journals, coas] = await Promise.all([
      api.get("journalentries"),
      api.get("chartofaccounts"),
    ]);
    setItems(Array.isArray(journals) ? journals : []);
    setCoaAccounts(
      Array.isArray(coas)
        ? coas.filter((c) => c.allowTransaction && c.isActive)
        : [],
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (data) => {
    let result;
    if (editing?.id) {
      result = await api.put("journalentries/" + editing.id, data);
    } else {
      result = await api.post("journalentries", data);
    }
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success(
      editing?.id ? "Journal entry updated" : "Journal entry created",
    );
    setOpen(false);
    setEditing(null);
    load();
  };

  const confirmPost = async () => {
    if (!postTarget) return;
    const result = await api.post(
      "journalentries/" + postTarget.id + "/post",
      {},
    );
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success("Journal entry posted successfully");
    }
    setPostTarget(null);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const result = await api.del("journalentries/" + deleteTarget.id);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success("Journal entry deleted");
    }
    setDeleteTarget(null);
    load();
  };

  const filtered = items.filter((j) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      j.journalNumber?.toLowerCase().includes(q) ||
      j.description?.toLowerCase().includes(q) ||
      j.referenceNumber?.toLowerCase().includes(q) ||
      j.journalSource?.toLowerCase().includes(q);
    const matchFrom = !dateFrom || j.journalDate >= dateFrom;
    const matchTo = !dateTo || j.journalDate <= dateTo;
    const matchStatus = statusFilter === "all" || j.status === statusFilter;
    const matchSource =
      sourceFilter === "all" || j.journalSource === sourceFilter;
    return matchSearch && matchFrom && matchTo && matchStatus && matchSource;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE_JE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * PAGE_SIZE_JE,
    safePage * PAGE_SIZE_JE,
  );

  const totalJournals = items.length;
  const draftCount = items.filter((j) => j.status === "Draft").length;
  const postedCount = items.filter((j) => j.status === "Posted").length;

  const emptyForm = {
    journalDate: new Date().toISOString().split("T")[0],
    description: "",
    referenceNumber: "",
    journalSource: "Manual",
    sourceId: "",
    lines: [
      {
        chartOfAccountId: "",
        description: "",
        debitAmount: 0,
        creditAmount: 0,
      },
      {
        chartOfAccountId: "",
        description: "",
        debitAmount: 0,
        creditAmount: 0,
      },
    ],
  };

  if (loading)
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-44 bg-muted/60 rounded animate-pulse mb-1" />
          <div className="h-4 w-72 bg-muted/40 rounded animate-pulse" />
        </div>
        <StatsSkeleton stats={3} showChart={false} />
        <TableSkeleton rows={8} cols={7} />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">
            Journal Entries
          </h2>
          <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">
            Accounting journal entries — the backbone of financial records
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" /> New Journal Entry
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Journals</p>
            <p className="text-2xl font-semibold mt-1">{totalJournals}</p>
          </CardContent>
        </Card>
        <Card className="">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Draft</p>
            <p className="text-2xl font-semibold mt-1 text-amber-500">
              {draftCount}
            </p>
          </CardContent>
        </Card>
        <Card className="">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Posted</p>
            <p className="text-2xl font-semibold mt-1 text-emerald-500">
              {postedCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search by journal number, description..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Input
          type="date"
          className="w-full sm:w-36"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
        />
        <Input
          type="date"
          className="w-full sm:w-36"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
        />
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Draft">Draft</SelectItem>
            <SelectItem value="Posted">Posted</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={sourceFilter}
          onValueChange={(v) => {
            setSourceFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {JOURNAL_SOURCES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(search ||
          dateFrom ||
          dateTo ||
          statusFilter !== "all" ||
          sourceFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setDateFrom("");
              setDateTo("");
              setStatusFilter("all");
              setSourceFilter("all");
              setPage(1);
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <Card className="">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-[#F7F8FA]">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Journal No.
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Date
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Description
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">
                  Source
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">
                  Type
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Status
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">
                  Debit
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">
                  Credit
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    <ClipboardList className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No journal entries found</p>
                  </td>
                </tr>
              ) : (
                paginated.map((j) => (
                  <tr
                    key={j.id}
                    className="border-b border-[rgba(17,24,39,0.04)] hover:bg-[#F7F8FA]/80 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                        {j.journalNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {j.journalDate}
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="truncate">{j.description}</p>
                      {j.referenceNumber && (
                        <p className="text-xs text-muted-foreground">
                          {j.referenceNumber}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <Badge variant="outline" className="font-normal text-xs">
                        {j.journalSource}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <Badge
                        variant="outline"
                        className={`font-normal text-xs ${j.journalType === "System" ? "bg-blue-500/10 text-blue-400 border-blue-500/30" : "bg-muted text-muted-foreground"}`}
                      >
                        {j.journalType === "System" ? "System" : "Manual"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          j.status === "Posted" ? "default" : "secondary"
                        }
                        className={`font-normal text-xs ${j.status === "Posted" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-amber-500/20 text-amber-400 border-amber-500/30"}`}
                      >
                        {j.status === "Posted" ? (
                          <Lock className="h-3 w-3 mr-1 inline" />
                        ) : null}
                        {j.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell font-medium">
                      {fmt(j.totalDebit)}
                    </td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell font-medium">
                      {fmt(j.totalCredit)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="View"
                          onClick={() => {
                            setViewItem(j);
                            setViewOpen(true);
                          }}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                        {j.status === "Draft" && j.journalType !== "System" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Edit"
                              onClick={() => {
                                setEditing(j);
                                setOpen(true);
                              }}
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-emerald-500 hover:text-emerald-600"
                              title="Post Journal"
                              onClick={() => setPostTarget(j)}
                            >
                              <Send className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-rose-400 hover:text-rose-500"
                              title="Delete"
                              onClick={() => setDeleteTarget(j)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Showing {(safePage - 1) * PAGE_SIZE_JE + 1}–
              {Math.min(safePage * PAGE_SIZE_JE, filtered.length)} of{" "}
              {filtered.length}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={safePage === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2"
                disabled={safePage === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Create / Edit Modal */}
      <JournalEntryModal
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditing(null);
        }}
        initial={editing || emptyForm}
        coaAccounts={coaAccounts}
        onSave={save}
      />

      {/* View Modal */}
      <JournalEntryViewModal
        open={viewOpen}
        onOpenChange={setViewOpen}
        item={viewItem}
      />

      {/* Post Confirmation */}
      <AlertDialog
        open={!!postTarget}
        onOpenChange={(v) => !v && setPostTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Post Journal Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to post{" "}
              <strong>{postTarget?.journalNumber}</strong>? Once posted, this
              entry will be locked and cannot be edited or deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={confirmPost}
            >
              Post Journal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Journal Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{deleteTarget?.journalNumber}</strong>? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-500 hover:bg-rose-600"
              onClick={confirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function JournalEntryModal({
  open,
  onOpenChange,
  initial,
  coaAccounts,
  onSave,
}) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(initial);
    setErrors({});
  }, [initial, open]);

  const updateHeader = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: null }));
  };

  const updateLine = (idx, k, v) => {
    setForm((f) => {
      const lines = [...f.lines];
      lines[idx] = { ...lines[idx], [k]: v };
      // Enforce: if debit set, clear credit; if credit set, clear debit
      if (k === "debitAmount" && Number(v) > 0) lines[idx].creditAmount = 0;
      if (k === "creditAmount" && Number(v) > 0) lines[idx].debitAmount = 0;
      return { ...f, lines };
    });
    if (errors[`line_${idx}`])
      setErrors((e) => ({ ...e, [`line_${idx}`]: null }));
  };

  const addLine = () => {
    setForm((f) => ({
      ...f,
      lines: [
        ...f.lines,
        {
          chartOfAccountId: "",
          description: "",
          debitAmount: 0,
          creditAmount: 0,
        },
      ],
    }));
  };

  const removeLine = (idx) => {
    if (form.lines.length <= 2) return;
    setForm((f) => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }));
  };

  const totalDebit = (form.lines || []).reduce(
    (s, l) => s + (Number(l.debitAmount) || 0),
    0,
  );
  const totalCredit = (form.lines || []).reduce(
    (s, l) => s + (Number(l.creditAmount) || 0),
    0,
  );
  const isBalanced =
    Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const validate = () => {
    const errs = {};
    if (!form.journalDate) errs.journalDate = "Journal date is required";
    if (!form.description?.trim()) errs.description = "Description is required";
    if (!form.journalSource) errs.journalSource = "Journal source is required";
    if ((form.lines || []).length < 2) errs.lines = "Minimum 2 lines required";
    (form.lines || []).forEach((l, i) => {
      if (!l.chartOfAccountId) errs[`line_${i}`] = "Account is required";
    });
    if (!isBalanced && totalDebit > 0)
      errs.balance = "Total debit must equal total credit";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    await onSave({
      journalDate: form.journalDate,
      description: form.description.trim(),
      referenceNumber: form.referenceNumber?.trim() || "",
      journalSource: form.journalSource,
      sourceId: form.sourceId?.trim() || "",
      lines: form.lines.map((l) => ({
        chartOfAccountId: l.chartOfAccountId,
        description: l.description?.trim() || "",
        debitAmount: Number(l.debitAmount) || 0,
        creditAmount: Number(l.creditAmount) || 0,
      })),
    });
    setSaving(false);
  };

  const isEdit = !!initial?.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Journal Entry" : "New Journal Entry"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this draft journal entry"
              : "Create a new accounting journal entry"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Header Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>
                Journal Date <span className="text-rose-400">*</span>
              </Label>
              <Input
                type="date"
                value={form.journalDate || ""}
                onChange={(e) => updateHeader("journalDate", e.target.value)}
                className={errors.journalDate ? "border-rose-500" : ""}
              />
              {errors.journalDate && (
                <p className="text-xs text-rose-400">{errors.journalDate}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>
                Journal Source <span className="text-rose-400">*</span>
              </Label>
              <Select
                value={form.journalSource || "Manual"}
                onValueChange={(v) => updateHeader("journalSource", v)}
              >
                <SelectTrigger
                  className={errors.journalSource ? "border-rose-500" : ""}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JOURNAL_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.journalSource && (
                <p className="text-xs text-rose-400">{errors.journalSource}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>
              Description <span className="text-rose-400">*</span>
            </Label>
            <Textarea
              value={form.description || ""}
              onChange={(e) => updateHeader("description", e.target.value)}
              placeholder="e.g. Monthly salary payment, June 2026"
              rows={2}
              className={errors.description ? "border-rose-500" : ""}
            />
            {errors.description && (
              <p className="text-xs text-rose-400">{errors.description}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Reference Number</Label>
              <Input
                value={form.referenceNumber || ""}
                onChange={(e) =>
                  updateHeader("referenceNumber", e.target.value)
                }
                placeholder="e.g. INV-001 (optional)"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Source ID</Label>
              <Input
                value={form.sourceId || ""}
                onChange={(e) => updateHeader("sourceId", e.target.value)}
                placeholder="System source reference (optional)"
              />
            </div>
          </div>

          {/* Lines */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                Journal Lines <span className="text-rose-400">*</span>
              </Label>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={addLine}
              >
                <Plus className="h-3 w-3" /> Add Line
              </Button>
            </div>
            {errors.lines && (
              <p className="text-xs text-rose-400">{errors.lines}</p>
            )}
            {errors.balance && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-rose-500/10 border border-rose-500/30">
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                <p className="text-xs text-rose-400">{errors.balance}</p>
              </div>
            )}

            <div className="rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-[#F7F8FA]">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Account <span className="text-rose-400">*</span>
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground hidden sm:table-cell">
                        Description
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground w-32">
                        Debit
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground w-32">
                        Credit
                      </th>
                      <th className="px-3 py-2 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {(form.lines || []).map((line, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-[rgba(17,24,39,0.04)] last:border-0"
                      >
                        <td className="px-3 py-2 min-w-[180px]">
                          <Select
                            value={line.chartOfAccountId || ""}
                            onValueChange={(v) =>
                              updateLine(idx, "chartOfAccountId", v)
                            }
                          >
                            <SelectTrigger
                              className={`h-8 text-xs ${errors[`line_${idx}`] ? "border-rose-500" : ""}`}
                            >
                              <SelectValue placeholder="Select account..." />
                            </SelectTrigger>
                            <SelectContent>
                              {coaAccounts.map((c) => (
                                <SelectItem
                                  key={c.id}
                                  value={c.id}
                                  className="text-xs"
                                >
                                  {c.accountCode} — {c.accountName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {errors[`line_${idx}`] && (
                            <p className="text-[10px] text-rose-400 mt-0.5">
                              {errors[`line_${idx}`]}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2 hidden sm:table-cell">
                          <Input
                            className="h-8 text-xs"
                            value={line.description || ""}
                            onChange={(e) =>
                              updateLine(idx, "description", e.target.value)
                            }
                            placeholder="Optional note"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <NumberInput
                            value={line.debitAmount || 0}
                            onChange={(v) => updateLine(idx, "debitAmount", v)}
                            min={0}
                            className="h-8 text-xs text-right"
                            placeholder="0"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <NumberInput
                            value={line.creditAmount || 0}
                            onChange={(v) => updateLine(idx, "creditAmount", v)}
                            min={0}
                            className="h-8 text-xs text-right"
                            placeholder="0"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-rose-400"
                            disabled={form.lines.length <= 2}
                            onClick={() => removeLine(idx)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border bg-[#F7F8FA]">
                      <td
                        colSpan={2}
                        className="px-3 py-2 text-right text-xs font-medium text-muted-foreground hidden sm:table-cell"
                      >
                        Total
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span
                          className={`text-sm font-semibold ${totalDebit > 0 ? "text-foreground" : "text-muted-foreground"}`}
                        >
                          {fmt(totalDebit)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span
                          className={`text-sm font-semibold ${totalCredit > 0 ? "text-foreground" : "text-muted-foreground"}`}
                        >
                          {fmt(totalCredit)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {totalDebit > 0 && isBalanced && (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                        )}
                        {totalDebit > 0 && !isBalanced && (
                          <AlertTriangle className="h-4 w-4 text-rose-400 mx-auto" />
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {totalDebit > 0 && (
              <p
                className={`text-xs ${isBalanced ? "text-emerald-500" : "text-rose-400"}`}
              >
                {isBalanced
                  ? "Balanced — debit equals credit"
                  : `Difference: ${fmt(Math.abs(totalDebit - totalCredit))}`}
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isEdit ? "Save Changes" : "Create Journal Entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function JournalEntryViewModal({ open, onOpenChange, item }) {
  if (!item) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Journal Entry Detail</DialogTitle>
          <DialogDescription>
            <span className="font-mono">{item.journalNumber}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Header Info */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {[
              { label: "Journal Number", value: item.journalNumber },
              { label: "Journal Date", value: item.journalDate },
              { label: "Source", value: item.journalSource },
              {
                label: "Journal Type",
                value:
                  item.journalType === "System" ? "System Generated" : "Manual",
              },
              { label: "Status", value: item.status },
              { label: "Reference Number", value: item.referenceNumber || "—" },
              { label: "Source ID", value: item.sourceId || "—" },
              { label: "Created By", value: item.createdBy || "—" },
              {
                label: "Created At",
                value: item.createdAt
                  ? new Date(item.createdAt).toLocaleString("id-ID")
                  : "—",
              },
            ].map((r) => (
              <div
                key={r.label}
                className="py-1 border-b border-[rgba(17,24,39,0.04)] last:border-0"
              >
                <p className="text-xs text-muted-foreground">{r.label}</p>
                <p className="font-medium mt-0.5">{r.value}</p>
              </div>
            ))}
          </div>

          <div className="py-1 border-b border-[rgba(17,24,39,0.04)]">
            <p className="text-xs text-muted-foreground">Description</p>
            <p className="font-medium mt-0.5 text-sm">{item.description}</p>
          </div>

          {/* Lines */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Journal Lines</p>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-[#F7F8FA]">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Account
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground hidden sm:table-cell">
                      Description
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      Debit
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      Credit
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(item.lines || []).map((line, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-[rgba(17,24,39,0.04)] last:border-0"
                    >
                      <td className="px-3 py-2">
                        <p className="text-xs text-muted-foreground">
                          {line.chartOfAccount?.accountCode}
                        </p>
                        <p>{line.chartOfAccount?.accountName}</p>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                        {line.description || "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        {line.debitAmount > 0 ? fmt(line.debitAmount) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        {line.creditAmount > 0 ? fmt(line.creditAmount) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-[#F7F8FA]">
                    <td
                      colSpan={2}
                      className="px-3 py-2 text-right text-xs font-medium text-muted-foreground hidden sm:table-cell"
                    >
                      Total
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {fmt(item.totalDebit)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {fmt(item.totalCredit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =========== GENERAL LEDGER ===========
function GeneralLedgerModule({ initialAccountId, onAccountConsumed }) {
  const [coaAccounts, setCoaAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState(
    initialAccountId || "",
  );
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [ledgerData, setLedgerData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewJournal, setViewJournal] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);

  useEffect(() => {
    api.get("chartofaccounts").then((data) => {
      setCoaAccounts(
        Array.isArray(data)
          ? data.filter((c) => c.allowTransaction && c.isActive)
          : [],
      );
    });
  }, []);

  useEffect(() => {
    if (initialAccountId) {
      setSelectedAccountId(initialAccountId);
      if (onAccountConsumed) onAccountConsumed();
    }
  }, [initialAccountId]);

  const loadLedger = async () => {
    if (!selectedAccountId) return;
    setLoading(true);
    const params = new URLSearchParams({ accountId: selectedAccountId });
    if (dateFrom) params.append("from", dateFrom);
    if (dateTo) params.append("to", dateTo);
    if (search.trim()) params.append("search", search.trim());
    const data = await api.get("generalledger?" + params.toString());
    setLedgerData(data?.error ? null : data);
    setLoading(false);
  };

  useEffect(() => {
    if (selectedAccountId) {
      loadLedger();
    } else {
      setLedgerData(null);
    }
  }, [selectedAccountId, dateFrom, dateTo, search]);

  const viewJournalEntry = async (journalEntryId) => {
    const data = await api.get("journalentries/" + journalEntryId);
    if (!data?.error) {
      setViewJournal(data);
      setViewOpen(true);
    } else {
      toast.error("Could not load journal entry");
    }
  };

  const selectedAccount = coaAccounts.find((c) => c.id === selectedAccountId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">
            General Ledger
          </h2>
          <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">
            Account-level transaction history from posted journal entries
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5 lg:col-span-1">
              <Label>
                Account <span className="text-rose-400">*</span>
              </Label>
              <Select
                value={selectedAccountId}
                onValueChange={setSelectedAccountId}
              >
                <SelectTrigger
                  className={!selectedAccountId ? "border-amber-500/50" : ""}
                >
                  <SelectValue placeholder="Select an account..." />
                </SelectTrigger>
                <SelectContent>
                  {coaAccounts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.accountCode} — {c.accountName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>From Date</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>To Date</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Description or journal no."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
          {!selectedAccountId && (
            <p className="text-xs text-amber-500 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Select an account to
              load ledger data
            </p>
          )}
          {(dateFrom || dateTo || search) && selectedAccountId && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setSearch("");
              }}
            >
              Clear filters
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {ledgerData && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              label: "Opening Balance",
              value: fmt(ledgerData.openingBalance),
              cls: "text-foreground",
            },
            {
              label: "Total Debit",
              value: fmt(ledgerData.totalDebit),
              cls: "text-blue-400",
            },
            {
              label: "Total Credit",
              value: fmt(ledgerData.totalCredit),
              cls: "text-orange-400",
            },
            {
              label: "Closing Balance",
              value: fmt(Math.abs(ledgerData.closingBalance)),
              cls:
                ledgerData.closingBalance >= 0
                  ? "text-emerald-500"
                  : "text-rose-400",
              suffix: ledgerData.closingBalance < 0 ? " (Cr)" : "",
            },
          ].map((s) => (
            <Card key={s.label} className="">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-xl font-semibold mt-1 ${s.cls}`}>
                  {s.value}
                  {s.suffix && (
                    <span className="text-xs ml-1 font-normal text-muted-foreground">
                      {s.suffix}
                    </span>
                  )}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Account Info Banner */}
      {selectedAccount && ledgerData && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 rounded-lg border bg-[#F7F8FA] text-sm">
          <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium">
            {selectedAccount.accountCode} — {selectedAccount.accountName}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            {selectedAccount.accountType}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            Normal Balance: {selectedAccount.normalBalance}
          </span>
          <span className="ml-auto text-xs text-muted-foreground">
            {ledgerData.lines.length} transaction
            {ledgerData.lines.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Ledger Table / States */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Loading ledger...
          </span>
        </div>
      ) : !selectedAccountId ? (
        <Card className="">
          <div className="py-20 text-center text-muted-foreground">
            <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">
              Select an account to view the general ledger
            </p>
          </div>
        </Card>
      ) : ledgerData && ledgerData.lines.length === 0 ? (
        <Card className="">
          <div className="py-16 text-center text-muted-foreground">
            <ClipboardList className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">
              No posted transactions for this account
              {(dateFrom || dateTo || search) && " in the selected range"}
            </p>
          </div>
        </Card>
      ) : ledgerData ? (
        <Card className="">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-[#F7F8FA]">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                    Date
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                    Journal No.
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell whitespace-nowrap">
                    Source
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell whitespace-nowrap">
                    Reference
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Description
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                    Debit
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                    Credit
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                    Balance
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {ledgerData.lines.map((line) => (
                  <tr
                    key={line.id}
                    className="border-b border-[rgba(17,24,39,0.04)] hover:bg-[#F7F8FA]/80 transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      {line.journalDate}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                        {line.journalNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <Badge variant="outline" className="font-normal text-xs">
                        {line.journalSource}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell text-xs">
                      {line.referenceNumber || "—"}
                    </td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <p className="truncate">{line.description}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-blue-400">
                      {line.debitAmount > 0 ? fmt(line.debitAmount) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-orange-400">
                      {line.creditAmount > 0 ? fmt(line.creditAmount) : "—"}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${
                        line.runningBalance >= 0 ? "" : "text-rose-400"
                      }`}
                    >
                      {fmt(Math.abs(line.runningBalance))}
                      {line.runningBalance < 0 && (
                        <span className="text-xs text-rose-400 ml-1">Cr</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="View Journal Entry"
                        onClick={() => viewJournalEntry(line.journalEntryId)}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-[#F7F8FA] font-semibold">
                  <td
                    colSpan={5}
                    className="px-4 py-3 text-right text-xs font-medium text-muted-foreground hidden sm:table-cell"
                  >
                    Totals
                  </td>
                  <td className="px-4 py-3 text-right text-blue-400">
                    {fmt(ledgerData.totalDebit)}
                  </td>
                  <td className="px-4 py-3 text-right text-orange-400">
                    {fmt(ledgerData.totalCredit)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right whitespace-nowrap ${
                      ledgerData.closingBalance >= 0
                        ? "text-emerald-500"
                        : "text-rose-400"
                    }`}
                  >
                    {fmt(Math.abs(ledgerData.closingBalance))}
                    {ledgerData.closingBalance < 0 && (
                      <span className="text-xs ml-1">Cr</span>
                    )}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      ) : null}

      {/* Journal Entry View Modal */}
      <JournalEntryViewModal
        open={viewOpen}
        onOpenChange={setViewOpen}
        item={viewJournal}
      />
    </div>
  );
}

// =========== TRIAL BALANCE ===========
function TrialBalanceModule({ onNavigateToLedger }) {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const today = now.toISOString().split("T")[0];

  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateFrom) params.append("from", dateFrom);
    if (dateTo) params.append("to", dateTo);
    const result = await api.get("trialbalance?" + params.toString());
    setData(result?.error ? null : result);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [dateFrom, dateTo]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">
            Trial Balance
          </h2>
          <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">
            Summarized debit and credit balances from posted journal entries
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled
            title="Export PDF (coming soon)"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled
            title="Export Excel (coming soon)"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label>Date From</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date To</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-40"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs"
              onClick={() => {
                setDateFrom(firstOfMonth);
                setDateTo(today);
              }}
            >
              Reset to Current Month
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Out of Balance Warning */}
      {data && !data.isBalanced && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-400">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold text-sm">
              Trial Balance Out of Balance
            </p>
            <p className="text-xs mt-0.5 text-rose-400/80">
              Difference of {fmt(data.difference)} detected. Check posted
              journal entries for errors.
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Total Debit
              </p>
              <p className="text-xl font-semibold text-blue-400 mt-1">
                {fmt(data.totalDebit)}
              </p>
            </CardContent>
          </Card>
          <Card className="">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Total Credit
              </p>
              <p className="text-xl font-semibold text-orange-400 mt-1">
                {fmt(data.totalCredit)}
              </p>
            </CardContent>
          </Card>
          <Card className={`${!data.isBalanced ? "border-rose-500/40" : ""}`}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Difference
              </p>
              <p
                className={`text-xl font-semibold mt-1 ${data.isBalanced ? "text-emerald-500" : "text-rose-400"}`}
              >
                {data.isBalanced ? "Balanced" : fmt(data.difference)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Calculating trial balance...
          </span>
        </div>
      ) : data && data.rows.length === 0 ? (
        <Card className="">
          <div className="py-20 text-center text-muted-foreground">
            <Scale className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">
              No posted journal entries found for the selected period
            </p>
          </div>
        </Card>
      ) : data ? (
        <Card className="">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-[#F7F8FA]">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                    Account Code
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Account Name
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell whitespace-nowrap">
                    Account Type
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                    Debit
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                    Credit
                  </th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[rgba(17,24,39,0.04)] hover:bg-[#F7F8FA]/80 transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                        {row.accountCode}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{row.accountName}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <Badge variant="outline" className="font-normal text-xs">
                        {row.accountType}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-blue-400">
                      {row.totalDebit > 0 ? fmt(row.totalDebit) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-orange-400">
                      {row.totalCredit > 0 ? fmt(row.totalCredit) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {onNavigateToLedger && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="View in General Ledger"
                          onClick={() => onNavigateToLedger(row.id)}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-[#F7F8FA] font-semibold">
                  <td
                    colSpan={3}
                    className="px-4 py-3 text-right text-xs font-medium text-muted-foreground"
                  >
                    Totals
                  </td>
                  <td className="px-4 py-3 text-right text-blue-400">
                    {fmt(data.totalDebit)}
                  </td>
                  <td className="px-4 py-3 text-right text-orange-400">
                    {fmt(data.totalCredit)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

// =========== PROFIT & LOSS ===========
function ProfitLossModule({ onNavigateToLedger }) {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const today = now.toISOString().split("T")[0];

  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateFrom) params.append("from", dateFrom);
    if (dateTo) params.append("to", dateTo);
    const result = await api.get("profitloss?" + params.toString());
    setData(result?.error ? null : result);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [dateFrom, dateTo]);

  const AccountTable = ({ rows, emptyLabel }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-[#F7F8FA]">
            <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
              Account Code
            </th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">
              Account Name
            </th>
            <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
              Amount
            </th>
            <th className="px-4 py-3 w-10" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={4}
                className="px-4 py-8 text-center text-sm text-muted-foreground"
              >
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-[rgba(17,24,39,0.04)] hover:bg-[#F7F8FA]/80 transition-colors"
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                    {row.accountCode}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium">{row.accountName}</td>
                <td className="px-4 py-3 text-right font-medium">
                  {fmt(Math.max(row.amount, 0))}
                </td>
                <td className="px-4 py-3">
                  {onNavigateToLedger && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="View in General Ledger"
                      onClick={() => onNavigateToLedger(row.id)}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">
            Profit &amp; Loss
          </h2>
          <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">
            Income statement based on posted journal entries
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled
            title="Export PDF (coming soon)"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled
            title="Export Excel (coming soon)"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label>Date From</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date To</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-40"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs"
              onClick={() => {
                setDateFrom(firstOfMonth);
                setDateTo(today);
              }}
            >
              Reset to Current Month
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Total Revenue
              </p>
              <p className="text-xl font-semibold text-emerald-500 mt-1">
                {fmt(data.totalRevenue)}
              </p>
            </CardContent>
          </Card>
          <Card className="">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Total Expenses
              </p>
              <p className="text-xl font-semibold text-rose-400 mt-1">
                {fmt(data.totalExpenses)}
              </p>
            </CardContent>
          </Card>
          <Card className={`${data.netProfit < 0 ? "border-rose-500/40" : ""}`}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Net Profit
              </p>
              <p
                className={`text-xl font-semibold mt-1 ${data.netProfit >= 0 ? "text-emerald-500" : "text-rose-400"}`}
              >
                {data.netProfit < 0 ? "-" : ""}
                {fmt(Math.abs(data.netProfit))}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Generating report...
          </span>
        </div>
      ) : data ? (
        <div className="space-y-4">
          {/* Revenue Section */}
          <Card className="">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  Revenue
                </CardTitle>
                <span className="text-sm font-semibold text-emerald-500">
                  {fmt(data.totalRevenue)}
                </span>
              </div>
            </CardHeader>
            <AccountTable
              rows={data.revenueRows}
              emptyLabel="No revenue accounts with posted transactions"
            />
            <div className="border-t border-border bg-[#F7F8FA] px-4 py-2.5 flex justify-between text-sm font-semibold">
              <span className="text-muted-foreground">Total Revenue</span>
              <span className="text-emerald-500">{fmt(data.totalRevenue)}</span>
            </div>
          </Card>

          {/* Expense Section */}
          <Card className="">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-rose-400" />
                  Expenses
                </CardTitle>
                <span className="text-sm font-semibold text-rose-400">
                  {fmt(data.totalExpenses)}
                </span>
              </div>
            </CardHeader>
            <AccountTable
              rows={data.expenseRows}
              emptyLabel="No expense accounts with posted transactions"
            />
            <div className="border-t border-border bg-[#F7F8FA] px-4 py-2.5 flex justify-between text-sm font-semibold">
              <span className="text-muted-foreground">Total Expenses</span>
              <span className="text-rose-400">{fmt(data.totalExpenses)}</span>
            </div>
          </Card>

          {/* Net Profit Row */}
          <Card
            className={`border-2 ${data.netProfit >= 0 ? "border-emerald-500/40 bg-emerald-500/5" : "border-rose-500/40 bg-rose-500/5"}`}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Net Profit / (Loss)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Total Revenue − Total Expenses
                  </p>
                </div>
                <p
                  className={`text-2xl font-bold ${data.netProfit >= 0 ? "text-emerald-500" : "text-rose-400"}`}
                >
                  {data.netProfit < 0 ? "-" : ""}
                  {fmt(Math.abs(data.netProfit))}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

// =========== BALANCE SHEET ===========
function BalanceSheetModule({ onNavigateToLedger, onNavigateToPL }) {
  const today = new Date().toISOString().split("T")[0];
  const [asOf, setAsOf] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams({ asOf });
    const result = await api.get("balancesheet?" + params.toString());
    setData(result?.error ? null : result);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [asOf]);

  const SectionTable = ({ rows, emptyLabel, balanceColor }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-[#F7F8FA]">
            <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
              Account Code
            </th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">
              Account Name
            </th>
            <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
              Balance
            </th>
            <th className="px-4 py-3 w-10" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            emptyLabel ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  {emptyLabel}
                </td>
              </tr>
            ) : null
          ) : (
            rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-[rgba(17,24,39,0.04)] hover:bg-[#F7F8FA]/80 transition-colors"
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                    {row.accountCode}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium">{row.accountName}</td>
                <td
                  className={`px-4 py-3 text-right font-medium ${balanceColor}`}
                >
                  {fmt(row.balance)}
                </td>
                <td className="px-4 py-3">
                  {onNavigateToLedger && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="View in General Ledger"
                      onClick={() => onNavigateToLedger(row.id)}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">
            Balance Sheet
          </h2>
          <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">
            Financial position report based on posted journal entries
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled
            title="Export PDF (coming soon)"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled
            title="Export Excel (coming soon)"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Filter */}
      <Card className="">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label>As Of Date</Label>
              <Input
                type="date"
                value={asOf}
                onChange={(e) => setAsOf(e.target.value)}
                className="w-44"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs"
              onClick={() => setAsOf(today)}
            >
              Reset to Today
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Accounting equation warning */}
      {data && !data.isBalanced && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-400">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold text-sm">
              Balance Sheet Out of Balance
            </p>
            <p className="text-xs mt-0.5 text-rose-400/80">
              Assets ≠ Liabilities + Equity · Difference: {fmt(data.difference)}
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Total Assets
              </p>
              <p className="text-xl font-semibold text-blue-400 mt-1">
                {fmt(data.totalAssets)}
              </p>
            </CardContent>
          </Card>
          <Card className="">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Total Liabilities
              </p>
              <p className="text-xl font-semibold text-rose-400 mt-1">
                {fmt(data.totalLiabilities)}
              </p>
            </CardContent>
          </Card>
          <Card className={`${data.isBalanced ? "" : "border-rose-500/40"}`}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Total Equity
              </p>
              <p className="text-xl font-semibold text-emerald-500 mt-1">
                {fmt(data.totalEquity)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Generating balance sheet...
          </span>
        </div>
      ) : data ? (
        <div className="space-y-4">
          {/* Assets */}
          <Card className="">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-blue-400" />
                  Assets
                </CardTitle>
                <span className="text-sm font-semibold text-blue-400">
                  {fmt(data.totalAssets)}
                </span>
              </div>
            </CardHeader>
            <SectionTable
              rows={data.assetRows}
              emptyLabel="No asset accounts configured"
              balanceColor="text-blue-400"
            />
            <div className="border-t border-border bg-[#F7F8FA] px-4 py-2.5 flex justify-between text-sm font-semibold">
              <span className="text-muted-foreground">Total Assets</span>
              <span className="text-blue-400">{fmt(data.totalAssets)}</span>
            </div>
          </Card>

          {/* Liabilities */}
          <Card className="">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-rose-400" />
                  Liabilities
                </CardTitle>
                <span className="text-sm font-semibold text-rose-400">
                  {fmt(data.totalLiabilities)}
                </span>
              </div>
            </CardHeader>
            <SectionTable
              rows={data.liabilityRows}
              emptyLabel="No liability accounts configured"
              balanceColor="text-rose-400"
            />
            <div className="border-t border-border bg-[#F7F8FA] px-4 py-2.5 flex justify-between text-sm font-semibold">
              <span className="text-muted-foreground">Total Liabilities</span>
              <span className="text-rose-400">
                {fmt(data.totalLiabilities)}
              </span>
            </div>
          </Card>

          {/* Equity */}
          <Card className="">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  Equity
                </CardTitle>
                <span className="text-sm font-semibold text-emerald-500">
                  {fmt(data.totalEquity)}
                </span>
              </div>
            </CardHeader>
            <SectionTable
              rows={data.equityRows}
              emptyLabel={null}
              balanceColor="text-emerald-500"
            />
            {/* Current Year Earnings — auto-calculated from P&L, not a journal entry */}
            <div className="border-b border-[rgba(17,24,39,0.04)] hover:bg-[#F7F8FA]/80 transition-colors">
              <div className="grid grid-cols-[auto_1fr_auto_auto] items-center px-4 py-3 gap-2 text-sm">
                <span className="font-mono text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded whitespace-nowrap">
                  Auto
                </span>
                <span className="font-medium">
                  Current Year Earnings
                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                    (Revenue − Expenses)
                  </span>
                </span>
                <span
                  className={`text-right font-medium ${data.currentYearEarnings >= 0 ? "text-emerald-500" : "text-rose-400"}`}
                >
                  {data.currentYearEarnings < 0 ? "-" : ""}
                  {fmt(Math.abs(data.currentYearEarnings))}
                </span>
                <span className="pl-2">
                  {onNavigateToPL && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="View Profit & Loss"
                      onClick={onNavigateToPL}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </span>
              </div>
            </div>
            <div className="border-t-2 border-border bg-[#F7F8FA] px-4 py-2.5 flex justify-between text-sm font-semibold">
              <span className="text-muted-foreground">Total Equity</span>
              <span className="text-emerald-500">{fmt(data.totalEquity)}</span>
            </div>
          </Card>

          {/* Accounting Equation Summary */}
          <Card
            className={`border-2 ${data.isBalanced ? "border-emerald-500/40 bg-emerald-500/5" : "border-rose-500/40 bg-rose-500/5"}`}
          >
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Accounting Equation
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Assets = Liabilities + Equity
                  </p>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-0.5">
                      Assets
                    </p>
                    <p className="font-semibold text-blue-400">
                      {fmt(data.totalAssets)}
                    </p>
                  </div>
                  <span className="text-muted-foreground font-medium">=</span>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-0.5">
                      Liabilities + Equity
                    </p>
                    <p className="font-semibold">
                      {fmt(data.totalLiabilities + data.totalEquity)}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      data.isBalanced
                        ? "border-emerald-500/40 text-emerald-500"
                        : "border-rose-500/40 text-rose-400"
                    }
                  >
                    {data.isBalanced ? "Balanced" : "Out of Balance"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

// =========== SUPPLIER MASTER ===========

function SupplierFormDialog({ open, onOpenChange, initial, onSave }) {
  const empty = {
    supplierName: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    province: "",
    country: "Indonesia",
    leadTimeDays: 0,
    notes: "",
    status: "Active",
  };
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setForm(initial ? { ...empty, ...initial } : empty);
  }, [initial, open]);
  const up = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const SH = ({ children }) => (
    <div className="col-span-2 pt-2">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground border-b pb-1.5">
        {children}
      </p>
    </div>
  );

  const submit = async () => {
    if (!form.supplierName?.trim()) {
      toast.error("Supplier name is required");
      return;
    }
    setLoading(true);
    try {
      await onSave(form);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initial?.id ? "Edit Supplier" : "Add Supplier"}
          </DialogTitle>
          <DialogDescription>Manage supplier master data</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <SH>Supplier Information</SH>
          <div className="space-y-2 col-span-2">
            <Label>
              Supplier Name <span className="text-rose-500">*</span>
            </Label>
            <Input
              value={form.supplierName || ""}
              onChange={(e) => up("supplierName", e.target.value)}
              placeholder="e.g. PT. Bahan Baku Indonesia"
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.status || "Active"}
              onValueChange={(v) => up("status", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Lead Time (days)</Label>
            <Input
              type="number"
              min="0"
              value={form.leadTimeDays || 0}
              onChange={(e) => up("leadTimeDays", Number(e.target.value))}
              placeholder="0"
            />
          </div>

          <SH>Contact Information</SH>
          <div className="space-y-2">
            <Label>Contact Person</Label>
            <Input
              value={form.contactPerson || ""}
              onChange={(e) => up("contactPerson", e.target.value)}
              placeholder="Full name"
            />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input
              value={form.phone || ""}
              onChange={(e) => up("phone", e.target.value)}
              placeholder="+62..."
            />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email || ""}
              onChange={(e) => up("email", e.target.value)}
              placeholder="supplier@example.com"
            />
          </div>

          <SH>Address</SH>
          <div className="space-y-2 col-span-2">
            <Label>Street Address</Label>
            <Input
              value={form.address || ""}
              onChange={(e) => up("address", e.target.value)}
              placeholder="Jl. ..."
            />
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Input
              value={form.city || ""}
              onChange={(e) => up("city", e.target.value)}
              placeholder="Jakarta"
            />
          </div>
          <div className="space-y-2">
            <Label>Province</Label>
            <Input
              value={form.province || ""}
              onChange={(e) => up("province", e.target.value)}
              placeholder="DKI Jakarta"
            />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Country</Label>
            <Input
              value={form.country || "Indonesia"}
              onChange={(e) => up("country", e.target.value)}
              placeholder="Indonesia"
            />
          </div>

          <SH>Notes</SH>
          <div className="space-y-2 col-span-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes || ""}
              onChange={(e) => up("notes", e.target.value)}
              placeholder="Internal notes…"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={loading || !form.supplierName?.trim()}
          >
            {loading
              ? "Saving…"
              : initial?.id
                ? "Save Changes"
                : "Add Supplier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SupplierDetailDialog({ open, onOpenChange, supplier, onEdit }) {
  if (!supplier) return null;
  const statusColor =
    (supplier.status || "Active") === "Active"
      ? "bg-emerald-500/10 text-emerald-600"
      : "bg-gray-400/10 text-gray-500";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div>
              <DialogTitle className="text-lg">
                {supplier.supplierName}
              </DialogTitle>
              <p className="text-sm text-muted-foreground font-mono mt-0.5">
                {supplier.supplierCode}
              </p>
            </div>
            <span
              className={`ml-auto inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${statusColor}`}
            >
              {supplier.status || "Active"}
            </span>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Supplier Information */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground border-b pb-1.5 mb-3">
              Supplier Information
            </p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Code:</span>{" "}
                <span className="font-mono ml-2">{supplier.supplierCode}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Lead Time:</span>{" "}
                <span className="ml-2">{supplier.leadTimeDays || 0} days</span>
              </div>
            </div>
            {supplier.notes && (
              <p className="text-sm text-muted-foreground mt-3 italic">
                "{supplier.notes}"
              </p>
            )}
          </div>

          {/* Contact Information */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground border-b pb-1.5 mb-3">
              Contact Information
            </p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Contact:</span>{" "}
                <span className="ml-2">{supplier.contactPerson || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Phone:</span>{" "}
                <span className="ml-2">{supplier.phone || "—"}</span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Email:</span>{" "}
                <span className="ml-2">{supplier.email || "—"}</span>
              </div>
            </div>
          </div>

          {/* Address */}
          {(supplier.address ||
            supplier.city ||
            supplier.province ||
            supplier.country) && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground border-b pb-1.5 mb-3">
                Address
              </p>
              <div className="text-sm space-y-1">
                {supplier.address && <p>{supplier.address}</p>}
                <p className="text-muted-foreground">
                  {[supplier.city, supplier.province, supplier.country]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
            </div>
          )}

          {/* Related Raw Materials */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground border-b pb-1.5 mb-3">
              Related Raw Materials{" "}
              {supplier.rawMaterials?.length
                ? `(${supplier.rawMaterials.length})`
                : ""}
            </p>
            {!supplier.rawMaterials?.length ? (
              <p className="text-sm text-muted-foreground italic">
                No raw materials linked to this supplier.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium text-muted-foreground text-xs uppercase">
                        Name
                      </th>
                      <th className="text-left py-2 font-medium text-muted-foreground text-xs uppercase">
                        Category
                      </th>
                      <th className="text-left py-2 font-medium text-muted-foreground text-xs uppercase">
                        Unit
                      </th>
                      <th className="text-right py-2 font-medium text-muted-foreground text-xs uppercase">
                        Stock
                      </th>
                      <th className="text-left py-2 font-medium text-muted-foreground text-xs uppercase">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplier.rawMaterials.map((rm) => (
                      <tr key={rm.id} className="border-b border-border/30">
                        <td className="py-2 font-medium">{rm.name}</td>
                        <td className="py-2 text-muted-foreground">
                          {rm.category || "—"}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {rm.unit || "—"}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {Number(rm.currentStock || 0).toLocaleString()}
                        </td>
                        <td className="py-2">
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded ${(rm.status || "Active") === "Active" ? "bg-emerald-500/10 text-emerald-600" : "bg-gray-400/10 text-gray-500"}`}
                          >
                            {rm.status || "Active"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              onEdit(supplier);
            }}
          >
            Edit Supplier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =========== BOM FORM DIALOG ===========
function BOMFormDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  products = [],
  rawMaterials = [],
}) {
  const empty = {
    productId: "",
    version: "1.0",
    description: "",
    status: "Active",
    items: [],
  };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (open) {
      setForm(
        initial
          ? {
              productId: initial.productId || "",
              version: initial.version || "1.0",
              description: initial.description || "",
              status: initial.status || "Active",
              items: (initial.items || []).map((it) => ({
                rawMaterialId: it.rawMaterialId || it.rawMaterial?.id || "",
                quantityRequired: it.quantityRequired ?? "",
                notes: it.notes || "",
              })),
            }
          : empty,
      );
      setErr("");
    }
  }, [open, initial]);

  const addItem = () =>
    setForm((f) => ({
      ...f,
      items: [
        ...f.items,
        { rawMaterialId: "", quantityRequired: "", notes: "" },
      ],
    }));

  const removeItem = (i) =>
    setForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const updateItem = (i, key, val) =>
    setForm((f) => {
      const items = [...f.items];
      items[i] = { ...items[i], [key]: val };
      return { ...f, items };
    });

  const handleSave = async () => {
    setErr("");
    if (!form.productId) {
      setErr("Product is required.");
      return;
    }
    if (form.items.length === 0) {
      setErr("At least one material is required.");
      return;
    }
    for (const it of form.items) {
      if (!it.rawMaterialId) {
        setErr("Select a raw material for each row.");
        return;
      }
      if (!it.quantityRequired || Number(it.quantityRequired) <= 0) {
        setErr("Quantity must be greater than zero.");
        return;
      }
    }
    setSaving(true);
    try {
      await onSave({
        ...form,
        items: form.items.map((it) => ({
          ...it,
          quantityRequired: Number(it.quantityRequired),
        })),
      });
      onOpenChange(false);
    } catch (e) {
      setErr(e.message || "Failed to save BOM.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit BOM" : "Create BOM"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          {err && (
            <div className="text-sm text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2">
              {err}
            </div>
          )}

          {/* Header */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Product *
              </label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.productId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, productId: e.target.value }))
                }
              >
                <option value="">— Select Product —</option>
                {products
                  .filter((p) => p.status === "Active")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Version
              </label>
              <input
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.version}
                onChange={(e) =>
                  setForm((f) => ({ ...f, version: e.target.value }))
                }
                placeholder="e.g. 1.0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Status
              </label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value }))
                }
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Description
              </label>
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm bg-background resize-none"
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Optional description…"
              />
            </div>
          </div>

          {/* Materials */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold">Materials</p>
              <Button
                size="sm"
                variant="outline"
                onClick={addItem}
                className="h-7 text-xs gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Add Material
              </Button>
            </div>
            {form.items.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-6 border-2 border-dashed rounded-lg">
                No materials yet. Click "Add Material" to start.
              </div>
            )}
            {form.items.map((it, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 mb-2 items-start">
                <div className="col-span-5">
                  <select
                    className="w-full border rounded-md px-2 py-1.5 text-sm bg-background"
                    value={it.rawMaterialId}
                    onChange={(e) =>
                      updateItem(i, "rawMaterialId", e.target.value)
                    }
                  >
                    <option value="">— Raw Material —</option>
                    {rawMaterials
                      .filter((r) => (r.status || "Active") === "Active")
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                          {r.unit ? ` (${r.unit})` : ""}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className="w-full border rounded-md px-2 py-1.5 text-sm bg-background"
                    placeholder="Qty"
                    value={it.quantityRequired}
                    onChange={(e) =>
                      updateItem(i, "quantityRequired", e.target.value)
                    }
                  />
                </div>
                <div className="col-span-4">
                  <input
                    className="w-full border rounded-md px-2 py-1.5 text-sm bg-background"
                    placeholder="Notes (optional)"
                    value={it.notes}
                    onChange={(e) => updateItem(i, "notes", e.target.value)}
                  />
                </div>
                <div className="col-span-1 flex justify-center pt-1">
                  <button
                    onClick={() => removeItem(i)}
                    className="text-rose-500 hover:text-rose-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            {form.items.length > 0 && (
              <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground px-1 mt-1">
                <div className="col-span-5">Raw Material</div>
                <div className="col-span-2">Qty Required</div>
                <div className="col-span-4">Notes</div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            {initial ? "Save Changes" : "Create BOM"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =========== BOM DETAIL DIALOG ===========
function BOMDetailDialog({ open, onOpenChange, bom, onEdit }) {
  if (!bom) return null;
  const statusColor =
    bom.status === "Active"
      ? "bg-emerald-100 text-emerald-700"
      : "bg-slate-100 text-slate-600";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-lg">{bom.bomCode}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {bom.product?.name} — v{bom.version}
              </p>
            </div>
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColor}`}
            >
              {bom.status}
            </span>
          </div>
        </DialogHeader>

        {/* BOM Info */}
        <div className="grid grid-cols-2 gap-3 text-sm py-2">
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-0.5">Product</p>
            <p className="font-medium">{bom.product?.name}</p>
            <p className="text-xs text-muted-foreground">{bom.product?.sku}</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-0.5">Version</p>
            <p className="font-medium">{bom.version}</p>
          </div>
          {bom.description && (
            <div className="col-span-2 bg-muted/40 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-0.5">
                Description
              </p>
              <p>{bom.description}</p>
            </div>
          )}
        </div>

        {/* Materials Table */}
        <div>
          <p className="text-sm font-semibold mb-2">
            Materials {bom.items?.length ? `(${bom.items.length})` : ""}
          </p>
          {!bom.items?.length ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No materials listed.
            </p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-xs text-muted-foreground">
                      #
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-xs text-muted-foreground">
                      Raw Material
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-xs text-muted-foreground">
                      Unit
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-xs text-muted-foreground">
                      Qty Required
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-xs text-muted-foreground">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {bom.items.map((it, i) => (
                    <tr key={it.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2 text-muted-foreground">
                        {i + 1}
                      </td>
                      <td className="px-4 py-2 font-medium">
                        {it.rawMaterial?.name || "—"}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {it.rawMaterial?.unit || "—"}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold">
                        {it.quantityRequired}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">
                        {it.notes || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              onEdit(bom);
            }}
          >
            <Edit3 className="h-4 w-4 mr-1" /> Edit BOM
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =========== PRODUCTION ORDER FORM DIALOG ===========
function ProductionOrderFormDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  products = [],
}) {
  const empty = {
    productId: "",
    plannedQuantity: "",
    plannedDate: "",
    notes: "",
  };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [activeBom, setActiveBom] = useState(null);
  const [bomLoading, setBomLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (initial) {
        setForm({
          productId: initial.productId || "",
          plannedQuantity: initial.plannedQuantity ?? "",
          plannedDate: initial.plannedDate || "",
          notes: initial.notes || "",
        });
        setActiveBom(initial.bom ? { ...initial.bom, items: [] } : null);
      } else {
        setForm(empty);
        setActiveBom(null);
      }
      setErr("");
    }
  }, [open, initial]);

  useEffect(() => {
    if (!form.productId || initial) {
      setActiveBom(initial?.bom ?? null);
      return;
    }
    setBomLoading(true);
    api
      .get(`productionorders/active-bom?productId=${form.productId}`)
      .then((b) => setActiveBom(b))
      .catch(() => setActiveBom(null))
      .finally(() => setBomLoading(false));
  }, [form.productId]);

  const handleSave = async () => {
    setErr("");
    if (!form.productId) {
      setErr("Product is required.");
      return;
    }
    if (!form.plannedQuantity || Number(form.plannedQuantity) <= 0) {
      setErr("Planned quantity must be greater than zero.");
      return;
    }
    if (!form.plannedDate) {
      setErr("Planned date is required.");
      return;
    }
    if (!activeBom && !initial) {
      setErr(
        "No Active BOM found for this product. Create and activate a BOM first.",
      );
      return;
    }
    setSaving(true);
    try {
      await onSave({ ...form, plannedQuantity: Number(form.plannedQuantity) });
      onOpenChange(false);
    } catch (e) {
      setErr(e.message || "Failed to save Production Order.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Edit Production Order" : "Create Production Order"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {err && (
            <div className="text-sm text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2">
              {err}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Product *
            </label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              value={form.productId}
              onChange={(e) =>
                setForm((f) => ({ ...f, productId: e.target.value }))
              }
              disabled={!!initial}
            >
              <option value="">— Select Product —</option>
              {products
                .filter((p) => p.status === "Active")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Active BOM
            </label>
            {bomLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Checking BOM…
              </div>
            ) : activeBom ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 text-sm">
                <span className="font-semibold text-emerald-700">
                  {activeBom.bomCode}
                </span>
                {activeBom.version && (
                  <span className="text-muted-foreground ml-2">
                    v{activeBom.version}
                  </span>
                )}
              </div>
            ) : form.productId ? (
              <div className="bg-rose-50 border border-rose-200 rounded-md px-3 py-2 text-sm text-rose-600">
                No Active BOM found. Create and activate a BOM for this product
                first.
              </div>
            ) : (
              <div className="bg-muted/50 rounded-md px-3 py-2 text-sm text-muted-foreground">
                Select a product to auto-detect its Active BOM.
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Planned Quantity *
              </label>
              <input
                type="number"
                min="1"
                step="any"
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                placeholder="e.g. 100"
                value={form.plannedQuantity}
                onChange={(e) =>
                  setForm((f) => ({ ...f, plannedQuantity: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Planned Date *
              </label>
              <input
                type="date"
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={form.plannedDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, plannedDate: e.target.value }))
                }
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Notes
            </label>
            <textarea
              className="w-full border rounded-md px-3 py-2 text-sm bg-background resize-none"
              rows={2}
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              placeholder="Optional notes…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || (!!form.productId && !activeBom && !initial)}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {initial ? "Save Changes" : "Create Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =========== COMPLETE PRODUCTION DIALOG ===========
function CompleteProductionDialog({ open, onOpenChange, order, onComplete }) {
  const [form, setForm] = useState({ actualQuantity: "", completionNotes: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (open) {
      setForm({
        actualQuantity: order?.plannedQuantity ?? "",
        completionNotes: "",
      });
      setErr("");
    }
  }, [open, order]);

  const handleComplete = async () => {
    setErr("");
    if (!form.actualQuantity || Number(form.actualQuantity) <= 0) {
      setErr("Actual quantity must be greater than zero.");
      return;
    }
    setSaving(true);
    try {
      await onComplete({
        actualQuantity: Number(form.actualQuantity),
        completionNotes: form.completionNotes,
      });
      onOpenChange(false);
    } catch (e) {
      setErr(e.message || "Failed to complete production.");
    } finally {
      setSaving(false);
    }
  };

  if (!order) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Production</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {order.productionOrderNumber} — {order.product?.name}
          </p>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {err && (
            <div className="text-sm text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2">
              {err}
            </div>
          )}
          <div className="bg-muted/40 rounded-lg p-3 text-sm">
            <p className="text-xs text-muted-foreground mb-1">This will:</p>
            <ul className="space-y-0.5 text-xs text-muted-foreground list-disc list-inside">
              <li>Deduct raw material stock based on BOM × actual quantity</li>
              <li>Increase product inventory by actual quantity</li>
              <li>
                Auto-create PRODUCTION_OUT + PRODUCTION_IN stock movements
              </li>
              <li>Lock this order as Completed</li>
            </ul>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Actual Quantity Produced *
            </label>
            <input
              type="number"
              min="1"
              step="any"
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              value={form.actualQuantity}
              onChange={(e) =>
                setForm((f) => ({ ...f, actualQuantity: e.target.value }))
              }
              placeholder="e.g. 100"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Planned: {order.plannedQuantity} units
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Completion Notes
            </label>
            <textarea
              className="w-full border rounded-md px-3 py-2 text-sm bg-background resize-none"
              rows={2}
              value={form.completionNotes}
              onChange={(e) =>
                setForm((f) => ({ ...f, completionNotes: e.target.value }))
              }
              placeholder="Optional notes about this production run…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleComplete}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Confirm & Complete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProductionOrderDetailDialog({
  open,
  onOpenChange,
  order,
  onEdit,
  onCancel,
  onStart,
  onComplete,
}) {
  if (!order) return null;

  const STATUS_COLOR = {
    Draft: "bg-slate-100 text-slate-600",
    Ready: "bg-emerald-100 text-emerald-700",
    "Not Ready": "bg-amber-100 text-amber-700",
    "In Production": "bg-blue-100 text-blue-700",
    Completed: "bg-indigo-100 text-indigo-700",
    Cancelled: "bg-rose-100 text-rose-600",
  };
  const statusColor =
    STATUS_COLOR[order.status] || "bg-slate-100 text-slate-600";
  const isLocked = order.status === "Completed" || order.status === "Cancelled";

  const fmtDate = (d) =>
    d
      ? new Date(d).toLocaleString("id-ID", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-lg">
                {order.productionOrderNumber}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {order.product?.name} — {order.bom?.bomCode} v
                {order.bom?.version}
              </p>
            </div>
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${statusColor}`}
            >
              {order.status}
            </span>
          </div>
        </DialogHeader>

        {/* Production Information */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Production Information
          </p>
          <div className="grid grid-cols-3 gap-3 text-sm">
            {[
              {
                label: "Product",
                val: order.product?.name,
                sub: order.product?.sku,
              },
              {
                label: "Planned Quantity",
                val: `${order.plannedQuantity?.toLocaleString()} units`,
              },
              {
                label: "Actual Quantity",
                val:
                  order.actualQuantity != null
                    ? `${order.actualQuantity.toLocaleString()} units`
                    : "—",
              },
              {
                label: "Planned Date",
                val: order.plannedDate
                  ? new Date(order.plannedDate).toLocaleDateString("id-ID")
                  : "—",
              },
              { label: "Started At", val: fmtDate(order.startedAt) },
              { label: "Completed At", val: fmtDate(order.completedAt) },
            ].map((c) => (
              <div key={c.label} className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-0.5">
                  {c.label}
                </p>
                <p className="font-semibold text-sm">{c.val}</p>
                {c.sub && (
                  <p className="text-xs text-muted-foreground">{c.sub}</p>
                )}
              </div>
            ))}
          </div>
          {order.notes && (
            <div className="bg-muted/40 rounded-lg px-3 py-2 text-sm mt-2">
              <span className="text-xs text-muted-foreground mr-2">Notes:</span>
              {order.notes}
            </div>
          )}
        </div>

        {/* Readiness banner — only for pre-production states */}
        {order.requirements?.length > 0 &&
          !["In Production", "Completed", "Cancelled"].includes(
            order.status,
          ) && (
            <div
              className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium ${order.isReady ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}
            >
              {order.isReady ? (
                <>
                  <CheckCircle2 className="h-4 w-4" /> All materials available —
                  Ready for production
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4" /> Some materials are
                  insufficient — Not Ready
                </>
              )}
            </div>
          )}

        {/* Material Requirements / Consumption table */}
        <div>
          <p className="text-sm font-semibold mb-2">
            {order.status === "Completed"
              ? "Material Consumption"
              : "Material Requirements"}
            {order.requirements?.length
              ? ` (${order.requirements.length} items)`
              : ""}
          </p>
          {!order.requirements?.length ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No material data available.
            </p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {order.status === "Completed"
                      ? [
                          "Raw Material",
                          "Unit",
                          "Required Qty",
                          "Consumed Qty",
                        ].map((h) => (
                          <th
                            key={h}
                            className={`px-3 py-2 text-xs font-medium text-muted-foreground ${h.endsWith("Qty") ? "text-right" : "text-left"}`}
                          >
                            {h}
                          </th>
                        ))
                      : [
                          "Raw Material",
                          "Unit",
                          "Required Qty",
                          "Current Stock",
                          "Shortage",
                          "Status",
                        ].map((h) => (
                          <th
                            key={h}
                            className={`px-3 py-2 text-xs font-medium text-muted-foreground ${["Required Qty", "Current Stock", "Shortage"].includes(h) ? "text-right" : "text-left"}`}
                          >
                            {h}
                          </th>
                        ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {order.requirements.map((r) => (
                    <tr key={r.rawMaterialId} className="hover:bg-muted/20">
                      <td className="px-3 py-2 font-medium">
                        {r.rawMaterial?.name}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.rawMaterial?.unit || "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {r.requiredQuantity.toLocaleString()}
                      </td>
                      {order.status === "Completed" ? (
                        <td className="px-3 py-2 text-right font-semibold text-rose-600">
                          {r.requiredQuantity.toLocaleString()}
                        </td>
                      ) : (
                        <>
                          <td className="px-3 py-2 text-right">
                            {r.currentStock.toLocaleString()}
                          </td>
                          <td
                            className={`px-3 py-2 text-right font-semibold ${r.shortage > 0 ? "text-rose-600" : "text-emerald-600"}`}
                          >
                            {r.shortage > 0
                              ? `-${r.shortage.toLocaleString()}`
                              : "—"}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.status === "Sufficient" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-600"}`}
                            >
                              {r.status}
                            </span>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Inventory Impact (Completed only) */}
        {order.status === "Completed" && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-indigo-800 mb-1">
              Inventory Impact
            </p>
            <p className="text-sm text-indigo-700">
              <span className="font-semibold">
                {order.actualQuantity?.toLocaleString()} units
              </span>{" "}
              of <span className="font-semibold">{order.product?.name}</span>{" "}
              added to product inventory.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 flex-wrap">
          {!isLocked && order.status !== "In Production" && (
            <Button
              variant="ghost"
              className="text-rose-500 hover:text-rose-600"
              onClick={() => {
                onOpenChange(false);
                onCancel(order);
              }}
            >
              Cancel Order
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {!isLocked && order.status !== "In Production" && (
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onEdit(order);
              }}
            >
              <Edit3 className="h-4 w-4 mr-1" /> Edit
            </Button>
          )}
          {order.status === "Ready" && (
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
              onClick={() => {
                onOpenChange(false);
                onStart(order);
              }}
            >
              <Activity className="h-4 w-4" /> Start Production
            </Button>
          )}
          {order.status === "In Production" && (
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              onClick={() => {
                onOpenChange(false);
                onComplete(order);
              }}
            >
              <PackageCheck className="h-4 w-4" /> Complete Production
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =========== PRODUCTION RESULTS MODULE ===========
function ProductionResultsModule() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [detailResult, setDetailResult] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = async (q) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      const term = q !== undefined ? q : search;
      if (term.trim()) qs.set("search", term.trim());
      const results = await api.get(
        "productionresults" + (qs.toString() ? "?" + qs.toString() : ""),
      );
      setItems(Array.isArray(results) ? results : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    load(search);
  };

  const openDetail = async (r) => {
    setDetailResult(null);
    setDetailLoading(true);
    setShowDetail(true);
    try {
      const detail = await api.get(`productionresults/${r.id}`);
      setDetailResult(detail);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load production result detail.");
    } finally {
      setDetailLoading(false);
    }
  };

  const SH = ({ children }) => (
    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground border-b pb-1.5 mb-3">
      {children}
    </p>
  );

  const po = detailResult?.productionOrder;
  const productionOuts =
    detailResult?.stockMovements?.filter(
      (m) => m.movementType === "PRODUCTION_OUT",
    ) || [];
  const productionIns =
    detailResult?.stockMovements?.filter(
      (m) => m.movementType === "PRODUCTION_IN",
    ) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight">
              Production Results
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 uppercase tracking-wider">
              Read-only
            </span>
          </div>
          <p className="text-sm text-[#5F6B7A] font-medium">
            Immutable audit records of completed production runs —
            auto-generated from Production Orders.
          </p>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg bg-background"
            placeholder="Search by result #, PO #, or product…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button type="submit" size="sm" variant="secondary">
          Search
        </Button>
      </form>

      {/* Table */}
      <div className="bg-background border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              {[
                "Result Number",
                "Production Order",
                "Product",
                "Produced Qty",
                "Completion Date",
                "",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left font-medium text-xs text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td
                  colSpan={6}
                  className="p-8 text-center text-muted-foreground text-sm"
                >
                  Loading production results…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center">
                  <ClipboardList className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-muted-foreground text-sm font-medium">
                    No production results found
                  </p>
                  <p className="text-muted-foreground/60 text-xs mt-1">
                    Production Results are automatically created when a
                    Production Order is completed.
                  </p>
                </td>
              </tr>
            ) : (
              items.map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => openDetail(r)}
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-bold text-indigo-700">
                      {r.resultNumber}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-blue-700">
                      {r.productionOrder?.productionOrderNumber}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">
                      {r.productionOrder?.product?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.productionOrder?.product?.sku}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-emerald-700">
                      {r.productionOrder?.actualQuantity?.toLocaleString() ??
                        "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {r.productionOrder?.completedAt
                      ? new Date(
                          r.productionOrder.completedAt,
                        ).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetail(r);
                      }}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Dialog */}
      <Dialog
        open={showDetail}
        onOpenChange={(v) => {
          setShowDetail(v);
          if (!v) setDetailResult(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-indigo-600" />
              {detailLoading
                ? "Loading…"
                : (detailResult?.resultNumber ?? "Production Result")}
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 ml-1 uppercase tracking-wider">
                Completed
              </span>
            </DialogTitle>
            <DialogDescription>
              Production Result — immutable audit record generated from a
              completed Production Order.
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              Loading detail…
            </div>
          ) : detailResult ? (
            <div className="space-y-6 pt-2">
              {/* Production Information */}
              <div>
                <SH>Production Information</SH>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Result Number</span>
                    <span className="font-mono font-bold text-indigo-700">
                      {detailResult.resultNumber}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">
                      Production Order
                    </span>
                    <span className="font-mono font-semibold text-blue-700">
                      {po?.productionOrderNumber}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Product</span>
                    <span className="font-medium">{po?.product?.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">BOM Version</span>
                    <span className="font-medium">
                      {po?.bom?.bomCode} v{po?.bom?.version}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">
                      Planned Quantity
                    </span>
                    <span className="font-semibold">
                      {po?.plannedQuantity?.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">
                      Actual Quantity
                    </span>
                    <span className="font-bold text-emerald-700">
                      {po?.actualQuantity?.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Started At</span>
                    <span className="text-xs text-right">
                      {po?.startedAt
                        ? new Date(po.startedAt).toLocaleString("en-GB")
                        : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Completed At</span>
                    <span className="text-xs text-right">
                      {po?.completedAt
                        ? new Date(po.completedAt).toLocaleString("en-GB")
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t" />

              {/* Material Consumption */}
              <div>
                <SH>Material Consumption</SH>
                {productionOuts.length > 0 ? (
                  <div className="space-y-2">
                    {productionOuts.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between text-sm bg-amber-50/60 border border-amber-100 rounded-lg px-3 py-2.5"
                      >
                        <div>
                          <span className="font-medium">
                            {m.rawMaterial?.name ?? "—"}
                          </span>
                          {m.rawMaterial?.unit && (
                            <span className="text-xs text-muted-foreground ml-1.5">
                              ({m.rawMaterial.unit})
                            </span>
                          )}
                        </div>
                        <span className="font-bold text-amber-700">
                          {m.quantity?.toLocaleString()} consumed
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No material consumption records found.
                  </p>
                )}
              </div>

              <div className="border-t" />

              {/* Inventory Impact */}
              <div>
                <SH>Inventory Impact</SH>
                {productionIns.length > 0 ? (
                  <div className="space-y-2">
                    {productionIns.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between text-sm bg-emerald-50/60 border border-emerald-100 rounded-lg px-3 py-2.5"
                      >
                        <div>
                          <span className="font-medium">
                            {m.product?.name ?? "—"}
                          </span>
                          {m.inventory && (
                            <span className="text-xs text-muted-foreground ml-2">
                              {m.inventory.color} / {m.inventory.size}
                            </span>
                          )}
                        </div>
                        <span className="font-bold text-emerald-700">
                          +{m.quantity?.toLocaleString()} added
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No inventory additions recorded.
                  </p>
                )}
              </div>

              <div className="border-t" />

              {/* Stock Movement References */}
              <div>
                <SH>Stock Movement References</SH>
                {detailResult.stockMovements?.length > 0 ? (
                  <div className="space-y-1.5">
                    {detailResult.stockMovements.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between text-xs bg-muted/30 border rounded-lg px-3 py-2"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`font-bold px-1.5 py-0.5 rounded text-[10px] uppercase ${
                              m.movementType === "PRODUCTION_IN"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {m.movementType === "PRODUCTION_IN" ? "IN" : "OUT"}
                          </span>
                          <span className="font-medium">
                            {m.movementType === "PRODUCTION_IN"
                              ? (m.product?.name ?? "Product")
                              : (m.rawMaterial?.name ?? "Material")}
                          </span>
                          <span className="font-mono text-muted-foreground/60">
                            {m.id.slice(-8)}
                          </span>
                        </div>
                        <span className="font-semibold">
                          {m.movementType === "PRODUCTION_IN" ? "+" : "-"}
                          {m.quantity?.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No stock movement references found.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Failed to load detail.
            </div>
          )}

          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setShowDetail(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =========== PRODUCTION ORDERS MODULE ===========
function ProductionOrdersModule() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stats, setStats] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailOrder, setDetailOrder] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [products, setProducts] = useState([]);
  const [completeTarget, setCompleteTarget] = useState(null);
  const [showComplete, setShowComplete] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (statusFilter !== "all") qs.set("status", statusFilter);
      if (search.trim()) qs.set("search", search.trim());
      const [orders, st, prods] = await Promise.all([
        api.get(
          "productionorders" + (qs.toString() ? "?" + qs.toString() : ""),
        ),
        api.get("productionorders/stats"),
        api.get("products"),
      ]);
      setItems(Array.isArray(orders) ? orders : []);
      setStats(st);
      setProducts(Array.isArray(prods) ? prods : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    load();
  };

  const openDetail = async (o) => {
    const detail = await api.get(`productionorders/${o.id}`);
    setDetailOrder(detail);
    setShowDetail(true);
  };

  const openEdit = async (o) => {
    const detail = await api.get(`productionorders/${o.id}`);
    setEditing(detail);
    setShowForm(true);
  };

  const handleSave = async (data) => {
    if (editing) {
      await api.put("productionorders/" + editing.id, data);
    } else {
      await api.post("productionorders", data);
    }
    setEditing(null);
    load();
  };

  const handleCancel = async (o) => {
    if (!confirm(`Cancel Production Order ${o.productionOrderNumber}?`)) return;
    await api.del("productionorders/" + o.id);
    load();
  };

  const handleStart = async (o) => {
    if (
      !confirm(
        `Start production for ${o.productionOrderNumber}? This will change the status to "In Production".`,
      )
    )
      return;
    await api.post(`productionorders/${o.id}/start`, {});
    load();
  };

  const openComplete = (o) => {
    setCompleteTarget(o);
    setShowComplete(true);
  };

  const handleComplete = async (data) => {
    await api.post(`productionorders/${completeTarget.id}/complete`, data);
    setCompleteTarget(null);
    load();
  };

  const statusBadge = (s) => {
    const cls =
      {
        Draft: "bg-slate-100 text-slate-600",
        Ready: "bg-emerald-100 text-emerald-700",
        "Not Ready": "bg-amber-100 text-amber-700",
        "In Production": "bg-blue-100 text-blue-700",
        Completed: "bg-indigo-100 text-indigo-700",
        Cancelled: "bg-rose-100 text-rose-600",
      }[s] || "bg-slate-100 text-slate-600";
    return (
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
        {s}
      </span>
    );
  };

  const STAT_CARDS = [
    {
      label: "Total",
      key: "total",
      icon: ClipboardList,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "Ready",
      key: "ready",
      icon: CheckCircle2,
      color: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "In Production",
      key: "inProduction",
      icon: Activity,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "Not Ready",
      key: "notReady",
      icon: AlertTriangle,
      color: "text-amber-600 bg-amber-50",
    },
    {
      label: "Completed",
      key: "completed",
      icon: PackageCheck,
      color: "text-indigo-600 bg-indigo-50",
    },
    {
      label: "Cancelled",
      key: "cancelled",
      icon: X,
      color: "text-rose-600 bg-rose-50",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Production Orders
          </h1>
          <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">
            Plan and execute manufacturing runs using Bill of Materials
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" /> Create Order
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-6 gap-3">
        {STAT_CARDS.map((c) => (
          <div
            key={c.label}
            className="bg-background border rounded-xl p-3 flex flex-col gap-1"
          >
            <div className={`rounded-md p-1.5 self-start ${c.color}`}>
              <c.icon className="h-4 w-4" />
            </div>
            <p className="text-xl font-bold">{stats?.[c.key] ?? "—"}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide leading-tight">
              {c.label}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <form
          onSubmit={handleSearch}
          className="flex items-center gap-2 flex-1 min-w-[200px]"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg bg-background"
              placeholder="Search order number, product…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button type="submit" size="sm" variant="secondary">
            Search
          </Button>
        </form>
        <select
          className="border rounded-lg px-3 py-2 text-sm bg-background"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="Draft">Draft</option>
          <option value="Ready">Ready</option>
          <option value="Not Ready">Not Ready</option>
          <option value="In Production">In Production</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-background border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              {[
                "Order Number",
                "Product",
                "Planned Qty",
                "Actual Qty",
                "Planned Date",
                "Status",
                "Updated At",
                "",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left font-medium text-xs text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td
                  colSpan={8}
                  className="p-8 text-center text-muted-foreground text-sm"
                >
                  Loading production orders…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center">
                  <Factory className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-muted-foreground text-sm">
                    No production orders found
                  </p>
                </td>
              </tr>
            ) : (
              items.map((o) => (
                <tr
                  key={o.id}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => openDetail(o)}
                >
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-700">
                    {o.productionOrderNumber}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{o.product?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {o.product?.sku}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {o.plannedQuantity?.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-semibold text-indigo-700">
                    {o.actualQuantity != null
                      ? o.actualQuantity.toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {o.plannedDate
                      ? new Date(o.plannedDate).toLocaleDateString("id-ID")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">{statusBadge(o.status)}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {o.updatedAt
                      ? new Date(o.updatedAt).toLocaleDateString("id-ID")
                      : "—"}
                  </td>
                  <td
                    className="px-4 py-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1">
                      {o.status === "Ready" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-blue-700 border-blue-200 hover:bg-blue-50 gap-1"
                          onClick={() => handleStart(o)}
                        >
                          <Activity className="h-3 w-3" /> Start
                        </Button>
                      )}
                      {o.status === "In Production" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50 gap-1"
                          onClick={() => openComplete(o)}
                        >
                          <PackageCheck className="h-3 w-3" /> Complete
                        </Button>
                      )}
                      {o.status !== "Cancelled" &&
                        o.status !== "Completed" &&
                        o.status !== "In Production" &&
                        o.status !== "Ready" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEdit(o)}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ProductionOrderFormDialog
        open={showForm}
        onOpenChange={(v) => {
          setShowForm(v);
          if (!v) setEditing(null);
        }}
        initial={editing}
        onSave={handleSave}
        products={products}
      />
      <ProductionOrderDetailDialog
        open={showDetail}
        onOpenChange={setShowDetail}
        order={detailOrder}
        onEdit={(o) => {
          setDetailOrder(null);
          openEdit(o);
        }}
        onCancel={handleCancel}
        onStart={(o) => {
          setShowDetail(false);
          handleStart(o);
        }}
        onComplete={(o) => {
          setShowDetail(false);
          openComplete(o);
        }}
      />
      <CompleteProductionDialog
        open={showComplete}
        onOpenChange={(v) => {
          setShowComplete(v);
          if (!v) setCompleteTarget(null);
        }}
        order={completeTarget}
        onComplete={handleComplete}
      />
    </div>
  );
}

// =========== BOM MODULE ===========
function BOMModule() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stats, setStats] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailBom, setDetailBom] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [products, setProducts] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (statusFilter !== "all") qs.set("status", statusFilter);
      if (search.trim()) qs.set("search", search.trim());
      const [boms, st, prods, rms] = await Promise.all([
        api.get("bom" + (qs.toString() ? "?" + qs.toString() : "")),
        api.get("bom/stats"),
        api.get("products"),
        api.get("rawmaterials"),
      ]);
      setItems(Array.isArray(boms) ? boms : []);
      setStats(st);
      setProducts(Array.isArray(prods) ? prods : []);
      setRawMaterials(Array.isArray(rms) ? rms : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    load();
  };

  const openEdit = async (b) => {
    const detail = await api.get(`bom/${b.id}`);
    setEditing(detail);
    setShowForm(true);
  };

  const openDetail = async (b) => {
    const detail = await api.get(`bom/${b.id}`);
    setDetailBom(detail);
    setShowDetail(true);
  };

  const handleSave = async (data) => {
    if (editing) {
      await api.put("bom/" + editing.id, data);
    } else {
      await api.post("bom", data);
    }
    setEditing(null);
    load();
  };

  const statusBadge = (s) => {
    const cls =
      s === "Active"
        ? "bg-emerald-100 text-emerald-700"
        : "bg-slate-100 text-slate-600";
    return (
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
        {s}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Bill of Materials (BOM)
          </h1>
          <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">
            Define material compositions for each product
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" /> Create BOM
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: "Total BOMs",
            value: stats?.total ?? "—",
            icon: ClipboardList,
            color: "text-blue-600 bg-blue-50",
          },
          {
            label: "Active",
            value: stats?.active ?? "—",
            icon: CheckCircle2,
            color: "text-emerald-600 bg-emerald-50",
          },
          {
            label: "Inactive",
            value: stats?.inactive ?? "—",
            icon: Archive,
            color: "text-slate-600 bg-slate-50",
          },
        ].map((c) => (
          <div
            key={c.label}
            className="bg-background border rounded-xl p-4 flex items-center gap-4"
          >
            <div className={`rounded-lg p-2.5 ${c.color}`}>
              <c.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{c.value}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                {c.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <form
          onSubmit={handleSearch}
          className="flex items-center gap-2 flex-1 min-w-[200px]"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg bg-background"
              placeholder="Search BOM code, product, version…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button type="submit" size="sm" variant="secondary">
            Search
          </Button>
        </form>
        <select
          className="border rounded-lg px-3 py-2 text-sm bg-background"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-background border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              {[
                "BOM Code",
                "Product",
                "Version",
                "Total Materials",
                "Status",
                "Updated At",
                "",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left font-medium text-xs text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td
                  colSpan={7}
                  className="p-8 text-center text-muted-foreground text-sm"
                >
                  Loading BOMs…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center">
                  <ClipboardList className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-muted-foreground text-sm">No BOMs found</p>
                </td>
              </tr>
            ) : (
              items.map((b) => (
                <tr
                  key={b.id}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => openDetail(b)}
                >
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-700">
                    {b.bomCode}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{b.product?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.product?.sku}
                    </p>
                  </td>
                  <td className="px-4 py-3">{b.version}</td>
                  <td className="px-4 py-3 text-center font-semibold">
                    {b._count?.items ?? 0}
                  </td>
                  <td className="px-4 py-3">{statusBadge(b.status)}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {b.updatedAt
                      ? new Date(b.updatedAt).toLocaleDateString("id-ID")
                      : "—"}
                  </td>
                  <td
                    className="px-4 py-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(b)}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <BOMFormDialog
        open={showForm}
        onOpenChange={(v) => {
          setShowForm(v);
          if (!v) setEditing(null);
        }}
        initial={editing}
        onSave={handleSave}
        products={products}
        rawMaterials={rawMaterials}
      />
      <BOMDetailDialog
        open={showDetail}
        onOpenChange={setShowDetail}
        bom={detailBom}
        onEdit={(b) => {
          setDetailBom(null);
          openEdit(b);
        }}
      />
    </div>
  );
}

function SuppliersModule() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stats, setStats] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailSupplier, setDetailSupplier] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const load = async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (statusFilter !== "all") qs.append("status", statusFilter);
    if (search) qs.append("search", search);
    const [data, statsData] = await Promise.all([
      api.get("suppliers" + (qs.toString() ? "?" + qs.toString() : "")),
      api.get("suppliers/stats"),
    ]);
    setItems(Array.isArray(data) ? data : []);
    setStats(statsData && !statsData.error ? statsData : null);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [search, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setShowForm(true);
  };
  const openEdit = (s) => {
    setEditing(s);
    setShowForm(true);
  };

  const openDetail = async (s) => {
    const detail = await api.get(`suppliers/${s.id}`);
    setDetailSupplier(detail);
    setShowDetail(true);
  };

  const save = async (form) => {
    if (editing?.id) {
      await api.put("suppliers/" + editing.id, form);
      toast.success("Supplier updated");
    } else {
      await api.post("suppliers", form);
      toast.success("Supplier created");
    }
    setShowForm(false);
    setEditing(null);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await api.del("suppliers/" + deleteId);
    toast.success("Supplier deleted");
    setDeleteId(null);
    load();
  };

  const statusBadge = (status) => {
    const isActive = (status || "Active") === "Active";
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${isActive ? "bg-emerald-500/10 text-emerald-600" : "bg-gray-400/10 text-gray-500"}`}
      >
        {status || "Active"}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">
            Supplier Master
          </h2>
          <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">
            Manage suppliers for raw material procurement and purchasing
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Supplier
        </Button>
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Total Suppliers
            </p>
            <p className="text-3xl font-semibold mt-1">
              {loading ? "—" : (stats?.total ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider text-emerald-500">
              Active
            </p>
            <p className="text-3xl font-semibold mt-1 text-emerald-500">
              {loading ? "—" : (stats?.active ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider text-gray-400">
              Inactive
            </p>
            <p className="text-3xl font-semibold mt-1 text-gray-400">
              {loading ? "—" : (stats?.inactive ?? 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <p className="text-xs text-muted-foreground mb-1">
                Search code / name / contact
              </p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="min-w-[150px]">
              <p className="text-xs text-muted-foreground mb-1">Status</p>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={load}
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Loading suppliers…
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <Truck className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                No suppliers found
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Add your first supplier to get started.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[rgba(17,24,39,0.04)]">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Code
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Supplier Name
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Contact Person
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Phone
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      City
                    </th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Raw Materials
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((s, idx) => (
                    <tr
                      key={s.id}
                      className={`border-b border-border/30 hover:bg-[#F7F8FA]/80 transition-colors cursor-pointer ${idx % 2 === 0 ? "" : "bg-muted/10"}`}
                      onClick={() => openDetail(s)}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {s.supplierCode}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {s.supplierName}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {s.contactPerson || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {s.phone || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {s.city || "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-muted text-xs font-semibold">
                          {s._count?.rawMaterials ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">{statusBadge(s.status)}</td>
                      <td
                        className="px-4 py-3 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEdit(s)}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-rose-500 hover:text-rose-600"
                            onClick={() => setDeleteId(s.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <SupplierFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        initial={editing}
        onSave={save}
      />
      <SupplierDetailDialog
        open={showDetail}
        onOpenChange={setShowDetail}
        supplier={detailSupplier}
        onEdit={(s) => {
          setEditing(s);
          setShowForm(true);
        }}
      />

      {/* Delete Confirmation */}
      <Dialog
        open={!!deleteId}
        onOpenChange={(v) => {
          if (!v) setDeleteId(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Supplier</DialogTitle>
            <DialogDescription>
              This will permanently delete the supplier. Raw materials linked to
              this supplier will be unlinked but not deleted. This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =========== COMING SOON PLACEHOLDER ===========
const COMING_SOON_META = {
  stockmovements: {
    title: "Stock Movements",
    description:
      "Track all inventory movements including inbound, outbound, transfers, and adjustments across warehouses.",
  },
  suppliers: {
    title: "Suppliers",
    description:
      "Manage supplier contacts, purchase terms, lead times, and procurement relationships.",
  },
  finishedgoods: {
    title: "Finished Goods",
    description:
      "Track completed products ready for sale, including quality checks and storage locations.",
  },
  customers: {
    title: "Customers",
    description:
      "Manage customer profiles, purchase history, and relationship data.",
  },
  orders: {
    title: "Orders",
    description:
      "Create and manage sales orders, track fulfillment status, and handle invoicing.",
  },
  saleschannels: {
    title: "Sales Channels",
    description:
      "Configure and monitor sales channels including online stores, marketplaces, and direct sales.",
  },
  campaigns: {
    title: "Campaigns",
    description:
      "Plan and track marketing campaigns, set goals, assign budgets, and measure performance.",
  },
  productanalytics: {
    title: "Product Analytics",
    description:
      "Analyze product performance, best sellers, return rates, and revenue contribution.",
  },
  inventoryanalytics: {
    title: "Inventory Analytics",
    description:
      "Monitor stock health, turnover rates, shrinkage, and demand forecasting.",
  },
  financialanalytics: {
    title: "Financial Analytics",
    description:
      "Deep-dive into revenue trends, cost structures, margins, and financial KPIs.",
  },
  marketinganalytics: {
    title: "Marketing Analytics",
    description:
      "Measure content reach, creator ROI, campaign conversions, and audience engagement.",
  },
  executivereports: {
    title: "Executive Reports",
    description:
      "High-level business summaries and dashboards for leadership and board reporting.",
  },
  users: {
    title: "Users",
    description:
      "Manage user accounts, access levels, and team members in the system.",
  },
  rolespermissions: {
    title: "Roles & Permissions",
    description:
      "Define roles and control access permissions for each module and action.",
  },
};

function ComingSoonModule({ pageId }) {
  const meta = COMING_SOON_META[pageId] || {
    title: pageId,
    description: "This module is under development.",
  };
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">
          {meta.title}
        </h2>
        <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">
          {meta.description}
        </p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-24 gap-5">
          <div className="w-16 h-16 rounded-[22px] bg-gradient-to-br from-[#EEF3FA] to-[#D8E3F3] flex items-center justify-center shadow-[0_4px_16px_rgba(17,24,39,0.06)]">
            <Sparkles className="h-7 w-7 text-[#5F6B7A]" />
          </div>
          <div className="text-center max-w-sm">
            <p className="text-lg font-bold tracking-tight text-[#111827]">
              Coming Soon
            </p>
            <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium leading-relaxed">
              {meta.description}
            </p>
          </div>
          <span className="text-[11px] font-bold px-4 py-1.5 rounded-full bg-[#EEF3FA] text-[#5F6B7A] tracking-[0.15em] uppercase border border-[rgba(17,24,39,0.06)]">
            In Development
          </span>
        </CardContent>
      </Card>
    </div>
  );
}

// =========== CASH FLOW STATEMENT ===========
function CashFlowStatementModule({
  onNavigateToCashIn,
  onNavigateToCashOut,
  onNavigateToLedger,
}) {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const today = now.toISOString().split("T")[0];

  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateFrom) params.append("from", dateFrom);
    if (dateTo) params.append("to", dateTo);
    const result = await api.get("cashflow?" + params.toString());
    setData(result?.error ? null : result);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [dateFrom, dateTo]);

  const CashTable = ({ rows, emptyLabel, colorClass, onDrillDown }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-[#F7F8FA]">
            <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
              Account Code
            </th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">
              Category / COA
            </th>
            <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
              Transactions
            </th>
            <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
              Amount
            </th>
            <th className="px-4 py-3 w-10" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                className="px-4 py-8 text-center text-sm text-muted-foreground"
              >
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.coaId}
                className="border-b border-[rgba(17,24,39,0.04)] hover:bg-[#F7F8FA]/80 transition-colors"
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                    {row.accountCode}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium">{row.accountName}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {row.count}
                </td>
                <td
                  className={`px-4 py-3 text-right font-medium ${colorClass}`}
                >
                  {fmt(row.amount)}
                </td>
                <td className="px-4 py-3">
                  {onDrillDown && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="View transactions"
                      onClick={onDrillDown}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[1.5rem] font-bold tracking-[0.04em] uppercase text-[#111827] leading-tight">
            Cash Flow Statement
          </h2>
          <p className="text-sm text-[#5F6B7A] mt-1.5 font-medium">
            Direct method — generated from Cash In and Cash Out transactions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled
            title="Export PDF (coming soon)"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled
            title="Export Excel (coming soon)"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label>Date From</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date To</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-40"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs"
              onClick={() => {
                setDateFrom(firstOfMonth);
                setDateTo(today);
              }}
            >
              Reset to Current Month
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Validation Warning */}
      {data && !data.isValid && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-400">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold text-sm">Balance Validation Warning</p>
            <p className="text-xs mt-0.5 text-rose-400/80">
              Opening Balance + Cash Inflows − Cash Outflows ≠ Closing Balance ·
              Difference: {fmt(data.validationDiff)}
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Total Cash Inflows
              </p>
              <p className="text-xl font-semibold text-emerald-500 mt-1">
                {fmt(data.totalInflows)}
              </p>
            </CardContent>
          </Card>
          <Card className="">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Total Cash Outflows
              </p>
              <p className="text-xl font-semibold text-rose-400 mt-1">
                {fmt(data.totalOutflows)}
              </p>
            </CardContent>
          </Card>
          <Card
            className={`${data.netCashFlow < 0 ? "border-rose-500/40" : ""}`}
          >
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Net Cash Flow
              </p>
              <p
                className={`text-xl font-semibold mt-1 ${data.netCashFlow >= 0 ? "text-emerald-500" : "text-rose-400"}`}
              >
                {data.netCashFlow < 0 ? "-" : ""}
                {fmt(Math.abs(data.netCashFlow))}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Generating cash flow report...
          </span>
        </div>
      ) : data ? (
        <div className="space-y-4">
          {/* Cash Inflows */}
          <Card className="">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  Cash Inflows
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-emerald-500">
                    {fmt(data.totalInflows)}
                  </span>
                  {onNavigateToCashIn && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={onNavigateToCashIn}
                      title="View Cash In records"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Cash In
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CashTable
              rows={data.inflows}
              emptyLabel="No cash inflow transactions in selected period"
              colorClass="text-emerald-500"
              onDrillDown={onNavigateToCashIn}
            />
            <div className="border-t border-border bg-[#F7F8FA] px-4 py-2.5 flex justify-between text-sm font-semibold">
              <span className="text-muted-foreground">Total Cash Inflows</span>
              <span className="text-emerald-500">{fmt(data.totalInflows)}</span>
            </div>
          </Card>

          {/* Cash Outflows */}
          <Card className="">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-rose-400" />
                  Cash Outflows
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-rose-400">
                    {fmt(data.totalOutflows)}
                  </span>
                  {onNavigateToCashOut && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={onNavigateToCashOut}
                      title="View Cash Out records"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Cash Out
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CashTable
              rows={data.outflows}
              emptyLabel="No cash outflow transactions in selected period"
              colorClass="text-rose-400"
              onDrillDown={onNavigateToCashOut}
            />
            <div className="border-t border-border bg-[#F7F8FA] px-4 py-2.5 flex justify-between text-sm font-semibold">
              <span className="text-muted-foreground">Total Cash Outflows</span>
              <span className="text-rose-400">{fmt(data.totalOutflows)}</span>
            </div>
          </Card>

          {/* Net Cash Flow */}
          <Card
            className={`border-2 ${data.netCashFlow >= 0 ? "border-emerald-500/40 bg-emerald-500/5" : "border-rose-500/40 bg-rose-500/5"}`}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Net Cash Flow
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Total Cash Inflows − Total Cash Outflows
                  </p>
                </div>
                <p
                  className={`text-2xl font-bold ${data.netCashFlow >= 0 ? "text-emerald-500" : "text-rose-400"}`}
                >
                  {data.netCashFlow < 0 ? "-" : ""}
                  {fmt(Math.abs(data.netCashFlow))}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Financial Account Summary */}
          <Card className="">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Landmark className="h-4 w-4 text-blue-400" />
                Financial Account Summary
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-[#F7F8FA]">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                      Account
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                      Opening Balance
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                      Total In
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                      Total Out
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">
                      Closing Balance
                    </th>
                    <th className="px-4 py-3 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {data.accountSummary.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-sm text-muted-foreground"
                      >
                        No financial accounts configured
                      </td>
                    </tr>
                  ) : (
                    data.accountSummary.map((acc) => (
                      <tr
                        key={acc.id}
                        className="border-b border-[rgba(17,24,39,0.04)] hover:bg-[#F7F8FA]/80 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium">{acc.name}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {fmt(acc.openingBalance)}
                        </td>
                        <td className="px-4 py-3 text-right text-emerald-500">
                          {acc.totalIn > 0 ? fmt(acc.totalIn) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-rose-400">
                          {acc.totalOut > 0 ? fmt(acc.totalOut) : "—"}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-semibold ${acc.closingBalance >= 0 ? "text-blue-400" : "text-rose-400"}`}
                        >
                          {fmt(acc.closingBalance)}
                        </td>
                        <td className="px-4 py-3">
                          {onNavigateToLedger && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="View in General Ledger"
                              onClick={() => onNavigateToLedger(null)}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Cash Position Summary */}
          <Card
            className={`border-2 ${data.isValid ? "border-blue-500/40 bg-blue-500/5" : "border-rose-500/40 bg-rose-500/5"}`}
          >
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                Cash Position Summary
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center py-1.5 border-b border-[rgba(17,24,39,0.04)]">
                  <span className="text-muted-foreground">
                    Opening Cash Position
                  </span>
                  <span className="font-medium">
                    {fmt(data.openingCashPosition)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-[rgba(17,24,39,0.04)]">
                  <span className="text-muted-foreground">
                    + Total Cash Inflows
                  </span>
                  <span className="font-medium text-emerald-500">
                    {fmt(data.totalInflows)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-[rgba(17,24,39,0.04)]">
                  <span className="text-muted-foreground">
                    − Total Cash Outflows
                  </span>
                  <span className="font-medium text-rose-400">
                    {fmt(data.totalOutflows)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-[rgba(17,24,39,0.04)]">
                  <span className="text-muted-foreground">= Net Cash Flow</span>
                  <span
                    className={`font-semibold ${data.netCashFlow >= 0 ? "text-emerald-500" : "text-rose-400"}`}
                  >
                    {data.netCashFlow < 0 ? "-" : ""}
                    {fmt(Math.abs(data.netCashFlow))}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 mt-1">
                  <span className="font-semibold">Closing Cash Position</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-lg font-bold ${data.closingCashPosition >= 0 ? "text-blue-400" : "text-rose-400"}`}
                    >
                      {fmt(data.closingCashPosition)}
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        data.isValid
                          ? "border-emerald-500/40 text-emerald-500"
                          : "border-rose-500/40 text-rose-400"
                      }
                    >
                      {data.isValid ? "Balanced" : "Mismatch"}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

// =========== MAIN APP ===========
function App() {
  const [user, setUser] = useState(null);
  const [active, setActive] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [bootChecked, setBootChecked] = useState(false);
  const [openGroups, setOpenGroups] = useState(() => {
    const g = getParentGroup("dashboard");
    return g ? new Set([g]) : new Set();
  });
  const [glInitialAccount, setGlInitialAccount] = useState(null);

  const toggleGroup = (id) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleNavClick = (id) => {
    setActive(id);
    // Auto-open the parent group when an item is navigated to
    const parent = getParentGroup(id);
    if (parent) {
      setOpenGroups((prev) => new Set([...prev, parent]));
    }
  };

  useEffect(() => {
    const u = localStorage.getItem("om_user");
    if (u) setUser(JSON.parse(u));
    setBootChecked(true);
  }, []);

  // Close mobile drawer when changing module
  useEffect(() => {
    setMobileOpen(false);
  }, [active]);

  if (!bootChecked) return <div className="min-h-screen bg-background" />;
  if (!user) return <Login onLogin={setUser} />;

  // Filter logic: find matching items across all groups
  const filteredGroups = query
    ? NAV_GROUPS.map((g) => {
        if (g.single) {
          return g.label.toLowerCase().includes(query.toLowerCase()) ? g : null;
        }
        const children = g.children.filter((c) =>
          c.label.toLowerCase().includes(query.toLowerCase()),
        );
        return children.length ? { ...g, children } : null;
      }).filter(Boolean)
    : NAV_GROUPS;

  const Component = {
    dashboard: <Dashboard />,
    products: <ProductsModule />,
    inventory: <InventoryModule />,
    rawmaterials: <RawMaterialModule />,
    planning: <PlanningModule />,
    content: <ContentModule />,
    creators: <CreatorCRM />,
    schools: <SchoolCRM />,
    timeline: <TimelineModule />,
    finance: <FinanceModule />,
    chartofaccounts: <ChartOfAccountsModule />,
    financialaccounts: <FinancialAccountModule />,
    cashin: <CashTransactionModule type="IN" />,
    cashout: <CashTransactionModule type="OUT" />,
    journalentries: <JournalEntriesModule />,
    generalledger: (
      <GeneralLedgerModule
        initialAccountId={glInitialAccount}
        onAccountConsumed={() => setGlInitialAccount(null)}
      />
    ),
    trialbalance: (
      <TrialBalanceModule
        onNavigateToLedger={(id) => {
          setGlInitialAccount(id);
          handleNavClick("generalledger");
        }}
      />
    ),
    profitloss: (
      <ProfitLossModule
        onNavigateToLedger={(id) => {
          setGlInitialAccount(id);
          handleNavClick("generalledger");
        }}
      />
    ),
    balancesheet: (
      <BalanceSheetModule
        onNavigateToLedger={(id) => {
          setGlInitialAccount(id);
          handleNavClick("generalledger");
        }}
        onNavigateToPL={() => handleNavClick("profitloss")}
      />
    ),
    cashflowstatement: (
      <CashFlowStatementModule
        onNavigateToCashIn={() => handleNavClick("cashin")}
        onNavigateToCashOut={() => handleNavClick("cashout")}
        onNavigateToLedger={(id) => {
          if (id) setGlInitialAccount(id);
          handleNavClick("generalledger");
        }}
      />
    ),
    // Hidden but preserved pages (accessible internally)
    planning: <PlanningModule />,
    timeline: <TimelineModule />,
    events: <EventsModule />,
    reports: <ReportsModule />,
    finance: <FinanceModule />,
    notifications: <NotificationsModule />,
    settings: <SettingsModule user={user} />,
    // Operations placeholders
    stockmovements: <StockMovementsModule />,
    suppliers: <SuppliersModule />,
    bom: <BOMModule />,
    productionorders: <ProductionOrdersModule />,
    productionresults: <ProductionResultsModule />,
    finishedgoods: <ComingSoonModule pageId="finishedgoods" />,
    // Sales placeholders
    customers: <ComingSoonModule pageId="customers" />,
    orders: <ComingSoonModule pageId="orders" />,
    saleschannels: <ComingSoonModule pageId="saleschannels" />,
    // Marketing placeholders
    campaigns: <ComingSoonModule pageId="campaigns" />,
    // Reports placeholders
    productanalytics: <ComingSoonModule pageId="productanalytics" />,
    inventoryanalytics: <ComingSoonModule pageId="inventoryanalytics" />,
    financialanalytics: <ComingSoonModule pageId="financialanalytics" />,
    marketinganalytics: <ComingSoonModule pageId="marketinganalytics" />,
    executivereports: <ComingSoonModule pageId="executivereports" />,
    // Settings (new IDs → existing modules)
    users: <ComingSoonModule pageId="users" />,
    rolespermissions: <ComingSoonModule pageId="rolespermissions" />,
    notificationsettings: <NotificationsModule />,
    systemconfig: <SettingsModule user={user} />,
  }[active];

  const logout = () => {
    localStorage.removeItem("om_user");
    setUser(null);
  };

  const SidebarBody = (
    <>
      <div className="px-6 pt-6 pb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-[14px] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.10)] flex items-center justify-center shrink-0">
            <img
              src="https://ik.imagekit.io/edyl3oplm/Onemission/logos/LOGO_ONEMISSION_3D.png"
              alt="Logo"
              className="w-8 h-8 object-contain"
            />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-[13px] font-bold tracking-[0.05em] uppercase text-[#111827] truncate">
                ONEMISSION
              </p>
              <p className="text-[10px] text-[#5F6B7A] tracking-[0.2em] uppercase font-medium">
                Values Matter
              </p>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-8 w-8 text-[#5F6B7A] hover:text-[#111827]"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="px-4 pb-3">
        {!collapsed && (
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-4 top-1/2 -translate-y-1/2 text-[#5F6B7A]/60" />
            <Input
              placeholder="Search modules..."
              className="pl-10 h-10 text-xs rounded-[18px] bg-[#F7F8FA] border-[rgba(17,24,39,0.07)] text-[#111827] placeholder:text-[#5F6B7A]/50 focus-visible:ring-[#BFCDE2]/40"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        )}
      </div>
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto scrollbar-thin py-1">
        {filteredGroups.map((group) => {
          if (group.single) {
            const Icon = group.icon;
            const isActive = active === group.id;
            return (
              <button
                key={group.id}
                onClick={() => handleNavClick(group.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[16px] text-sm transition-all duration-200 ${isActive ? "bg-[#D8E3F3] text-[#111827] font-semibold shadow-[0_2px_8px_rgba(17,24,39,0.06)]" : "text-[#5F6B7A] hover:bg-[#EEF3FA] hover:text-[#111827]"}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{group.label}</span>}
              </button>
            );
          }
          const isOpen = openGroups.has(group.id) || !!query;
          const Icon = group.icon;
          const hasActiveChild = group.children?.some((c) => c.id === active);
          return (
            <div key={group.id}>
              <button
                onClick={() => {
                  if (!collapsed) toggleGroup(group.id);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[16px] text-sm transition-all duration-200 ${hasActiveChild ? "text-[#111827] font-semibold" : "text-[#5F6B7A] hover:bg-[#EEF3FA] hover:text-[#111827]"}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && (
                  <>
                    <span className="truncate flex-1 text-left">
                      {group.label}
                    </span>
                    <ChevronRight
                      className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 text-sidebar-foreground/40 ${isOpen ? "rotate-90" : ""}`}
                    />
                  </>
                )}
              </button>
              {!collapsed && (
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="submenu"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="ml-4 pl-3 border-l-2 border-[#D8E3F3] mt-1 mb-1 space-y-0.5">
                        {group.children?.map((item) => {
                          const ItemIcon = item.icon;
                          const isActive = active === item.id;
                          return (
                            <button
                              key={item.id}
                              onClick={() => handleNavClick(item.id)}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-[13px] text-[13px] transition-all duration-200 ${isActive ? "bg-[#D8E3F3] text-[#111827] font-semibold shadow-[0_2px_8px_rgba(17,24,39,0.06)]" : "text-[#5F6B7A] hover:bg-[#EEF3FA] hover:text-[#111827]"}`}
                            >
                              <ItemIcon className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          );
        })}
      </nav>
      <div className="p-4 pt-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-3 p-3 rounded-[18px] hover:bg-[#EEF3FA] transition-all duration-200">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs">
                  {user.avatar}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="text-left min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{user.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {user.role}
                  </p>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="hidden md:flex"
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? "Expand sidebar" : "Collapse sidebar"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setActive("settings")}>
              <SettingsIcon className="h-4 w-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-rose-400">
              <LogOut className="h-4 w-4 mr-2" /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex p-3 md:p-4 gap-3 md:gap-4">
      {/* Desktop floating sidebar */}
      <aside
        className={`hidden md:flex ${collapsed ? "w-[72px]" : "w-[280px]"} shrink-0 bg-white rounded-[32px] border border-[rgba(17,24,39,0.05)] shadow-[0_10px_40px_rgba(0,0,0,0.05)] transition-all duration-200 flex-col h-[calc(100vh-32px)] sticky top-4 overflow-hidden`}
      >
        {SidebarBody}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-[#111827]/40 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "tween", duration: 0.25 }}
              className="fixed top-0 left-0 z-50 h-screen w-[280px] bg-white shadow-[4px_0_48px_rgba(0,0,0,0.10)] flex flex-col md:hidden"
            >
              {SidebarBody}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <main className="flex-1 min-w-0 flex flex-col gap-3 md:gap-4">
        {/* Floating topbar */}
        <div className="sticky top-3 md:top-4 z-30 bg-white/90 backdrop-blur-[20px] rounded-[24px] md:rounded-[28px] border border-[rgba(17,24,39,0.05)] shadow-[0_4px_24px_rgba(0,0,0,0.04)] px-4 md:px-6 h-[64px] md:h-[72px] flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-9 w-9 shrink-0 rounded-[12px] text-[#5F6B7A] hover:text-[#111827] hover:bg-[#EEF3FA]"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] text-[#5F6B7A] hidden sm:inline tracking-[0.12em] uppercase font-medium">
                ONEMISSION
              </span>
              <ChevronRight className="h-3 w-3 text-[#BFCDE2] hidden sm:inline" />
              <span className="font-semibold text-[#111827] text-sm truncate tracking-tight">
                {getNavLabel(active)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setActive("notifications")}
              className="h-9 w-9 rounded-[12px] flex items-center justify-center text-[#5F6B7A] hover:text-[#111827] hover:bg-[#EEF3FA] transition-all duration-200"
            >
              <Bell className="h-4 w-4" />
            </button>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-[12px] bg-[#EEF3FA] border border-[rgba(17,24,39,0.05)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4FAF73]" />
              <span className="text-[11px] font-semibold text-[#111827] tracking-wide">
                LIVE
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 pb-4 max-w-[1600px] w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {Component}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default App;
