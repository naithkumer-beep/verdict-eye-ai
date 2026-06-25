// Lightweight i18n setup (EN / Myanmar). Initialized once in __root.tsx.
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const en = {
  nav: {
    dashboard: "Dashboard",
    reports: "Reports",
    newReport: "New Report",
    map: "Map",
    emergency: "Emergency",
    notifications: "Notifications",
    settings: "Settings",
    admin: "Admin Panel",
    signOut: "Sign out",
  },
  brand: { tagline: "AI-powered civic reporting for Yangon" },
  common: {
    submit: "Submit",
    cancel: "Cancel",
    delete: "Delete",
    save: "Save",
    loading: "Loading…",
    back: "Back",
    yes: "Yes",
    no: "No",
    confirm: "Confirm",
    language: "Language",
    english: "English",
    myanmar: "မြန်မာ",
  },
  emergency: {
    title: "Emergency Services — Yangon",
    subtitle: "One-tap dial for the most critical Yangon hotlines.",
    callNow: "Call now",
    police: "Police Emergency",
    fire: "Fire Brigade",
    ambulance: "Ambulance",
    ycdc: "YCDC City Hotline",
    electricity: "Electricity (YESC)",
    redCross: "Myanmar Red Cross",
    floatingBtn: "Emergency",
  },
  comments: {
    title: "Discussion",
    placeholder: "Share your thoughts on this report…",
    post: "Post comment",
    empty: "No comments yet — be the first to discuss.",
    delete: "Delete comment",
  },
  reactions: { like: "Helpful", dislike: "Not helpful" },
  chatbot: {
    title: "CivicLens Assistant",
    welcome:
      "Hi! Ask me anything about CivicLens AI — how to submit a report, the 6-stage AI validation, statuses, or Yangon-specific features.",
    placeholder: "Ask a question…",
    send: "Send",
  },
  reports: {
    statusPending: "Pending",
    statusAnalyzing: "Analyzing",
    statusVerified: "Verified",
    statusResolved: "Resolved",
    statusRejected: "Rejected",
    location: "Location",
    pinOnMap: "Pin on map",
    useMyLocation: "Use my location",
    viewOnMap: "View on map",
    allStatuses: "All statuses",
    allCategories: "All categories",
    showing: "Showing",
    of: "of",
    liveMap: "Live map",
    reportsOnMap: "Reports on map",
    loadingMap: "Loading map…",
    openReport: "Open report",
  },
  admin: {
    queue: "Moderation queue",
    changeStatus: "Change status",
    deleteReport: "Delete report",
    userManagement: "User management",
    auditLog: "Audit log",
    report: "Report",
    category: "Category",
    status: "Status",
    submitted: "Submitted",
    actions: "Actions",
    noReports: "No reports in the queue.",
  },
  settings: {
    profile: "Profile",
    avatar: "Profile photo",
    uploadAvatar: "Upload photo",
    removeAvatar: "Remove",
  },
  banned: {
    title: "Your account is banned by the admin.",
    description:
      "Your account has been banned by an administrator. You have been signed out and can no longer access the platform. If you believe this is a mistake, please contact support to appeal.",
    action: "Understood",
  },
};



const my = {
  nav: {
    dashboard: "ဒက်ရှ်ဘုတ်",
    reports: "အစီရင်ခံစာများ",
    newReport: "အသစ်တင်ရန်",
    map: "မြေပုံ",
    emergency: "အရေးပေါ်",
    notifications: "အသိပေးချက်များ",
    settings: "ဆက်တင်",
    admin: "အက်ဒမင်",
    signOut: "ထွက်ရန်",
  },
  brand: { tagline: "ရန်ကုန်အတွက် AI မြို့ပြ‌အစီရင်ခံစနစ်" },
  common: {
    submit: "တင်ရန်",
    cancel: "ပယ်ဖျက်",
    delete: "ဖျက်",
    save: "သိမ်း",
    loading: "ဖွင့်နေသည်…",
    back: "နောက်သို့",
    yes: "ဟုတ်",
    no: "မဟုတ်",
    confirm: "အတည်ပြု",
    language: "ဘာသာ",
    english: "English",
    myanmar: "မြန်မာ",
  },
  emergency: {
    title: "အရေးပေါ်ဝန်ဆောင်မှု — ရန်ကုန်",
    subtitle: "ရန်ကုန်အရေးပေါ်ဖုန်းနံပါတ်များ။",
    callNow: "ခေါ်ဆိုရန်",
    police: "ရဲအရေးပေါ်",
    fire: "မီးသတ်",
    ambulance: "လူနာတင်ယာဉ်",
    ycdc: "YCDC ဖုန်းလိုင်း",
    electricity: "လျှပ်စစ် (YESC)",
    redCross: "မြန်မာကြက်ခြေနီ",
    floatingBtn: "အရေးပေါ်",
  },
  comments: {
    title: "ဆွေးနွေးချက်",
    placeholder: "သင်၏ထင်မြင်ချက်ကို မျှဝေပါ…",
    post: "မှတ်ချက်တင်ရန်",
    empty: "မှတ်ချက်မရှိသေးပါ — ပထမဆုံးဖြစ်လိုက်ပါ။",
    delete: "မှတ်ချက်ဖျက်ရန်",
  },
  reactions: { like: "အသုံးဝင်", dislike: "မဝင်" },
  chatbot: {
    title: "CivicLens အကူ",
    welcome:
      "မင်္ဂလာပါ! CivicLens AI အကြောင်း ဘာမဆို မေးနိုင်ပါသည် — အစီရင်ခံစာတင်နည်း၊ AI 6-ဆင့်စစ်ဆေးမှု၊ အခြေအနေများ။",
    placeholder: "မေးခွန်းမေးပါ…",
    send: "ပို့",
  },
  reports: {
    statusPending: "စောင့်ဆိုင်း",
    statusAnalyzing: "စစ်ဆေးနေ",
    statusVerified: "အတည်ပြုပြီး",
    statusResolved: "ဖြေရှင်းပြီး",
    statusRejected: "ပယ်ဖျက်",
    location: "တည်နေရာ",
    pinOnMap: "မြေပုံပေါ်တွင်မှတ်",
    useMyLocation: "ကျွန်ုပ်တည်နေရာ",
    viewOnMap: "မြေပုံတွင်ကြည့်",
    allStatuses: "အခြေအနေအားလုံး",
    allCategories: "အမျိုးအစားအားလုံး",
    showing: "ပြသနေသည်",
    of: "/",
    liveMap: "တိုက်ရိုက်မြေပုံ",
    reportsOnMap: "မြေပုံပေါ်ရှိအစီရင်ခံစာများ",
    loadingMap: "မြေပုံဖွင့်နေသည်…",
    openReport: "အစီရင်ခံစာဖွင့်",
  },
  admin: {
    queue: "စောင့်ကြည့်စာရင်း",
    changeStatus: "အခြေအနေပြောင်း",
    deleteReport: "အစီရင်ခံစာဖျက်",
    userManagement: "အသုံးပြုသူစီမံ",
    auditLog: "မှတ်တမ်း",
    report: "အစီရင်ခံစာ",
    category: "အမျိုးအစား",
    status: "အခြေအနေ",
    submitted: "တင်သွင်းချိန်",
    actions: "လုပ်ဆောင်ချက်",
    noReports: "စောင့်ဆိုင်းနေသော အစီရင်ခံစာ မရှိပါ။",
  },
  settings: {
    profile: "ပရိုဖိုင်",
    avatar: "ပရိုဖိုင်ဓာတ်ပုံ",
    uploadAvatar: "ဓာတ်ပုံတင်",
    removeAvatar: "ဖယ်ရှား",
  },
  banned: {
    title: "သင်၏အကောင့်ကို အက်ဒမင်မှ ပိတ်ပင်ထားသည်။",
    description:
      "သင်၏အကောင့်ကို စီမံခန့်ခွဲသူမှ ပိတ်ပင်ထားပါသည်။ သင်အား စနစ်မှ ထွက်ပေးပြီး ပလက်ဖောင်းကို ဆက်လက်အသုံးပြု၍ မရတော့ပါ။ အမှားဖြစ်သည်ဟု ယူဆပါက အကူအညီတောင်းရန် ဆက်သွယ်ပေးပါ။",
    action: "နားလည်ပါပြီ",
  },
};



let initialized = false;
export function initI18n() {
  if (initialized) return;
  initialized = true;
  const stored =
    typeof window !== "undefined" ? localStorage.getItem("civiclens-lang") : null;
  void i18n.use(initReactI18next).init({
    resources: { en: { t: en }, my: { t: my } },
    lng: stored ?? "en",
    fallbackLng: "en",
    defaultNS: "t",
    interpolation: { escapeValue: false },
  });
}

export function setLanguage(lang: "en" | "my") {
  if (typeof window !== "undefined") localStorage.setItem("civiclens-lang", lang);
  void i18n.changeLanguage(lang);
}

// Myanmar digit conversion. Converts 0-9 in the input to ၀-၉ when active.
const MY_DIGITS = ["၀", "၁", "၂", "၃", "၄", "၅", "၆", "၇", "၈", "၉"];
export function toMyanmarDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => MY_DIGITS[Number(d)]);
}
export function localNum(input: string | number): string {
  return i18n.language === "my" ? toMyanmarDigits(input) : String(input);
}

export default i18n;

