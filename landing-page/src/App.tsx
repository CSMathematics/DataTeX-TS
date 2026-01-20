import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { Features } from "./components/Features";
import { About } from "./components/About";
import { Footer } from "./components/Footer";

function App() {
  return (
    <div className="min-h-screen bg-dark-900 text-white font-sans selection:bg-primary/30 selection:text-primary-light">
      <Navbar />
      <Hero />
      <Features />
      <About />
      <Footer />
    </div>
  );
}

export default App;
