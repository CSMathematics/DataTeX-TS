import { motion } from "framer-motion";

export function About() {
  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-4 text-center">
        <motion.div
          className="max-w-4xl mx-auto bg-gradient-to-br from-dark-800 to-dark-900 rounded-3xl p-8 md:p-12 border border-white/10 shadow-2xl"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl font-bold mb-6">Why DataTeX?</h2>
          <div className="space-y-6 text-gray-300 text-lg leading-relaxed">
            <p>
              DataTeX isn't just another LaTeX editor. It is a comprehensive
              ecosystem designed for educators, researchers, and students who
              need to manage vast amounts of LaTeX content.
            </p>
            <div className="grid md:grid-cols-2 gap-8 text-left mt-8">
              <div>
                <h4 className="text-white font-semibold mb-2">The Problem</h4>
                <p className="text-sm text-gray-400">
                  Scattered .tex files, copy-pasting code snippets, and
                  struggling with package documentation slows down the writing
                  process.
                </p>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-2">The Solution</h4>
                <p className="text-sm text-gray-400">
                  A centralized database connected to a powerful IDE. Write
                  once, reuse everywhere. Smart wizards handle the complexity.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
