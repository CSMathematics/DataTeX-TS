import { motion } from "framer-motion";
import { ArrowRight, Download, Github, BookOpen } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-40 lg:pt-48 lg:pb-32 min-h-screen flex items-center">
      {/* Background gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl z-0 pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 bg-primary/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-primary-dark/20 rounded-full blur-[100px]" />
      </div>

      {/* Background Logo */}
      <div className="absolute top-1/5 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0 pointer-events-none opacity-[0.3]">
        <img
          src={`${import.meta.env.BASE_URL}DatatexLogo.svg`}
          alt="DataTeX Logo"
          className="w-[800px] h-[800px] grayscale"
        />
      </div>

      {/* Background Screenshot */}
      <div className="absolute bottom-[-20%] right-[-10%] z-0 pointer-events-none opacity-20 rotate-[-12deg] skew-y-12">
        <img
          src={`${import.meta.env.BASE_URL}screenshot.png`}
          alt="DataTeX Screenshot"
          className="w-[1000px] max-w-none rounded-xl shadow-2xl border border-white/10 mask-image-gradient"
        />
      </div>

      <div className="container mx-auto px-4 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm text-primary-light mb-8 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-light opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-light"></span>
            </span>
            v2.1 is now available
          </div>
        </motion.div>

        <motion.h1
          className="text-5xl md:text-7xl font-bold tracking-tight mb-8 bg-gradient-to-br from-white via-white/90 to-white/50 bg-clip-text text-transparent"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          The Ultimate LaTeX
          <br />
          <span className="text-primary-light">IDE & Database Manager</span>
        </motion.h1>

        <motion.p
          className="text-xl text-gray-400 max-w-2xl mx-auto mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Streamline your academic writing with a powerful tool designed for
          speed and efficiency. Manage your LaTeX databases, create packages
          with wizards, and enjoy a modern editing experience.
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <a
            href="https://github.com/CSMathematics/DataTeX-TS/releases/tag/v2.1.0"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative px-8 py-4 bg-primary hover:bg-primary-dark transition-all duration-300 rounded-xl font-semibold flex items-center gap-3 shadow-lg shadow-primary/25 hover:shadow-primary/40 overflow-hidden text-white hover:text-white"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <Download
              className="w-5 h-5 relative z-10"
              style={{ color: "white" }}
            />
            <span className="relative z-10" style={{ color: "white" }}>
              Download
            </span>
          </a>

          <a
            href="https://github.com/CSMathematics/DataTeX-TS/wiki"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-4 bg-dark-700/50 hover:bg-dark-700 border border-white/10 backdrop-blur-sm transition-all rounded-xl font-semibold flex items-center gap-3 text-white"
          >
            <BookOpen className="w-5 h-5" />
            <span>Documentation</span>
          </a>

          <a
            href="https://github.com/CSMathematics/DataTeX-TS"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-sm transition-all rounded-xl font-semibold flex items-center gap-3"
          >
            <Github className="w-5 h-5" />
            <span>View on GitHub</span>
            <ArrowRight className="w-4 h-4 text-gray-400" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
