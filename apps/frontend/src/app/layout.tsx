import type { Metadata } from "next";
import { Source_Serif_4, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AuthProvider } from "@/components/AuthProvider";
import { AppLayout } from "@/components/AppLayout";
import { ProjectProvider } from "@/lib/project";

const sourceSerif = Source_Serif_4({ 
  subsets: ['latin'], 
  weight: ['600'], 
  variable: '--font-source-serif' 
});

const ibmPlexSans = IBM_Plex_Sans({ 
  subsets: ['latin'], 
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-plex-sans' 
});

const ibmPlexMono = IBM_Plex_Mono({ 
  subsets: ['latin'], 
  weight: ['400', '500'],
  variable: '--font-ibm-plex-mono' 
});

export const metadata: Metadata = {
  title: "ProcureMind AI",
  description: "Procurement/audit software",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={cn(
          "font-sans antialiased bg-paper text-ink selection:bg-navy/20",
          sourceSerif.variable,
          ibmPlexSans.variable,
          ibmPlexMono.variable
        )}
      >
        <AuthProvider>
          <ProjectProvider>
            <AppLayout>
              {children}
            </AppLayout>
          </ProjectProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
