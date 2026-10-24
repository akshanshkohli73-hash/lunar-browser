import type React from "react";
interface Project {
  id?: string;
  name: string;
  year?: string;
  role?: string;
  tags?: string[];
  description?: string;
  url?: string;
}
interface Folder {
  id: string;
  label: string;
  title?: string;
  style?: string;
  x: number;
  y: number;
  projects: Project[];
}
export interface CoquetteDesktopPortfolioProps {
  browserComponent?: React.ComponentType<{
    isVisible?: boolean;
    isOccluded?: boolean;
  }>;
  themeStudioComponent?: React.ComponentType;
  settingsComponent?: React.ComponentType;
  notesComponent?: React.ComponentType;
  extensionsComponent?: React.ComponentType;
  name?: string;
  eyebrow?: string;
  headline?: string;
  about?: { title?: string; paragraphs: string[] };
  folders?: Folder[];
  aboutIcon?: { x: number; y: number; label?: string };
  contactIcon?: { x: number; y: number; label?: string };
  email?: string;
  links?: { label: string; url: string }[];
  availability?: string;
  now?: string[];
  skills?: string[];
  faq?: { q: string; a: string }[];
  song?: { title: string; artist: string };
  accent?: string;
  deep?: string;
  wallpaper?: string;
  openOnLoad?: string | null;
  intro?: boolean;
  height?: string;
  className?: string;
}
export declare const CoquetteDesktopPortfolio: React.FC<CoquetteDesktopPortfolioProps>;
export default CoquetteDesktopPortfolio;

export const CoquetteFrame: React.FC<{
  children: React.ReactNode;
  accent: string;
  deep: string;
  desktopVisible: boolean;
}>;
