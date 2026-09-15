import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { TooltipProvider } from '@/components/ui/tooltip';
import './globals.css';

const geist = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
export const metadata: Metadata = { title: 'Personal Net Worth', description: 'A private, local-first personal net-worth dashboard in IDR.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body className={`${geist.variable} antialiased`}><TooltipProvider>{children}</TooltipProvider></body></html>; }
