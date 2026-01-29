import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { FilterProvider } from "@/context/FilterContext";
import { ThemeProvider } from "@/context/ThemeContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Stadium Dashboard",
  description: "Reconstructed Stadium Dashboard with modern tech stack",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className={`${inter.className} bg-[#020617] dark:bg-[#020617] light:bg-slate-100 text-slate-200 dark:text-slate-200 light:text-slate-800 antialiased transition-colors duration-300`}>
        <ThemeProvider>
          <AuthProvider>
            <FilterProvider>
              {children}
            </FilterProvider>
          </AuthProvider>
        </ThemeProvider>
        <div id="datepicker-portal" />
      </body>
    </html>
  );
}
