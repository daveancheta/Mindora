"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ArrowRight, Brain, ChevronRight, CircleHelp, Heart, Home, LockKeyhole, MessageCircle, Mic, Moon, PenLine, Settings, ShieldCheck, Sparkles, Sun, Waves } from "lucide-react";
import { AssistantSettings, LocalChat } from "@/components/local-chat";
import { VoiceSpace } from "@/components/voice-space";
import { FaceAnalysis } from "@/components/face-analysis";
import { JournalPage, MoodPage, OfflineDiagnostics, PersonalityPage, PrivacyPersonalization, WellnessPage } from "@/components/personal-tools";

const items = [
  { id: "dashboard", label: "Overview", icon: Home, href: "/" },
  { id: "chat", label: "Talk it out", icon: MessageCircle, href: "/chat" },
  { id: "voice", label: "Voice space", icon: Mic, href: "/voice" },
  { id: "personality", label: "Get to know you", icon: Brain, href: "/personality" },
  { id: "mood", label: "Mood check-in", icon: Heart, href: "/mood" },
  { id: "journal", label: "Private journal", icon: PenLine, href: "/journal" },
  { id: "wellness", label: "Wellness studio", icon: Waves, href: "/wellness" },
  { id: "face-analysis", label: "Face analysis", icon: Activity, href: "/face-analysis" },
  { id: "settings", label: "AI & privacy", icon: Settings, href: "/settings" },
  { id: "offline", label: "Offline readiness", icon: ShieldCheck, href: "/offline" },
];
const titles: Record<string, [string, string]> = {
  chat: ["A space to talk", "Take your time. You can start wherever you are."],
  voice: ["Voice space", "A quieter way to check in, at your own pace."],
  personality: ["Get to know yourself", "A gentle reflection on what makes you, you."],
  mood: ["How are you feeling?", "A small check-in can be enough for today."],
  journal: ["Your private journal", "A place for thoughts that need somewhere to land."],
  wellness: ["Wellness studio", "Small guided moments to help you find your footing."],
  "face-analysis": ["Face analysis", "Choose whether to explore optional, on-device expression insights."],
  settings: ["AI & privacy", "You are in control of what stays on this device."],
  offline: ["Local readiness", "Check each local service and asset independently."],
};
type Props = { section: string };

export function Workspace({ section }: Props) {
  const [light, setLight] = useState(false);
  const [toast, setToast] = useState("");
  const say = (text: string) => { setToast(text); window.setTimeout(() => setToast(""), 3000); };
  const active = section;
  return <div className={`app${light ? " light" : ""}`}>
    <aside className="sidebar">
      <Link className="brand" href="/"><span className="brand-icon"><Sparkles size={18}/></span>mindspace<span style={{ color: "var(--violet)" }}>ai</span></Link>
      <div className="eyebrow">Your space</div>
      <nav className="nav-list">{items.slice(0, 7).map((item) => <NavItem key={item.id} item={item} active={active}/>)}</nav>
      <div className="eyebrow" style={{ marginTop: 15 }}>More</div>
      <nav className="nav-list">{items.slice(7).map((item) => <NavItem key={item.id} item={item} active={active}/>)}</nav><div className="nav-list"><NavItem item={items[9]!} active={active}/></div>
      <div className="sidebar-bottom"><div className="privacy-chip"><strong><LockKeyhole size={13} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--teal)" }}/>Private by design</strong><span>Your activity stays on this device.</span></div><div className="smalltext muted" style={{ padding: "5px 12px" }}>A gentle companion for your everyday</div></div>
    </aside>
    <nav className="mobilebar" aria-label="Main navigation">{[items[0], items[1], items[2], items[4], items[8]].map((item) => <Link key={item.id} className={active === item.id ? "active" : ""} href={item.href}><item.icon size={18}/><span>{item.label.split(" ")[0]}</span></Link>)}</nav>
    <main className="main"><div className="topline"><div className="crumb">MindSpace <ChevronRight size={13} style={{ verticalAlign: "-2px" }}/> <span style={{ color: "var(--text)" }}>{active === "dashboard" ? "Overview" : items.find((i) => i.id === active)?.label}</span></div><div className="top-actions"><span className="pill" title="AI and data services are configured for local endpoints">Local-only</span><button className="icon-btn" aria-label="Toggle light/dark theme" onClick={() => setLight(!light)}>{light ? <Moon size={16}/> : <Sun size={16}/>}</button><Link className="icon-btn" href="/settings" aria-label="Settings"><Settings size={16}/></Link></div></div>
      <div className="content">{active === "dashboard" ? <Dashboard say={say}/> : <Section section={section} say={say}/>}</div>
    </main>{toast && <div role="status" className="toast">{toast}</div>}
  </div>;
}

function NavItem({ item, active }: { item: (typeof items)[number]; active: string }) { return <Link className={`navlink${active === item.id ? " active" : ""}`} href={item.href}><item.icon size={17}/><span>{item.label}</span></Link>; }

function DashboardConnection() {
  const [status, setStatus] = useState("Checking local service…"); const [available, setAvailable] = useState(false);
  useEffect(() => { try { const config = JSON.parse(localStorage.getItem("mindspace.local-settings.v1") ?? "{}"); const endpoint = config.endpoint ?? "http://127.0.0.1:11434"; void fetch("/api/ollama/models", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint }) }).then(async (response) => { const data = await response.json(); setAvailable(Boolean(data.connected && data.models?.length)); setStatus(!data.connected ? "Ollama unavailable" : data.models?.length ? `${data.models.length} local model${data.models.length === 1 ? "" : "s"} ready` : "No chat models installed"); }).catch(() => { setAvailable(false); setStatus("Ollama unavailable"); }); } catch { setAvailable(false); setStatus("Ollama unavailable"); } }, []);
  return <div className="status"><i className={`dot${available ? " teal" : ""}`}/>{status}</div>;
}

function Dashboard({ say }: { say: (text: string) => void }) {
  const [defaultMode, setDefaultMode] = useState<"text" | "voice">("text");
  useEffect(() => { try { const value = JSON.parse(localStorage.getItem("mindspace.local-settings.v1") ?? "{}").defaultMode; if (value === "voice" || value === "text") setDefaultMode(value); } catch { setDefaultMode("text"); } }, []);
  const textAction = <Link href="/chat" className={`button ${defaultMode === "text" ? "primary" : "ghost"}`}><MessageCircle size={15}/> Start a conversation</Link>;
  const voiceAction = <Link href="/voice" className={`button ${defaultMode === "voice" ? "primary" : "ghost"}`}><Mic size={15}/> Try voice space</Link>;
  return <>
    <div className="welcome"><div className="eyebrow">A moment for yourself</div><h1>Hey there. How are you, really?</h1><p>There’s no right answer. This is your space to pause, reflect, or simply be.</p><div className="row">{defaultMode === "text" ? <>{textAction}{voiceAction}</> : <>{voiceAction}{textAction}</>}</div></div>
    <div className="grid">
      <div className="card span-4"><div className="card-head"><div className="card-title"><Sparkles size={17}/> Your AI companion</div><span className="pill">Local AI</span></div><DashboardConnection/><p className="smalltext muted" style={{ margin: "12px 0 17px" }}>Check your local Ollama service and installed models.</p><Link href="/settings" className="button small">Explore setup <ArrowRight size={13}/></Link></div>
      <div className="card span-4"><div className="card-head"><div className="card-title"><Brain size={17}/> Self discovery</div><span className="pill">Optional</span></div><div style={{ fontSize: 23, fontWeight: 550 }}>A little more you</div><p className="smalltext muted" style={{ margin: "5px 0 15px" }}>A short reflection to explore what matters to you.</p><Link href="/personality" className="button small">Begin when ready <ArrowRight size={13}/></Link></div>
      <div className="card span-4"><div className="card-head"><div className="card-title"><Heart size={17}/> Mood check-in</div><span className="pill">Your pace</span></div><div className="empty" style={{ padding: 15 }}><strong>Your check-ins stay private</strong>Open your encrypted mood tracker to view saved records or add a check-in.</div><Link href="/mood" className="button small" style={{ marginTop: 12 }}>Check in <ArrowRight size={13}/></Link></div>
      <div className="card span-6"><div className="card-head"><div className="card-title"><Waves size={17}/> A little reset</div><Link href="/wellness" className="smalltext" style={{ color: "var(--violet)" }}>Explore all</Link></div><div className="activity"><div className="activity-icon"><Waves size={17}/></div><div style={{ flex: 1 }}><strong style={{ fontSize: 13 }}>One-minute breathing pause</strong><span>No streaks. No pressure. Just one breath at a time.</span></div><Link href="/wellness" className="icon-btn" aria-label="Open breathing exercise"><ArrowRight size={15}/></Link></div></div>
      <div className="card span-6"><div className="card-head"><div className="card-title"><ShieldCheck size={17}/> Your privacy</div><Link href="/settings" className="smalltext" style={{ color: "var(--violet)" }}>Settings</Link></div><div className="list-row"><span className="smalltext">Data storage</span><span className="status"><i className="dot teal"/> This device</span></div><div className="list-row"><span className="smalltext">Analytics sharing</span><span className="status">Off by default</span></div></div>
    </div>
    <div className="row" style={{ justifyContent: "center", marginTop: 23 }}><span className="smalltext muted">Your space is yours. Take what helps and leave the rest.</span><button onClick={() => say("Thanks for sharing. This dashboard contains no activity history yet.")} className="icon-btn" aria-label="About this dashboard"><CircleHelp size={15}/></button></div>
  </>;
}

function Section({ section, say }: { section: string; say: (message: string) => void }) {
  const [title, description] = titles[section] ?? ["Your space", "A gentle place to check in with yourself."];
  const heading = <><h1 className="heading">{title}</h1><p className="subheading">{description}</p></>;
  if (section === "chat") return <>{heading}<div style={{ marginTop: 26 }}><LocalChat/></div></>;
  if (section === "settings") return <>{heading}<div style={{ marginTop: 26 }}><AssistantSettings/><PrivacyPersonalization onMessage={say}/></div></>;
  if (section === "voice") return <>{heading}<div style={{ marginTop: 26 }}><VoiceSpace/></div></>;
  if (section === "face-analysis") return <>{heading}<div style={{ marginTop: 26 }}><FaceAnalysis/></div></>;
  if (section === "personality") return <>{heading}<div style={{ marginTop: 26 }}><PersonalityPage/></div></>;
  if (section === "mood") return <>{heading}<div style={{ marginTop: 26 }}><MoodPage/></div></>;
  if (section === "journal") return <>{heading}<div style={{ marginTop: 26 }}><JournalPage/></div></>;
  if (section === "wellness") return <>{heading}<div style={{ marginTop: 26 }}><WellnessPage/></div></>;
  if (section === "offline") return <>{heading}<div style={{ marginTop: 26 }}><OfflineDiagnostics/></div></>;
  return <>{heading}<div className="empty"><strong>This section is unavailable</strong>Choose a destination from navigation.</div></>;
}
