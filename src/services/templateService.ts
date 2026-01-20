import examTemplate from "../templates/latex/exam.tex?raw";
import worksheetTemplate from "../templates/latex/worksheet.tex?raw";
import notesTemplate from "../templates/latex/notes.tex?raw";
import presentationTemplate from "../templates/latex/presentation.tex?raw";
import bookTemplate from "../templates/latex/book.tex?raw";
import standaloneTemplate from "../templates/latex/standalone.tex?raw";
import articleTemplate from "../templates/latex/article.tex?raw";
import thesisTemplate from "../templates/latex/thesis.tex?raw";

export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string; // FontAwesome icon name or similar identifier
  content: string;
  category: "Education" | "Academic" | "Graphics";
}

export const templates: Template[] = [
  {
    id: "exam",
    name: "Διαγώνισμα",
    description: "Πρότυπο για ωριαία τεστ ή τρίωρα διαγωνίσματα.",
    icon: "file-pen",
    content: examTemplate,
    category: "Education",
  },
  {
    id: "worksheet",
    name: "Φυλλάδιο Ασκήσεων",
    description: "Λίστα ασκήσεων για φροντιστήριο ή σπίτι.",
    icon: "list-check",
    content: worksheetTemplate,
    category: "Education",
  },
  {
    id: "notes",
    name: "Σημειώσεις Μαθήματος",
    description: "Θεωρία, παραδείγματα και εφαρμογές.",
    icon: "book-open",
    content: notesTemplate,
    category: "Education",
  },
  {
    id: "presentation",
    name: "Παρουσίαση (Beamer)",
    description: "Slides για διδασκαλία ή ομιλίες.",
    icon: "person-chalkboard",
    content: presentationTemplate,
    category: "Academic",
  },
  {
    id: "article",
    name: "Επιστημονικό Άρθρο",
    description: "Κλασική δομή επιστημονικού άρθρου.",
    icon: "newspaper",
    content: articleTemplate,
    category: "Academic",
  },
  {
    id: "thesis",
    name: "Πτυχιακή Εργασία",
    description: "Δομή για διπλωματικές/πτυχιακές εργασίες.",
    icon: "graduation-cap",
    content: thesisTemplate,
    category: "Academic",
  },
  {
    id: "book",
    name: "Βιβλίο",
    description: "Ολοκληρωμένη δομή βιβλίου.",
    icon: "book",
    content: bookTemplate,
    category: "Academic",
  },
  {
    id: "standalone",
    name: "Αυτόνομο Σχήμα",
    description: "Template για TikZ/PGFPlots εικόνες.",
    icon: "image",
    content: standaloneTemplate,
    category: "Graphics",
  },
];

export const getTemplateById = (id: string): Template | undefined => {
  return templates.find((t) => t.id === id);
};
