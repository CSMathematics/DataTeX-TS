import { dataTexHCTheme } from "./monaco-hc";
import { dataTexLightTheme } from "./monaco-light";
import { monokaiTheme } from "./monaco-monokai";
import { nordTheme } from "./monaco-nord";
import { dataTexDarkTheme } from "./monaco-theme";

export const LATEX_EDITOR_THEME_IDS = [
  "data-tex-dark",
  "data-tex-light",
  "data-tex-hc",
  "data-tex-monokai",
  "data-tex-nord",
] as const;

export type LatexEditorThemeId = (typeof LATEX_EDITOR_THEME_IDS)[number];

export const LATEX_SYNTAX_COLOR_GROUPS = [
  {
    id: "appearance",
    label: "Editor",
    labelEl: "Επεξεργαστής",
    description: "Base editor canvas and unstyled text.",
    descriptionEl: "Βασικός καμβάς και κείμενο χωρίς ειδικό συντακτικό ρόλο.",
  },
  {
    id: "commands",
    label: "Commands & macros",
    labelEl: "Εντολές & μακροεντολές",
    description: "LaTeX commands, escapes, packages and user macros.",
    descriptionEl: "Εντολές LaTeX, escape χαρακτήρες, πακέτα και μακροεντολές χρήστη.",
  },
  {
    id: "environments",
    label: "Environments",
    labelEl: "Περιβάλλοντα",
    description: "Independent colors for every recognized environment family.",
    descriptionEl: "Ανεξάρτητα χρώματα για κάθε αναγνωρισμένη οικογένεια περιβαλλόντων.",
  },
  {
    id: "structure",
    label: "Document structure",
    labelEl: "Δομή εγγράφου",
    description: "Sections, formatting and cross-references.",
    descriptionEl: "Ενότητες, μορφοποίηση και παραπομπές.",
  },
  {
    id: "mathCommands",
    label: "Math commands",
    labelEl: "Μαθηματικές εντολές",
    description: "Functions, Greek letters, symbols, accents and math fonts.",
    descriptionEl: "Συναρτήσεις, ελληνικά γράμματα, σύμβολα, τόνοι και μαθηματικές γραμματοσειρές.",
  },
  {
    id: "mathOperators",
    label: "Math operators",
    labelEl: "Μαθηματικοί τελεστές",
    description: "Arithmetic, binary, relation, logic, arrow and large operators.",
    descriptionEl: "Αριθμητικοί, δυαδικοί, σχεσιακοί, λογικοί, βέλη και μεγάλοι τελεστές.",
  },
  {
    id: "mathValues",
    label: "Math values & delimiters",
    labelEl: "Μαθηματικές τιμές & οριοθέτες",
    description: "Numbers, variables, indices, punctuation and delimiters in math.",
    descriptionEl: "Αριθμοί, μεταβλητές, δείκτες, στίξη και οριοθέτες στα μαθηματικά.",
  },
  {
    id: "text",
    label: "Text & punctuation",
    labelEl: "Κείμενο & στίξη",
    description: "Comments, numbers, literal text and ordinary delimiters.",
    descriptionEl: "Σχόλια, αριθμοί, κυριολεκτικό κείμενο και κοινοί οριοθέτες.",
  },
  {
    id: "options",
    label: "Options & arguments",
    labelEl: "Επιλογές & ορίσματα",
    description: "Optional keys, values, assignments and required argument blocks.",
    descriptionEl: "Προαιρετικά κλειδιά, τιμές, αναθέσεις και υποχρεωτικά ορίσματα.",
  },
  {
    id: "brackets",
    label: "Nested brackets",
    labelEl: "Ένθετες αγκύλες",
    description: "Monaco bracket-pair levels and unexpected brackets.",
    descriptionEl: "Επίπεδα ζευγών αγκυλών του Monaco και μη αναμενόμενες αγκύλες.",
  },
] as const;

export type LatexSyntaxColorGroupId =
  (typeof LATEX_SYNTAX_COLOR_GROUPS)[number]["id"];

interface LatexSyntaxColorSlotDefinition {
  id: string;
  groupId: LatexSyntaxColorGroupId;
  label: string;
  labelEl: string;
  description: string;
  descriptionEl: string;
  sample: string;
  tokenScopes?: readonly string[];
  editorColorKeys?: readonly string[];
}

const slot = <TId extends string>(
  definition: Omit<LatexSyntaxColorSlotDefinition, "id"> & { id: TId },
) => definition;

/**
 * Stable semantic color slots used by both persistence and the Settings UI.
 * Token scopes are exact Monaco scopes, so changing one slot cannot bleed
 * into an unrelated syntax role through prefix matching.
 */
export const LATEX_SYNTAX_COLOR_SLOTS = [
  slot({
    id: "editorBackground",
    groupId: "appearance",
    label: "Editor background",
    labelEl: "Φόντο επεξεργαστή",
    description: "Canvas behind the source code.",
    descriptionEl: "Ο καμβάς πίσω από τον πηγαίο κώδικα.",
    sample: "LaTeX",
    editorColorKeys: ["editor.background"],
  }),
  slot({
    id: "plainText",
    groupId: "appearance",
    label: "Plain text",
    labelEl: "Απλό κείμενο",
    description: "Text without a more specific syntax role.",
    descriptionEl: "Κείμενο χωρίς ειδικότερο συντακτικό ρόλο.",
    sample: "A short paragraph",
    tokenScopes: ["text.plain.latex", "variable"],
    editorColorKeys: ["editor.foreground"],
  }),

  slot({ id: "controlCommand", groupId: "commands", label: "Control commands", labelEl: "Εντολές ελέγχου", description: "Core document control commands.", descriptionEl: "Βασικές εντολές ελέγχου του εγγράφου.", sample: "\\begin", tokenScopes: ["keyword.control.latex"] }),
  slot({ id: "command", groupId: "commands", label: "General commands", labelEl: "Γενικές εντολές", description: "Ordinary LaTeX and package commands.", descriptionEl: "Κοινές εντολές LaTeX και πακέτων.", sample: "\\includegraphics", tokenScopes: ["keyword.latex"] }),
  slot({ id: "escapedCharacter", groupId: "commands", label: "Escaped characters", labelEl: "Escape χαρακτήρες", description: "Escaped special characters outside math.", descriptionEl: "Ειδικοί χαρακτήρες με escape εκτός μαθηματικών.", sample: "\\%  \\&", tokenScopes: ["keyword.escape.latex"] }),
  slot({ id: "documentClass", groupId: "commands", label: "Document classes", labelEl: "Κλάσεις εγγράφου", description: "Class names in documentclass declarations.", descriptionEl: "Ονόματα κλάσεων στις δηλώσεις documentclass.", sample: "article", tokenScopes: ["entity.name.class.latex"] }),
  slot({ id: "packageName", groupId: "commands", label: "Package names", labelEl: "Ονόματα πακέτων", description: "Package names in usepackage declarations.", descriptionEl: "Ονόματα πακέτων στις δηλώσεις usepackage.", sample: "amsmath", tokenScopes: ["entity.name.package.latex"] }),
  slot({ id: "functionCommand", groupId: "commands", label: "Function commands", labelEl: "Εντολές συναρτήσεων", description: "Recognized function-like LaTeX commands.", descriptionEl: "Αναγνωρισμένες εντολές LaTeX τύπου συνάρτησης.", sample: "\\url", tokenScopes: ["entity.name.function.latex"] }),
  slot({ id: "userMacro", groupId: "commands", label: "User macros", labelEl: "Μακροεντολές χρήστη", description: "Commands defined by the document author.", descriptionEl: "Εντολές που ορίζει ο συγγραφέας του εγγράφου.", sample: "\\mycommand", tokenScopes: ["entity.name.function.user.latex"] }),

  slot({ id: "environmentGeneric", groupId: "environments", label: "Generic environments", labelEl: "Γενικά περιβάλλοντα", description: "Custom or uncategorized environment names.", descriptionEl: "Προσαρμοσμένα ή μη κατηγοριοποιημένα περιβάλλοντα.", sample: "customenv", tokenScopes: ["entity.name.type.environment.latex", "tag"] }),
  slot({ id: "environmentDocument", groupId: "environments", label: "Document environments", labelEl: "Περιβάλλοντα εγγράφου", description: "Top-level document environments.", descriptionEl: "Περιβάλλοντα ανώτατου επιπέδου του εγγράφου.", sample: "document", tokenScopes: ["entity.name.type.environment.document.latex"] }),
  slot({ id: "environmentList", groupId: "environments", label: "List environments", labelEl: "Περιβάλλοντα λιστών", description: "Itemized, enumerated and descriptive lists.", descriptionEl: "Λίστες με κουκκίδες, αρίθμηση ή περιγραφή.", sample: "enumerate", tokenScopes: ["entity.name.type.environment.list.latex"] }),
  slot({ id: "environmentTheorem", groupId: "environments", label: "Theorem environments", labelEl: "Περιβάλλοντα θεωρημάτων", description: "Theorems, lemmas, proofs and related structures.", descriptionEl: "Θεωρήματα, λήμματα, αποδείξεις και συγγενείς δομές.", sample: "theorem", tokenScopes: ["entity.name.type.environment.theorem.latex"] }),
  slot({ id: "environmentFloat", groupId: "environments", label: "Float environments", labelEl: "Κινητά περιβάλλοντα", description: "Figures and other floating content.", descriptionEl: "Εικόνες και άλλο κινητό περιεχόμενο.", sample: "figure", tokenScopes: ["entity.name.type.environment.float.latex"] }),
  slot({ id: "environmentTable", groupId: "environments", label: "Table environments", labelEl: "Περιβάλλοντα πινάκων", description: "Tables, arrays and tabular structures.", descriptionEl: "Πίνακες, arrays και δομές tabular.", sample: "tabular", tokenScopes: ["entity.name.type.environment.table.latex"] }),
  slot({ id: "environmentDrawing", groupId: "environments", label: "Drawing environments", labelEl: "Περιβάλλοντα σχεδίασης", description: "TikZ, PGFPlots and picture environments.", descriptionEl: "Περιβάλλοντα TikZ, PGFPlots και picture.", sample: "tikzpicture", tokenScopes: ["entity.name.type.environment.drawing.latex"] }),
  slot({ id: "environmentVerbatim", groupId: "environments", label: "Verbatim environments", labelEl: "Περιβάλλοντα verbatim", description: "Literal code and verbatim environment names.", descriptionEl: "Κυριολεκτικός κώδικας και ονόματα περιβαλλόντων verbatim.", sample: "lstlisting", tokenScopes: ["entity.name.type.environment.verbatim.latex"] }),
  slot({ id: "environmentMath", groupId: "environments", label: "Math environments", labelEl: "Μαθηματικά περιβάλλοντα", description: "Equation, align, matrix and other math environments.", descriptionEl: "Περιβάλλοντα equation, align, matrix και άλλα μαθηματικά.", sample: "align*", tokenScopes: ["entity.name.type.environment.math.latex"] }),

  slot({ id: "sectionCommand", groupId: "structure", label: "Section commands", labelEl: "Εντολές ενοτήτων", description: "Commands that define the document hierarchy.", descriptionEl: "Εντολές που ορίζουν την ιεραρχία του εγγράφου.", sample: "\\subsection", tokenScopes: ["entity.name.section.latex"] }),
  slot({ id: "sectionTitle", groupId: "structure", label: "Section titles", labelEl: "Τίτλοι ενοτήτων", description: "Text inside section headings.", descriptionEl: "Κείμενο μέσα στις επικεφαλίδες ενοτήτων.", sample: "Results", tokenScopes: ["entity.name.section.content.latex"] }),
  slot({ id: "formattingCommand", groupId: "structure", label: "Formatting commands", labelEl: "Εντολές μορφοποίησης", description: "Commands that change text presentation.", descriptionEl: "Εντολές που αλλάζουν την εμφάνιση του κειμένου.", sample: "\\textbf", tokenScopes: ["entity.name.function.formatting.latex"] }),
  slot({ id: "formattedText", groupId: "structure", label: "Formatted text", labelEl: "Μορφοποιημένο κείμενο", description: "Text inside formatting commands.", descriptionEl: "Κείμενο μέσα σε εντολές μορφοποίησης.", sample: "important", tokenScopes: ["text.formatting.latex"] }),
  slot({ id: "referenceCommand", groupId: "structure", label: "Reference commands", labelEl: "Εντολές παραπομπών", description: "Labels, references and citation commands.", descriptionEl: "Εντολές labels, παραπομπών και βιβλιογραφικών αναφορών.", sample: "\\cite", tokenScopes: ["entity.name.reference.latex"] }),
  slot({ id: "referenceKey", groupId: "structure", label: "Reference keys", labelEl: "Κλειδιά παραπομπών", description: "Keys used by labels, references and citations.", descriptionEl: "Κλειδιά που χρησιμοποιούνται σε labels, παραπομπές και citations.", sample: "smith2025", tokenScopes: ["entity.name.reference.content.latex"] }),

  slot({ id: "mathDelimiterCommand", groupId: "mathCommands", label: "Math boundary commands", labelEl: "Εντολές ορίων μαθηματικών", description: "Commands and tokens that open or close math mode.", descriptionEl: "Εντολές και tokens που ανοίγουν ή κλείνουν μαθηματική λειτουργία.", sample: "\\[  \\]", tokenScopes: ["keyword.math.delimiter.latex"] }),
  slot({ id: "mathFunction", groupId: "mathCommands", label: "Math functions", labelEl: "Μαθηματικές συναρτήσεις", description: "Named functions such as sin, log and lim.", descriptionEl: "Ονομαστικές συναρτήσεις όπως sin, log και lim.", sample: "\\sin", tokenScopes: ["entity.name.function.math.latex", "support.function.math.latex"] }),
  slot({ id: "mathCommand", groupId: "mathCommands", label: "Other math commands", labelEl: "Άλλες μαθηματικές εντολές", description: "Math commands without a more specific role.", descriptionEl: "Μαθηματικές εντολές χωρίς ειδικότερο ρόλο.", sample: "\\custommath", tokenScopes: ["keyword.math.latex"] }),
  slot({ id: "mathEscape", groupId: "mathCommands", label: "Math escapes", labelEl: "Math escape χαρακτήρες", description: "Escaped special characters inside math.", descriptionEl: "Ειδικοί χαρακτήρες με escape μέσα στα μαθηματικά.", sample: "\\{  \\}", tokenScopes: ["keyword.escape.math.latex"] }),
  slot({ id: "mathGreek", groupId: "mathCommands", label: "Greek letters", labelEl: "Ελληνικά γράμματα", description: "Greek letter commands in math mode.", descriptionEl: "Εντολές ελληνικών γραμμάτων σε μαθηματική λειτουργία.", sample: "\\alpha", tokenScopes: ["constant.language.math.greek.latex"] }),
  slot({ id: "mathSymbol", groupId: "mathCommands", label: "Math symbols", labelEl: "Μαθηματικά σύμβολα", description: "Named constants and miscellaneous symbols.", descriptionEl: "Ονομαστικές σταθερές και διάφορα σύμβολα.", sample: "\\infty", tokenScopes: ["constant.language.math.symbol.latex"] }),
  slot({ id: "mathAccent", groupId: "mathCommands", label: "Math accents", labelEl: "Μαθηματικοί τόνοι", description: "Accents, hats, bars and vector decorators.", descriptionEl: "Τόνοι, καπέλα, γραμμές και διανυσματικοί δείκτες.", sample: "\\hat{x}", tokenScopes: ["entity.name.function.math.accent.latex"] }),
  slot({ id: "mathFont", groupId: "mathCommands", label: "Math fonts", labelEl: "Μαθηματικές γραμματοσειρές", description: "Commands that select a mathematical alphabet.", descriptionEl: "Εντολές που επιλέγουν μαθηματικό αλφάβητο.", sample: "\\mathbb{R}", tokenScopes: ["storage.type.math.font.latex"] }),
  slot({ id: "mathSizedDelimiter", groupId: "mathCommands", label: "Sized delimiters", labelEl: "Οριοθέτες μεταβλητού μεγέθους", description: "Commands such as left, right, big and Big.", descriptionEl: "Εντολές όπως left, right, big και Big.", sample: "\\left(", tokenScopes: ["keyword.math.delimiter.command.latex"] }),
  slot({ id: "mathSpacing", groupId: "mathCommands", label: "Math spacing", labelEl: "Μαθηματικά διαστήματα", description: "Explicit spacing commands in formulas.", descriptionEl: "Ρητές εντολές διαστήματος σε τύπους.", sample: "\\quad", tokenScopes: ["keyword.math.spacing.latex"] }),
  slot({ id: "mathText", groupId: "mathCommands", label: "Text in math", labelEl: "Κείμενο στα μαθηματικά", description: "Natural-language text embedded in formulas.", descriptionEl: "Κείμενο φυσικής γλώσσας ενσωματωμένο σε τύπους.", sample: "\\text{if}", tokenScopes: ["string.math.text.latex", "string.math"] }),

  slot({ id: "mathLargeOperator", groupId: "mathOperators", label: "Large operators", labelEl: "Μεγάλοι τελεστές", description: "Sums, products, integrals and related operators.", descriptionEl: "Αθροίσματα, γινόμενα, ολοκληρώματα και συγγενείς τελεστές.", sample: "\\sum", tokenScopes: ["keyword.operator.math.large.latex"] }),
  slot({ id: "mathBinaryOperator", groupId: "mathOperators", label: "Binary operators", labelEl: "Δυαδικοί τελεστές", description: "Named binary operations such as times and cup.", descriptionEl: "Ονομαστικές δυαδικές πράξεις όπως times και cup.", sample: "\\times", tokenScopes: ["keyword.operator.math.binary.latex"] }),
  slot({ id: "mathRelationCommand", groupId: "mathOperators", label: "Relation commands", labelEl: "Εντολές σχέσεων", description: "Named equality, ordering and set relations.", descriptionEl: "Ονομαστικές σχέσεις ισότητας, διάταξης και συνόλων.", sample: "\\leq", tokenScopes: ["keyword.operator.math.relation.latex"] }),
  slot({ id: "mathArrow", groupId: "mathOperators", label: "Arrows", labelEl: "Βέλη", description: "Arrow and mapping commands.", descriptionEl: "Εντολές βελών και απεικονίσεων.", sample: "\\longrightarrow", tokenScopes: ["keyword.operator.math.arrow.latex"] }),
  slot({ id: "mathArithmetic", groupId: "mathOperators", label: "Arithmetic operators", labelEl: "Αριθμητικοί τελεστές", description: "Literal arithmetic signs such as plus and minus.", descriptionEl: "Κυριολεκτικά αριθμητικά σύμβολα όπως συν και πλην.", sample: "+ − × ÷", tokenScopes: ["keyword.operator.math.arithmetic.latex"] }),
  slot({ id: "mathRelationSymbol", groupId: "mathOperators", label: "Relation symbols", labelEl: "Σύμβολα σχέσεων", description: "Literal relation signs such as equals and less-than.", descriptionEl: "Κυριολεκτικά σύμβολα σχέσεων όπως ίσον και μικρότερο.", sample: "= ≤ ≥", tokenScopes: ["keyword.operator.math.relation.symbol.latex"] }),
  slot({ id: "mathLogicOperator", groupId: "mathOperators", label: "Logic operators", labelEl: "Λογικοί τελεστές", description: "Logical conjunction, disjunction and quantifiers.", descriptionEl: "Λογική σύζευξη, διάζευξη και ποσοδείκτες.", sample: "∧ ∨ ¬", tokenScopes: ["keyword.operator.math.logic.latex"] }),
  slot({ id: "mathAlignment", groupId: "mathOperators", label: "Alignment markers", labelEl: "Δείκτες στοίχισης", description: "Alignment separators in multiline formulas.", descriptionEl: "Διαχωριστικά στοίχισης σε τύπους πολλών γραμμών.", sample: "&", tokenScopes: ["keyword.operator.alignment.math.latex"] }),
  slot({ id: "mathPrime", groupId: "mathOperators", label: "Prime markers", labelEl: "Δείκτες prime", description: "Prime and derivative apostrophes.", descriptionEl: "Απόστροφοι prime και παραγώγων.", sample: "f′′", tokenScopes: ["keyword.operator.prime.math.latex"] }),
  slot({ id: "mathGenericOperator", groupId: "mathOperators", label: "Other math operators", labelEl: "Άλλοι μαθηματικοί τελεστές", description: "Fallback for operators without a finer category.", descriptionEl: "Εφεδρική κατηγορία για τελεστές χωρίς λεπτομερέστερο ρόλο.", sample: "⊙", tokenScopes: ["keyword.operator.math.latex"] }),

  slot({ id: "mathNumber", groupId: "mathValues", label: "Math numbers", labelEl: "Μαθηματικοί αριθμοί", description: "Integer and decimal literals in formulas.", descriptionEl: "Ακέραιες και δεκαδικές τιμές σε τύπους.", sample: "3.14159", tokenScopes: ["constant.numeric.math.latex"] }),
  slot({ id: "mathVariable", groupId: "mathValues", label: "Math variables", labelEl: "Μαθηματικές μεταβλητές", description: "Latin and Unicode variable identifiers.", descriptionEl: "Λατινικά και Unicode αναγνωριστικά μεταβλητών.", sample: "x y z", tokenScopes: ["variable.math.latex"] }),
  slot({ id: "mathSubscript", groupId: "mathValues", label: "Subscripts & superscripts", labelEl: "Δείκτες & εκθέτες", description: "Subscript and superscript operator markers.", descriptionEl: "Δείκτες τελεστών subscript και superscript.", sample: "x₂ⁿ", tokenScopes: ["keyword.operator.subscript.latex"] }),
  slot({ id: "mathPunctuation", groupId: "mathValues", label: "Math punctuation", labelEl: "Μαθηματική στίξη", description: "Commas, semicolons and punctuation in formulas.", descriptionEl: "Κόμματα, ελληνικά ερωτηματικά και στίξη σε τύπους.", sample: ", ; :", tokenScopes: ["delimiter.punctuation.math.latex"] }),
  slot({ id: "mathCurlyBrace", groupId: "mathValues", label: "Math curly braces", labelEl: "Μαθηματικά άγκιστρα", description: "Curly delimiters in math mode.", descriptionEl: "Άγκιστρα σε μαθηματική λειτουργία.", sample: "{x}", tokenScopes: ["delimiter.curly.math.latex"] }),
  slot({ id: "mathSquareBracket", groupId: "mathValues", label: "Math square brackets", labelEl: "Μαθηματικές αγκύλες", description: "Square delimiters in math mode.", descriptionEl: "Τετράγωνες αγκύλες σε μαθηματική λειτουργία.", sample: "[x]", tokenScopes: ["delimiter.bracket.math.latex"] }),
  slot({ id: "mathParenthesis", groupId: "mathValues", label: "Math parentheses", labelEl: "Μαθηματικές παρενθέσεις", description: "Round delimiters in math mode.", descriptionEl: "Στρογγυλές παρενθέσεις σε μαθηματική λειτουργία.", sample: "(x)", tokenScopes: ["delimiter.parenthesis.math.latex"] }),

  slot({ id: "comment", groupId: "text", label: "Comments", labelEl: "Σχόλια", description: "Line comments and their content.", descriptionEl: "Σχόλια γραμμής και το περιεχόμενό τους.", sample: "% note", tokenScopes: ["comment.line.latex", "comment.content.latex"] }),
  slot({ id: "number", groupId: "text", label: "Text-mode numbers", labelEl: "Αριθμοί κειμένου", description: "Numbers outside math and package options.", descriptionEl: "Αριθμοί εκτός μαθηματικών και επιλογών πακέτων.", sample: "2026", tokenScopes: ["constant.numeric.latex", "number"] }),
  slot({ id: "curlyBrace", groupId: "text", label: "Curly braces", labelEl: "Άγκιστρα", description: "Ordinary curly argument delimiters.", descriptionEl: "Κοινά άγκιστρα ορισμάτων.", sample: "{text}", tokenScopes: ["delimiter.curly.latex"] }),
  slot({ id: "squareBracket", groupId: "text", label: "Square brackets", labelEl: "Τετράγωνες αγκύλες", description: "Ordinary square delimiters.", descriptionEl: "Κοινές τετράγωνες αγκύλες.", sample: "[text]", tokenScopes: ["delimiter.bracket.latex"] }),
  slot({ id: "parenthesis", groupId: "text", label: "Parentheses", labelEl: "Παρενθέσεις", description: "Ordinary round delimiters.", descriptionEl: "Κοινές στρογγυλές παρενθέσεις.", sample: "(text)", tokenScopes: ["delimiter.parenthesis.latex"] }),
  slot({ id: "textOperator", groupId: "text", label: "Text-mode operators", labelEl: "Τελεστές κειμένου", description: "Operators outside math mode.", descriptionEl: "Τελεστές εκτός μαθηματικής λειτουργίας.", sample: "=", tokenScopes: ["keyword.operator.latex"] }),
  slot({ id: "comma", groupId: "text", label: "Commas", labelEl: "Κόμματα", description: "Comma separators outside math.", descriptionEl: "Διαχωριστικά κόμματος εκτός μαθηματικών.", sample: ",", tokenScopes: ["delimiter.comma.latex"] }),
  slot({ id: "verbatimText", groupId: "text", label: "Verbatim text", labelEl: "Κείμενο verbatim", description: "Literal source in verbatim, minted and listings.", descriptionEl: "Κυριολεκτικός κώδικας σε verbatim, minted και listings.", sample: "const x = 1;", tokenScopes: ["string.verbatim.latex"] }),

  slot({ id: "optionBracket", groupId: "options", label: "Option brackets", labelEl: "Αγκύλες επιλογών", description: "Brackets surrounding optional arguments.", descriptionEl: "Αγκύλες γύρω από προαιρετικά ορίσματα.", sample: "[width=2cm]", tokenScopes: ["meta.bracket.latex"] }),
  slot({ id: "requiredArgument", groupId: "options", label: "Required arguments", labelEl: "Υποχρεωτικά ορίσματα", description: "Required argument blocks passed to commands.", descriptionEl: "Μπλοκ υποχρεωτικών ορισμάτων που δίνονται σε εντολές.", sample: "{article}", tokenScopes: ["meta.block.latex"] }),
  slot({ id: "optionName", groupId: "options", label: "Option names", labelEl: "Ονόματα επιλογών", description: "Keys in package, TikZ and command options.", descriptionEl: "Κλειδιά σε επιλογές πακέτων, TikZ και εντολών.", sample: "line width", tokenScopes: ["attribute.name.latex", "attribute.name"] }),
  slot({ id: "optionAssignment", groupId: "options", label: "Option assignment", labelEl: "Ανάθεση επιλογών", description: "Equals signs that assign option values.", descriptionEl: "Σύμβολα ίσον που αναθέτουν τιμές επιλογών.", sample: "=", tokenScopes: ["keyword.operator.assignment.latex"] }),
  slot({ id: "optionValue", groupId: "options", label: "Option values", labelEl: "Τιμές επιλογών", description: "Text values in optional arguments.", descriptionEl: "Τιμές κειμένου σε προαιρετικά ορίσματα.", sample: "red", tokenScopes: ["string.option-value.latex", "string"] }),
  slot({ id: "optionNumber", groupId: "options", label: "Option numbers", labelEl: "Αριθμοί επιλογών", description: "Numeric values and dimensions in options.", descriptionEl: "Αριθμητικές τιμές και διαστάσεις σε επιλογές.", sample: "0.7pt", tokenScopes: ["constant.numeric.option.latex"] }),

  ...([1, 2, 3, 4, 5, 6] as const).map((level) =>
    slot({
      id: `bracketLevel${level}` as const,
      groupId: "brackets",
      label: `Bracket level ${level}`,
      labelEl: `Επίπεδο αγκυλών ${level}`,
      description: `Color used for nested bracket-pair level ${level}.`,
      descriptionEl: `Χρώμα για το επίπεδο ${level} ένθετων ζευγών αγκυλών.`,
      sample: `${"(".repeat(level)}x${")".repeat(level)}`,
      editorColorKeys: [`editorBracketHighlight.foreground${level}`],
    }),
  ),
  slot({
    id: "unexpectedBracket",
    groupId: "brackets",
    label: "Unexpected bracket",
    labelEl: "Μη αναμενόμενη αγκύλη",
    description: "Unmatched or structurally invalid brackets.",
    descriptionEl: "Αταίριαστες ή δομικά μη έγκυρες αγκύλες.",
    sample: "}",
    editorColorKeys: ["editorBracketHighlight.unexpectedBracket.foreground"],
  }),
] as const;

export type LatexSyntaxColorSlotId =
  (typeof LATEX_SYNTAX_COLOR_SLOTS)[number]["id"];

export const LATEX_SYNTAX_FONT_STYLES = [
  "bold",
  "italic",
  "underline",
  "strikethrough",
] as const;

export type LatexSyntaxFontStyle =
  (typeof LATEX_SYNTAX_FONT_STYLES)[number];

/**
 * Every flag is deliberately tri-state:
 * - `undefined` inherits the bundled theme;
 * - `true` forces the style on;
 * - `false` forces it off, including styles enabled by the bundled theme.
 */
export interface LatexSyntaxFontStyleOverrides {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
}

export interface LatexSyntaxSlotOverride {
  foreground?: string;
  fontStyles?: LatexSyntaxFontStyleOverrides;
}

export type LatexSyntaxSlotOverrides = Partial<
  Record<LatexSyntaxColorSlotId, LatexSyntaxSlotOverride>
>;

/** @deprecated Prefer LatexSyntaxSlotOverrides. */
export type LatexSyntaxColorOverrides = LatexSyntaxSlotOverrides;

export type LatexSyntaxThemeOverrides = Partial<
  Record<LatexEditorThemeId, LatexSyntaxSlotOverrides>
>;

export interface LatexSyntaxHighlightingSettings {
  version: 2;
  themes: LatexSyntaxThemeOverrides;
}

export const DEFAULT_LATEX_SYNTAX_HIGHLIGHTING: LatexSyntaxHighlightingSettings =
  Object.freeze({
    version: 2 as const,
    themes: Object.freeze({}) as LatexSyntaxThemeOverrides,
  });

export interface LatexMonacoThemeData {
  base: "vs" | "vs-dark" | "hc-black";
  inherit: boolean;
  rules: Array<{
    token: string;
    foreground?: string;
    background?: string;
    fontStyle?: string;
  }>;
  colors: Record<string, string>;
  encodedTokensColors?: string[];
}

const BASE_THEMES: Record<LatexEditorThemeId, LatexMonacoThemeData> = {
  "data-tex-dark": dataTexDarkTheme,
  "data-tex-light": dataTexLightTheme,
  "data-tex-hc": dataTexHCTheme,
  "data-tex-monokai": monokaiTheme,
  "data-tex-nord": nordTheme,
};

const THEME_ID_SET = new Set<string>(LATEX_EDITOR_THEME_IDS);
const SLOT_ID_SET = new Set<string>(
  LATEX_SYNTAX_COLOR_SLOTS.map(({ id }) => id),
);

const slotDefinitions = new Map<
  LatexSyntaxColorSlotId,
  (typeof LATEX_SYNTAX_COLOR_SLOTS)[number]
>(LATEX_SYNTAX_COLOR_SLOTS.map((definition) => [definition.id, definition]));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isLatexEditorThemeId = (
  value: unknown,
): value is LatexEditorThemeId =>
  typeof value === "string" && THEME_ID_SET.has(value);

export const isLatexSyntaxColorSlotId = (
  value: unknown,
): value is LatexSyntaxColorSlotId =>
  typeof value === "string" && SLOT_ID_SET.has(value);

/** Normalize accepted UI input to the only persisted format: #RRGGBB. */
export function normalizeLatexSyntaxColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  const candidate = value.trim();
  const shortMatch = /^#?([0-9a-f]{3})$/i.exec(candidate);
  if (shortMatch) {
    const expanded = [...shortMatch[1]]
      .map((character) => character.repeat(2))
      .join("");
    return `#${expanded.toUpperCase()}`;
  }

  const fullMatch = /^#?([0-9a-f]{6})$/i.exec(candidate);
  return fullMatch ? `#${fullMatch[1].toUpperCase()}` : undefined;
}

function sanitizeLatexSyntaxFontStyleOverrides(
  value: unknown,
): LatexSyntaxFontStyleOverrides | undefined {
  if (!isRecord(value)) return undefined;

  const sanitized: LatexSyntaxFontStyleOverrides = {};
  for (const style of LATEX_SYNTAX_FONT_STYLES) {
    const enabled = value[style];
    if (typeof enabled === "boolean") sanitized[style] = enabled;
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function sanitizeLatexSyntaxSlotOverride(
  slotId: LatexSyntaxColorSlotId,
  value: unknown,
): LatexSyntaxSlotOverride | undefined {
  // Version 1 persisted each semantic slot directly as a color string.
  const legacyForeground = normalizeLatexSyntaxColor(value);
  if (legacyForeground) return { foreground: legacyForeground };
  if (!isRecord(value)) return undefined;

  const sanitized: LatexSyntaxSlotOverride = {};
  const foreground = normalizeLatexSyntaxColor(value.foreground);
  if (foreground) sanitized.foreground = foreground;

  // Monaco token rules support font styles, while editor color entries (the
  // editor canvas and bracket-pair colors) do not. Dropping unsupported values
  // prevents persisted overrides that appear customized but have no effect.
  const definition = slotDefinitions.get(slotId);
  if ((definition?.tokenScopes?.length ?? 0) > 0) {
    const fontStyles = sanitizeLatexSyntaxFontStyleOverrides(value.fontStyles);
    if (fontStyles) sanitized.fontStyles = fontStyles;
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export function sanitizeLatexSyntaxColorOverrides(
  value: unknown,
): LatexSyntaxSlotOverrides {
  if (!isRecord(value)) return {};

  const sanitized: LatexSyntaxSlotOverrides = {};
  for (const [slotId, override] of Object.entries(value)) {
    if (!isLatexSyntaxColorSlotId(slotId)) continue;
    const slotOverride = sanitizeLatexSyntaxSlotOverride(slotId, override);
    if (slotOverride) sanitized[slotId] = slotOverride;
  }
  return sanitized;
}

export function sanitizeLatexSyntaxThemeOverrides(
  value: unknown,
): LatexSyntaxThemeOverrides {
  if (!isRecord(value)) return {};

  const sanitized: LatexSyntaxThemeOverrides = {};
  for (const [themeId, overrides] of Object.entries(value)) {
    if (!isLatexEditorThemeId(themeId)) continue;
    const themeOverrides = sanitizeLatexSyntaxColorOverrides(overrides);
    if (Object.keys(themeOverrides).length > 0) {
      sanitized[themeId] = themeOverrides;
    }
  }
  return sanitized;
}

export function sanitizeLatexSyntaxHighlightingSettings(
  value: unknown,
): LatexSyntaxHighlightingSettings {
  if (!isRecord(value)) return { version: 2, themes: {} };
  return {
    version: 2,
    themes: sanitizeLatexSyntaxThemeOverrides(value.themes),
  };
}

const withoutHash = (color: string): string => color.slice(1);

type ResolvedLatexSyntaxFontStyles = Record<LatexSyntaxFontStyle, boolean>;

const EMPTY_FONT_STYLES: ResolvedLatexSyntaxFontStyles = {
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
};

function parseLatexSyntaxFontStyles(
  fontStyle: string | undefined,
): ResolvedLatexSyntaxFontStyles {
  const parsed = { ...EMPTY_FONT_STYLES };
  if (!fontStyle) return parsed;

  const segments = new Set(fontStyle.trim().split(/\s+/));
  for (const style of LATEX_SYNTAX_FONT_STYLES) {
    parsed[style] = segments.has(style);
  }
  return parsed;
}

function mergeLatexSyntaxFontStyles(
  baseFontStyle: string | undefined,
  overrides: LatexSyntaxFontStyleOverrides,
): ResolvedLatexSyntaxFontStyles {
  const merged = parseLatexSyntaxFontStyles(baseFontStyle);
  for (const style of LATEX_SYNTAX_FONT_STYLES) {
    const enabled = overrides[style];
    if (enabled !== undefined) merged[style] = enabled;
  }
  return merged;
}

function serializeLatexSyntaxFontStyles(
  fontStyles: ResolvedLatexSyntaxFontStyles,
): string {
  return LATEX_SYNTAX_FONT_STYLES.filter((style) => fontStyles[style]).join(
    " ",
  );
}

/**
 * Clone a bundled theme and apply a single theme's semantic overrides.
 * Base theme objects and rule objects are never mutated; font styles and all
 * non-color properties survive an override unchanged.
 */
export function buildLatexTheme(
  themeId: LatexEditorThemeId,
  overrides: LatexSyntaxSlotOverrides = {},
): LatexMonacoThemeData {
  const baseTheme = BASE_THEMES[themeId];
  const sanitized = sanitizeLatexSyntaxColorOverrides(overrides);
  const tokenOverrides = new Map<string, LatexSyntaxSlotOverride>();
  const editorColors = new Map<string, string>();

  for (const [slotId, override] of Object.entries(sanitized) as Array<
    [LatexSyntaxColorSlotId, LatexSyntaxSlotOverride]
  >) {
    const definition = slotDefinitions.get(slotId);
    if (!definition) continue;
    for (const scope of definition.tokenScopes ?? []) {
      tokenOverrides.set(scope, override);
    }
    if (override.foreground) {
      for (const colorKey of definition.editorColorKeys ?? []) {
        editorColors.set(colorKey, override.foreground);
      }
    }
  }

  return {
    ...baseTheme,
    rules: baseTheme.rules.map((themeRule) => {
      const override = tokenOverrides.get(themeRule.token);
      if (!override) return { ...themeRule };

      const customizedRule = { ...themeRule };
      if (override.foreground) {
        customizedRule.foreground = withoutHash(override.foreground);
      }
      if (override.fontStyles) {
        // An empty string is meaningful to Monaco: it explicitly clears all
        // inherited styles. Omitting the property would restore the base rule.
        customizedRule.fontStyle = serializeLatexSyntaxFontStyles(
          mergeLatexSyntaxFontStyles(themeRule.fontStyle, override.fontStyles),
        );
      }
      return customizedRule;
    }),
    colors: {
      ...baseTheme.colors,
      ...Object.fromEntries(editorColors),
    },
    ...(baseTheme.encodedTokensColors
      ? { encodedTokensColors: [...baseTheme.encodedTokensColors] }
      : {}),
  };
}

export function getResolvedLatexSyntaxColor(
  themeId: LatexEditorThemeId,
  slotId: LatexSyntaxColorSlotId,
  overrides: LatexSyntaxSlotOverrides = {},
): string {
  const customized = sanitizeLatexSyntaxSlotOverride(
    slotId,
    overrides[slotId],
  )?.foreground;
  if (customized) return customized;

  const definition = slotDefinitions.get(slotId);
  const baseTheme = BASE_THEMES[themeId];
  for (const colorKey of definition?.editorColorKeys ?? []) {
    const color = normalizeLatexSyntaxColor(baseTheme.colors[colorKey]);
    if (color) return color;
  }
  for (const scope of definition?.tokenScopes ?? []) {
    const themeRule = baseTheme.rules.find((rule) => rule.token === scope);
    const color = normalizeLatexSyntaxColor(themeRule?.foreground);
    if (color) return color;
  }

  // Every exported slot is backed by a bundled theme value. This fallback is
  // deliberately deterministic if a future theme accidentally omits one.
  return normalizeLatexSyntaxColor(baseTheme.colors["editor.foreground"]) ?? "#000000";
}

export type LatexSyntaxResolvedFontStyleState = Record<
  LatexSyntaxFontStyle,
  boolean | "mixed"
>;

/**
 * Resolve the effective typography displayed by a semantic slot.
 *
 * A slot can own an exact DataTex scope and a Monaco compatibility scope. If
 * their bundled styles differ and no override unifies them, the corresponding
 * value is `"mixed"`, allowing the Settings UI to render an indeterminate
 * control instead of guessing.
 */
export function getResolvedLatexSyntaxFontStyles(
  themeId: LatexEditorThemeId,
  slotId: LatexSyntaxColorSlotId,
  overrides: LatexSyntaxSlotOverrides = {},
): LatexSyntaxResolvedFontStyleState {
  const baseTheme = BASE_THEMES[themeId];
  const definition = slotDefinitions.get(slotId);
  const slotOverride = sanitizeLatexSyntaxSlotOverride(
    slotId,
    overrides[slotId],
  );
  const scopedStyles = (definition?.tokenScopes ?? [])
    .map((scope) => baseTheme.rules.find((rule) => rule.token === scope))
    .filter((rule): rule is LatexMonacoThemeData["rules"][number] => !!rule)
    .map((rule) =>
      slotOverride?.fontStyles
        ? mergeLatexSyntaxFontStyles(rule.fontStyle, slotOverride.fontStyles)
        : parseLatexSyntaxFontStyles(rule.fontStyle),
    );

  if (scopedStyles.length === 0) return { ...EMPTY_FONT_STYLES };

  return Object.fromEntries(
    LATEX_SYNTAX_FONT_STYLES.map((style) => {
      const first = scopedStyles[0][style];
      const mixed = scopedStyles.some((current) => current[style] !== first);
      return [style, mixed ? "mixed" : first];
    }),
  ) as LatexSyntaxResolvedFontStyleState;
}

export function getLatexThemeBackground(
  themeId: LatexEditorThemeId,
  overrides: LatexSyntaxSlotOverrides = {},
): string {
  return getResolvedLatexSyntaxColor(themeId, "editorBackground", overrides);
}
