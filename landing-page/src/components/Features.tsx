import { motion } from "framer-motion";
import { Database, Code, Wand2, Package, Layers, Zap } from "lucide-react";
import { cn } from "../lib/utils";

const features = [
  {
    icon: Database,
    title: "Database Management",
    description:
      "Organize your exercises, theorems, and proofs in SQLite databases. Tag, search, and retrieve content instantly.",
  },
  {
    icon: Code,
    title: "Modern IDE",
    description:
      "A VS Code-like experience with syntax highlighting, autocomplete, and seamless compilation.",
  },
  {
    icon: Wand2,
    title: "Smart Wizards",
    description:
      "Create PGFPlots, TikZ diagrams, and LaTeX tables visually without writing complex boilerplate code.",
  },
  {
    icon: Package,
    title: "Package Manager",
    description:
      "Interactive package manager. Browse options, docs, and insert configuration directly into your document.",
  },
  {
    icon: Layers,
    title: "Project Organization",
    description:
      "Structure your academic projects with ease. Manage chapters, sections, and bibliography references efficiently.",
  },
  {
    icon: Zap,
    title: "Built with Rust",
    description:
      "Powered by Tauri and Rust for blazing fast performance and a tiny memory footprint.",
  },
];

export function Features() {
  return (
    <section className="py-24 bg-dark-800/50 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />

      <div className="container mx-auto px-4 z-10 relative">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <motion.h2
            className="text-3xl md:text-5xl font-bold mb-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Everything you need for{" "}
            <span className="text-primary-light">LaTeX</span>
          </motion.h2>
          <motion.p
            className="text-gray-400 text-lg"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            DataTeX v2 combines the power of a database with the flexibility of
            a modern text editor.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[minmax(200px,auto)]">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              className={cn(
                "group p-8 rounded-3xl bg-dark-700/50 border border-white/5 hover:border-primary/20 hover:bg-dark-700/80 transition-all duration-300 flex flex-col justify-between",
                index === 0 || index === 3 ? "md:col-span-2" : "md:col-span-1",
              )}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary-light mb-6 group-hover:scale-110 transition-transform duration-300">
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold mb-3">{feature.title}</h3>
                <p className="text-gray-400 leading-relaxed text-base">
                  {feature.description}
                </p>
              </div>

              {/* Decorative gradient for emphasis blocks */}
              {(index === 0 || index === 3) && (
                <div className="mt-8 h-24 w-full bg-gradient-to-r from-primary/10 to-transparent rounded-xl border border-white/5" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
