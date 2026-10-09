import { notFound } from "next/navigation";
import { Workspace } from "@/components/workspace";
const sections = ["chat", "voice", "face-analysis", "personality", "mood", "journal", "wellness", "settings", "offline"];
export function generateStaticParams() { return sections.map((section) => ({ section })); }
export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) { const { section } = await params; if (!sections.includes(section)) notFound(); return <Workspace section={section} />; }
