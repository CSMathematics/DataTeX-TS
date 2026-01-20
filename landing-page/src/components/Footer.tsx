import { Github, Twitter, Mail } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-dark-950 py-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <h3 className="text-xl font-bold text-white mb-2">DataTeX</h3>
            <p className="text-gray-500 text-sm">
              Next-generation LaTeX IDE & Manager.
            </p>
            <p className="text-gray-600 text-xs mt-1">
              © {new Date().getFullYear()} DataTeX. All rights reserved.
            </p>
          </div>

          <div className="flex items-center gap-6">
            <a
              href="https://github.com/CSMathematics/DataTeX-TS"
              className="text-gray-400 hover:text-white transition-colors"
            >
              <Github className="w-5 h-5" />
            </a>
            <a
              href="#"
              className="text-gray-400 hover:text-white transition-colors"
            >
              <Twitter className="w-5 h-5" />
            </a>
            <a
              href="#"
              className="text-gray-400 hover:text-white transition-colors"
            >
              <Mail className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
