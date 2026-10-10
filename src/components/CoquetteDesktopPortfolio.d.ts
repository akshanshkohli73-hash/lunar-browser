import React from 'react';

export interface CoquetteDesktopPortfolioProps {
  browserComponent?: React.ComponentType<any>;
  name?: string;
  eyebrow?: string;
  headline?: string;
  about?: any;
  folders?: any;
  aboutIcon?: { x: number; y: number };
  contactIcon?: { x: number; y: number };
  email?: string;
  links?: Array<{ label: string; url: string }>;
  availability?: string;
  now?: string[];
  skills?: string[];
  faq?: any;
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
