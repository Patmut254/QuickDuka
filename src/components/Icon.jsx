// Drop-in replacement for <FontAwesomeIcon>. Every icon used in the app is
// mapped to a thin outline (Lucide) icon so the whole UI shares one clean,
// line-icon style with no filled shapes. Anything not in the map (brand
// logos such as WhatsApp) falls back to the original Font Awesome glyph.
import { FontAwesomeIcon as FA } from "@fortawesome/react-fontawesome";
import {
  ChartLine, TrendingUp, TrendingDown, Receipt, Package, History,
  SlidersHorizontal, Wallet, LogOut, Sun, Moon, Mail, CircleHelp,
  ShieldCheck, Headset, User, Lock, Eye, EyeOff, CircleCheck, ChevronLeft,
  ChevronRight, ChevronUp, ChevronDown, CircleUser, TriangleAlert, Users,
  GitBranch, SquareCheck, Phone, Store, Loader, UserPlus, Trash2, HandCoins,
  Handshake, Plus, MapPin, ChartColumn, X, PiggyBank, Smartphone, Clock,
  ShoppingCart, ToggleRight, ToggleLeft, Banknote, MessageSquare,
  CalendarDays, Calendar, ArrowRight, Send, KeyRound, Info, Gift, FileText,
  CircleX, Ban, UserCog, ThumbsDown, Bot, Database, CirclePlus, CalendarPlus,
  Briefcase, UserX, Tag, RefreshCw, Pencil, Search, Lightbulb, Layers, IdCard,
  Hash, Save, FileUp, SquarePen, Crown, Cookie, MessageCircleMore, Brain,
  Menu, ArrowUp,
} from "lucide-react";

const MAP = {
  "chart-line": ChartLine,
  "money-bill-trend-up": TrendingUp,
  "arrow-trend-up": TrendingUp,
  "arrow-trend-down": TrendingDown,
  receipt: Receipt,
  box: Package,
  "clock-rotate-left": History,
  sliders: SlidersHorizontal,
  "sack-dollar": Wallet,
  "right-from-bracket": LogOut,
  "arrow-right-from-bracket": LogOut,
  sun: Sun,
  moon: Moon,
  envelope: Mail,
  "circle-question": CircleHelp,
  "shield-halved": ShieldCheck,
  headset: Headset,
  user: User,
  lock: Lock,
  eye: Eye,
  "eye-slash": EyeOff,
  "circle-check": CircleCheck,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "chevron-up": ChevronUp,
  "chevron-down": ChevronDown,
  "circle-user": CircleUser,
  "triangle-exclamation": TriangleAlert,
  users: Users,
  "code-branch": GitBranch,
  "square-check": SquareCheck,
  phone: Phone,
  store: Store,
  spinner: Loader,
  "user-plus": UserPlus,
  trash: Trash2,
  "hand-holding-dollar": HandCoins,
  handshake: Handshake,
  plus: Plus,
  "location-dot": MapPin,
  "chart-bar": ChartColumn,
  xmark: X,
  "piggy-bank": PiggyBank,
  "mobile-screen": Smartphone,
  clock: Clock,
  "cart-plus": ShoppingCart,
  "toggle-on": ToggleRight,
  "toggle-off": ToggleLeft,
  "money-bill-wave": Banknote,
  "money-bill": Banknote,
  message: MessageSquare,
  "calendar-days": CalendarDays,
  calendar: Calendar,
  "arrow-right": ArrowRight,
  "paper-plane": Send,
  key: KeyRound,
  "circle-info": Info,
  gift: Gift,
  "file-lines": FileText,
  "circle-xmark": CircleX,
  ban: Ban,
  "user-shield": UserCog,
  "thumbs-down": ThumbsDown,
  robot: Bot,
  database: Database,
  "circle-plus": CirclePlus,
  "calendar-plus": CalendarPlus,
  briefcase: Briefcase,
  "user-slash": UserX,
  tag: Tag,
  rotate: RefreshCw,
  pen: Pencil,
  "magnifying-glass": Search,
  lightbulb: Lightbulb,
  "layer-group": Layers,
  "id-card": IdCard,
  hashtag: Hash,
  "floppy-disk": Save,
  "file-arrow-up": FileUp,
  "pen-to-square": SquarePen,
  crown: Crown,
  "cookie-bite": Cookie,
  "comment-dots": MessageCircleMore,
  brain: Brain,
  bars: Menu,
  "arrow-up": ArrowUp,
};

export function FontAwesomeIcon({ icon, spin, className = "", style, color, ...rest }) {
  const Lucide = icon && MAP[icon.iconName];
  if (!Lucide) {
    return (
      <FA icon={icon} spin={spin} className={className} style={style} color={color} {...rest} />
    );
  }
  return (
    <Lucide
      aria-hidden="true"
      className={`qd-icon${spin ? " qd-icon-spin" : ""}${className ? " " + className : ""}`}
      style={style}
      color={color || "currentColor"}
      strokeWidth={1.75}
      size="1.15em"
    />
  );
}

export default FontAwesomeIcon;
