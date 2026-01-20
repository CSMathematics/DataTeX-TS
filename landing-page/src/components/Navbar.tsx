import { Github } from "lucide-react";
import { cn } from "../lib/utils";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useState } from "react";

export function Navbar() {
  const { scrollY } = useScroll();
  const [isScrolled, setIsScrolled] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setIsScrolled(latest > 50);
  });

  return (
    <motion.header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isScrolled
          ? "py-4 bg-dark-900/80 backdrop-blur-md border-b border-white/5"
          : "py-6 bg-transparent",
      )}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="container mx-auto px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src={`${import.meta.env.BASE_URL}datatex_icon.svg`}
            alt="DataTeX Logo"
            className="w-8 h-8"
          />
          <span className="font-bold text-xl tracking-tight">DataTeX</span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
          <a href="#" className="hover:text-white transition-colors">
            Features
          </a>
          <a href="#" className="hover:text-white transition-colors">
            About
          </a>
          <a href="#" className="hover:text-white transition-colors">
            Download
          </a>
          <a
            href="https://github.com/CSMathematics/DataTeX-TS/wiki"
            target="_blank"
            rel="noreferrer"
            className="hover:text-white transition-colors"
          >
            Docs
          </a>
        </nav>

        <div className="flex items-center gap-4">
          <a
            href="https://github.com/CSMathematics/DataTeX-TS"
            target="_blank"
            rel="noreferrer"
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
          >
            <Github className="w-5 h-5" />
          </a>
          <a
            href="https://github.com/CSMathematics/DataTeX-TS/releases/tag/v2.1.0"
            className={cn(
              "hidden md:block px-5 py-2 rounded-lg font-semibold text-sm transition-all text-white",
              isScrolled
                ? "bg-primary hover:bg-primary-dark"
                : "bg-white/10 hover:bg-white/20 border border-white/10",
            )}
          >
            Get Started
          </a>
        </div>
      </div>
    </motion.header>
  );
}
