"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ArrowRight, AudioLines, Brain, ChevronRight, CircleHelp, Clock3, Compass, Heart, Home, LockKeyhole, MessageCircle, Mic, Moon, PenLine, Plus, Settings, ShieldCheck, Sparkles, Sun, Waves, X } from "lucide-react";
import { AssistantSettings, LocalChat } from "@/components/local-chat";

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
};
type Props = { section: string };

export function Workspace({ section }: Props) {
  const [light, setLight] = useState(false);
  const [toast, setToast] = useState("");
  const [message, setMessage] = useState("");
  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const say = (text: string) => { setToast(text); window.setTimeout(() => setToast(""), 3000); };
  const flip = (key: string) => setToggles((state) => ({ ...state, [key]: !state[key] }));
  const active = section;
  return <div className={`app${light ? " light" : ""}`}>
    <aside className="sidebar">
      <Link className="brand" href="/"><span className="brand-icon"><Sparkles size={18}/></span>mindspace<span style={{ color: "var(--violet)" }}>ai</span></Link>
      <div className="eyebrow">Your space</div>
      <nav className="nav-list">{items.slice(0, 7).map((item) => <NavItem key={item.id} item={item} active={active}/>)}</nav>
      <div className="eyebrow" style={{ marginTop: 15 }}>More</div>
      <nav className="nav-list">{items.slice(7).map((item) => <NavItem key={item.id} item={item} active={active}/>)}</nav>
      <div className="sidebar-bottom"><div className="privacy-chip"><strong><LockKeyhole size={13} style={{ verticalAlign: "-2px", marginRight: 6, color: "var(--teal)" }}/>Private by design</strong><span>Your activity stays on this device.</span></div><div className="smalltext muted" style={{ padding: "5px 12px" }}>A gentle companion for your everyday</div></div>
    </aside>
    <nav className="mobilebar" aria-label="Main navigation">{[items[0], items[1], items[2], items[4], items[8]].map((item) => <Link key={item.id} className={active === item.id ? "active" : ""} href={item.href}><item.icon size={18}/><span>{item.label.split(" ")[0]}</span></Link>)}</nav>
    <main className="main"><div className="topline"><div className="crumb">MindSpace <ChevronRight size={13} style={{ verticalAlign: "-2px" }}/> <span style={{ color: "var(--text)" }}>{active === "dashboard" ? "Overview" : items.find((i) => i.id === active)?.label}</span></div><div className="top-actions"><button className="icon-btn" aria-label="Toggle light/dark theme" onClick={() => setLight(!light)}>{light ? <Moon size={16}/> : <Sun size={16}/>}</button><Link className="icon-btn" href="/settings" aria-label="Settings"><Settings size={16}/></Link></div></div>
      <div className="content">{active === "dashboard" ? <Dashboard say={say}/> : <Section section={section} message={message} setMessage={setMessage} say={say} toggles={toggles} flip={flip}/>}</div>
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
  return <>
    <div className="welcome"><div className="eyebrow">A moment for yourself</div><h1>Hey there. How are you, really?</h1><p>There’s no right answer. This is your space to pause, reflect, or simply be.</p><div className="row"><Link href="/chat" className="button primary"><MessageCircle size={15}/> Start a conversation</Link><Link href="/voice" className="button ghost"><Mic size={15}/> Try voice space</Link></div></div>
    <div className="grid">
      <div className="card span-4"><div className="card-head"><div className="card-title"><Sparkles size={17}/> Your AI companion</div><span className="pill">Local AI</span></div><DashboardConnection/><p className="smalltext muted" style={{ margin: "12px 0 17px" }}>Check your local Ollama service and installed models.</p><Link href="/settings" className="button small">Explore setup <ArrowRight size={13}/></Link></div>
      <div className="card span-4"><div className="card-head"><div className="card-title"><Brain size={17}/> Self discovery</div><span className="pill">Not started</span></div><div style={{ fontSize: 23, fontWeight: 550 }}>A little more you</div><p className="smalltext muted" style={{ margin: "5px 0 15px" }}>A short reflection to explore what matters to you.</p><Link href="/personality" className="button small">Begin when ready <ArrowRight size={13}/></Link></div>
      <div className="card span-4"><div className="card-head"><div className="card-title"><Heart size={17}/> Mood check-in</div><span className="pill">Your pace</span></div><div className="empty" style={{ padding: 15 }}><strong>No check-ins yet</strong>Your mood history will appear here when you add one.</div><Link href="/mood" className="button small" style={{ marginTop: 12 }}>Check in <ArrowRight size={13}/></Link></div>
      <div className="card span-6"><div className="card-head"><div className="card-title"><Waves size={17}/> A little reset</div><Link href="/wellness" className="smalltext" style={{ color: "var(--violet)" }}>Explore all</Link></div><div className="activity"><div className="activity-icon"><Waves size={17}/></div><div style={{ flex: 1 }}><strong style={{ fontSize: 13 }}>One-minute breathing pause</strong><span>No streaks. No pressure. Just one breath at a time.</span></div><Link href="/wellness" className="icon-btn" aria-label="Open breathing exercise"><ArrowRight size={15}/></Link></div></div>
      <div className="card span-6"><div className="card-head"><div className="card-title"><ShieldCheck size={17}/> Your privacy</div><Link href="/settings" className="smalltext" style={{ color: "var(--violet)" }}>Settings</Link></div><div className="list-row"><span className="smalltext">Data storage</span><span className="status"><i className="dot teal"/> This device</span></div><div className="list-row"><span className="smalltext">Analytics sharing</span><span className="status">Off by default</span></div></div>
    </div>
    <div className="row" style={{ justifyContent: "center", marginTop: 23 }}><span className="smalltext muted">Your space is yours. Take what helps and leave the rest.</span><button onClick={() => say("Thanks for sharing. This dashboard contains no activity history yet.")} className="icon-btn" aria-label="About this dashboard"><CircleHelp size={15}/></button></div>
  </>;
}

function Section({ section, message, setMessage, say, toggles, flip }: { section: string; message: string; setMessage: (value: string) => void; say: (text: string) => void; toggles: Record<string, boolean>; flip: (key: string) => void }) {
  const [title, description] = titles[section] ?? ["Your space", "A gentle place to check in with yourself."];
  if (section === "chat") return <><h1 className="heading">{title}</h1><p className="subheading">{description}</p><div style={{ marginTop: 26 }}><LocalChat/></div></>;
  if (section === "settings") return <><h1 className="heading">{title}</h1><p className="subheading">{description}</p><div style={{ marginTop: 26 }}><AssistantSettings/></div></>;
  return <><h1 className="heading">{title}</h1><p className="subheading">{description}</p><div style={{ marginTop: 26 }}>
    {section === "chat" && <div className="card chatbox"><div className="card-head"><div className="card-title"><MessageCircle size={17}/> Private conversation</div><span className="status"><i className="dot"/> Model unavailable</span></div><div className="chat-messages"><div className="empty" style={{ maxWidth: 430 }}><Sparkles size={19}/><strong>Your conversation starts here</strong>Connect a local model in settings before chatting. Your messages won’t leave this device.</div></div><form className="chat-input" onSubmit={(e) => { e.preventDefault(); say("Connect a local model in AI & privacy settings to start chatting."); setMessage(""); }}><input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Write what’s on your mind…" aria-label="Your message"/><button className="icon-btn" type="submit" aria-label="Send message"><ArrowRight size={16}/></button></form></div>}
    {section === "voice" && <div className="card" style={{ textAlign: "center", padding: "52px 24px" }}><div className="brand-icon" style={{ width: 64, height: 64, borderRadius: 21, margin: "0 auto 19px" }}><AudioLines size={26}/></div><strong style={{ display: "block", fontSize: 16 }}>Voice tools aren’t connected yet</strong><p className="muted smalltext" style={{ maxWidth: 370, margin: "7px auto 20px" }}>Speech recognition and voice playback will run in your browser when a compatible provider is available.</p><button className="button" onClick={() => say("Speech recognition is unavailable in this build.")}><Mic size={15}/> Voice unavailable</button></div>}
    {section === "face-analysis" && <div className="card"><div className="card-title"><Activity size={17}/> On-device expression insights</div><p className="muted smalltext" style={{ marginTop: 8 }}>Face analysis is optional and disabled. Nothing is captured or analyzed until a local provider is added and you choose to enable it.</p><div className="switchrow"><div><strong style={{ fontSize: 13 }}>Enable face analysis</strong><div className="smalltext muted">No camera access is requested in this foundation.</div></div><button className={`switch${toggles.face ? " on" : ""}`} role="switch" aria-checked={!!toggles.face} onClick={() => { flip("face"); say("Face analysis provider is not available yet."); }} aria-label="Enable face analysis"/></div><div className="empty" style={{ marginTop: 15 }}><strong>Provider unavailable</strong>Expression analysis requires a local model, which is not configured.</div></div>}
    {section === "personality" && <div className="card"><div className="card-head"><div className="card-title"><Brain size={17}/> A gentle reflection</div><span className="pill">0 of 8 prompts</span></div><p className="muted smalltext">This optional activity is being prepared. Your answers will be stored on this device when the assessment is available.</p><div className="progress"><i style={{ width: "0%" }}/></div><div className="empty"><strong>Nothing to complete today</strong>Your assessment hasn’t started. You can come back whenever you like.</div></div>}
    {section === "mood" && <div className="card"><div className="card-title"><Heart size={17}/> Choose a feeling</div><p className="muted smalltext" style={{ marginTop: 7, marginBottom: 17 }}>There’s no need to explain. Pick what feels closest, or skip today.</p><div className="row">{[["Calm","☁"],["Okay","◡"],["Low","◌"],["Anxious","〰"],["Good","✳"]].map(([label, face]) => <button key={label} className="feature" style={{ minHeight: 90, alignItems: "center", flex: "1 1 92px" }} onClick={() => say(`${label} check-ins will be available when local storage is set up.`)}><span style={{ fontSize: 23, color: "var(--violet)" }}>{face}</span><strong style={{ marginTop: 7 }}>{label}</strong></button>)}</div><div className="empty" style={{ marginTop: 20 }}><strong>No mood history yet</strong>Your check-ins will stay on this device.</div></div>}
    {section === "journal" && <div className="card"><div className="card-head"><div className="card-title"><PenLine size={17}/> A blank page is a good start</div><LockKeyhole size={15} color="var(--teal)"/></div><textarea placeholder="Write a little, or a lot…" rows={7} style={{ resize: "vertical", width: "100%", border: "1px solid var(--border)", background: "var(--panel2)", color: "var(--text)", borderRadius: 11, padding: 13, outlineColor: "var(--violet)" }}/><div className="row" style={{ justifyContent: "space-between", marginTop: 12 }}><span className="smalltext muted">Saved only on this device</span><button className="button primary small" onClick={() => say("Journal storage is not connected yet. Your writing has not been saved.")}><Plus size={14}/> Save entry</button></div></div>}
    {section === "wellness" && <div className="section-grid">{[[Waves,"Breathing pause","A few slow breaths, at your own pace."],[Compass,"Grounding moment","Notice what you can see, hear, and feel."],[Clock3,"Mindful minute","A short pause with no goal to reach."],[Heart,"Kindness check-in","Offer yourself the same care you’d give a friend."]].map(([Icon,label,copy]) => { const Glyph = Icon as typeof Waves; return <button className="feature" key={label as string} onClick={() => say("This guided activity is being prepared.")}><div className="feature-icon"><Glyph size={18}/></div><strong>{label as string}</strong><span>{copy as string}</span><div style={{ marginTop: "auto", paddingTop: 14, color: "var(--violet)", fontSize: 11 }}>Explore <ArrowRight size={12} style={{ verticalAlign: "-2px" }}/></div></button>; })}</div>}
    {section === "settings" && <div className="grid"><div className="card span-6"><div className="card-title"><Sparkles size={17}/> Local AI</div><p className="muted smalltext" style={{ margin: "8px 0 15px" }}>No language model has been connected.</p><div className="status"><i className="dot"/> Unavailable</div><div className="empty" style={{ marginTop: 16 }}><strong>Provider setup not available yet</strong>A local provider adapter is ready for future integration.</div></div><div className="card span-6"><div className="card-title"><ShieldCheck size={17}/> Privacy controls</div><p className="muted smalltext" style={{ margin: "8px 0 13px" }}>Your settings are session-only until local preferences are configured.</p>{[["analytics","Share anonymous usage analytics",false],["face","Allow face analysis",false],["storage","Keep journal on this device",true]].map(([key,label,initial]) => <div className="switchrow" key={key as string}><span className="smalltext">{label as string}</span><button className={`switch${(toggles[key as string] ?? initial) ? " on" : ""}`} role="switch" aria-checked={toggles[key as string] ?? initial as boolean} onClick={() => flip(key as string)} aria-label={label as string}/></div>)}</div><div className="card span-12"><div className="card-title"><LockKeyhole size={17}/> Your data</div><div className="list-row" style={{ marginTop: 13 }}><span className="smalltext">Analytics</span><span className="smalltext muted">No analytics provider installed</span></div><div className="list-row"><span className="smalltext">Cloud AI</span><span className="smalltext muted">Not connected</span></div><div className="list-row"><span className="smalltext">Local storage</span><span className="smalltext muted">Adapter available · no data stored</span></div><button className="button small" style={{ marginTop: 12 }} onClick={() => say("There is no stored MindSpace data to clear.")}><X size={13}/> Clear local data</button></div></div>}
  </div></>;
}
