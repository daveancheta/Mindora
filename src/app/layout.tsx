import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "MindSpace AI", description: "A private space to check in with yourself." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
