export interface LatexSyntaxPalette {
  foreground: string;
  control: string;
  command: string;
  escaped: string;
  environment: string;
  mathEnvironment: string;
  className: string;
  packageName: string;
  section: string;
  sectionContent: string;
  formatting: string;
  formattedText: string;
  reference: string;
  referenceContent: string;
  functionName: string;
  userMacro: string;
  mathDelimiter: string;
  mathFunction: string;
  mathFallback: string;
  mathEscaped: string;
  mathArithmetic: string;
  mathBinary: string;
  mathLarge: string;
  mathRelation: string;
  mathRelationSymbol: string;
  mathLogic: string;
  mathArrow: string;
  mathGreek: string;
  mathSymbol: string;
  mathAccent: string;
  mathFont: string;
  mathDelimiterCommand: string;
  mathSpacing: string;
  mathText: string;
  mathNumber: string;
  mathVariable: string;
  mathSubscript: string;
  mathAlignment: string;
  mathPrime: string;
  mathPunctuation: string;
  mathCurly: string;
  mathBracket: string;
  mathParenthesis: string;
  comment: string;
  number: string;
  curly: string;
  bracket: string;
  parenthesis: string;
  operator: string;
  comma: string;
  optionBracket: string;
  requiredBlock: string;
  optionName: string;
  assignment: string;
  optionValue: string;
  optionNumber: string;
  verbatim: string;
}

export interface LatexThemeRuleOptions {
  highContrast?: boolean;
}

export interface LatexThemeRule {
  token: string;
  foreground: string;
  fontStyle?: string;
}

const rule = (
  token: string,
  foreground: string,
  fontStyle?: string,
): LatexThemeRule => ({
  token,
  foreground,
  ...(fontStyle ? { fontStyle } : {}),
});

/**
 * Produces one complete LaTeX token map for every bundled Monaco theme.
 * Keeping the semantic scopes here prevents a grammar addition from silently
 * falling back in just one of the visual themes.
 */
export const createLatexThemeRules = (
  palette: LatexSyntaxPalette,
  { highContrast = false }: LatexThemeRuleOptions = {},
): LatexThemeRule[] => [
  // Document structure and general commands.
  rule("text.plain.latex", palette.foreground),
  rule("keyword.control.latex", palette.control, "bold"),
  rule("keyword.latex", palette.command),
  rule("keyword.escape.latex", palette.escaped),
  rule("entity.name.type.environment.latex", palette.environment),
  rule("entity.name.type.environment.document.latex", palette.control, "bold"),
  rule("entity.name.type.environment.list.latex", palette.formatting),
  rule("entity.name.type.environment.theorem.latex", palette.section, "bold"),
  rule(
    "entity.name.type.environment.float.latex",
    palette.reference,
    highContrast ? "italic underline" : "italic",
  ),
  rule("entity.name.type.environment.table.latex", palette.packageName),
  rule("entity.name.type.environment.drawing.latex", palette.userMacro),
  rule(
    "entity.name.type.environment.verbatim.latex",
    palette.verbatim,
    "italic",
  ),
  rule(
    "entity.name.type.environment.math.latex",
    palette.mathEnvironment,
    "bold italic",
  ),
  rule("entity.name.class.latex", palette.className),
  rule("entity.name.package.latex", palette.packageName),
  rule("entity.name.section.latex", palette.section, "bold"),
  rule("entity.name.section.content.latex", palette.sectionContent),
  rule("entity.name.function.formatting.latex", palette.formatting),
  rule("text.formatting.latex", palette.formattedText),
  rule(
    "entity.name.reference.latex",
    palette.reference,
    highContrast ? "italic underline" : "italic",
  ),
  rule("entity.name.reference.content.latex", palette.referenceContent),
  rule("entity.name.function.latex", palette.functionName),
  rule("entity.name.function.user.latex", palette.userMacro, "bold"),

  // Math boundaries and generic fallbacks.
  rule("keyword.math.delimiter.latex", palette.mathDelimiter, "bold"),
  rule("entity.name.function.math.latex", palette.mathFunction),
  rule("support.function.math.latex", palette.mathFunction),
  rule("keyword.math.latex", palette.mathFallback),
  rule("keyword.escape.math.latex", palette.mathEscaped),
  rule(
    "keyword.math.delimiter.command.latex",
    palette.mathDelimiterCommand,
    "bold",
  ),
  rule("keyword.math.spacing.latex", palette.mathSpacing),
  rule("string.math.text.latex", palette.mathText, "italic"),

  // Math commands are semantic rather than package-specific. Unknown package
  // commands continue to use keyword.math.latex above.
  rule("constant.language.math.greek.latex", palette.mathGreek, "italic"),
  rule("constant.language.math.symbol.latex", palette.mathSymbol),
  rule("entity.name.function.math.accent.latex", palette.mathAccent, "italic"),
  rule("storage.type.math.font.latex", palette.mathFont, "bold"),
  rule("keyword.operator.math.large.latex", palette.mathLarge, "bold"),
  rule(
    "keyword.operator.math.binary.latex",
    palette.mathBinary,
    highContrast ? "bold" : undefined,
  ),
  rule(
    "keyword.operator.math.relation.latex",
    palette.mathRelation,
    highContrast ? "underline" : undefined,
  ),
  rule(
    "keyword.operator.math.arrow.latex",
    palette.mathArrow,
    highContrast ? "underline" : undefined,
  ),
  rule(
    "keyword.operator.math.arithmetic.latex",
    palette.mathArithmetic,
    highContrast ? "bold" : undefined,
  ),
  rule(
    "keyword.operator.math.relation.symbol.latex",
    palette.mathRelationSymbol,
    highContrast ? "bold underline" : undefined,
  ),
  rule(
    "keyword.operator.math.logic.latex",
    palette.mathLogic,
    highContrast ? "bold underline" : undefined,
  ),
  rule(
    "keyword.operator.alignment.math.latex",
    palette.mathAlignment,
    highContrast ? "bold" : undefined,
  ),
  rule("keyword.operator.prime.math.latex", palette.mathPrime, "bold"),

  // Math literals, variables, punctuation and delimiter fallbacks.
  rule("keyword.operator.math.latex", palette.mathArithmetic),
  rule("keyword.operator.subscript.latex", palette.mathSubscript, "bold"),
  rule(
    "constant.numeric.math.latex",
    palette.mathNumber,
    highContrast ? "bold" : undefined,
  ),
  rule("variable.math.latex", palette.mathVariable),
  rule("delimiter.punctuation.math.latex", palette.mathPunctuation),
  rule("delimiter.curly.math.latex", palette.mathCurly),
  rule("delimiter.bracket.math.latex", palette.mathBracket),
  rule("delimiter.parenthesis.math.latex", palette.mathParenthesis),

  // Comments, ordinary arguments and package option key/value syntax.
  rule("comment.line.latex", palette.comment, "italic"),
  rule("comment.content.latex", palette.comment, "italic"),
  rule("constant.numeric.latex", palette.number),
  rule("delimiter.curly.latex", palette.curly),
  rule("delimiter.bracket.latex", palette.bracket),
  rule("delimiter.parenthesis.latex", palette.parenthesis),
  rule("delimiter.comma.latex", palette.comma),
  rule("keyword.operator.latex", palette.operator),
  rule("meta.bracket.latex", palette.optionBracket),
  rule("meta.block.latex", palette.requiredBlock),
  rule(
    "attribute.name.latex",
    palette.optionName,
    highContrast ? "underline" : undefined,
  ),
  rule("keyword.operator.assignment.latex", palette.assignment, "bold"),
  rule("string.option-value.latex", palette.optionValue),
  rule("constant.numeric.option.latex", palette.optionNumber),
  rule("string.verbatim.latex", palette.verbatim, "italic"),

  // Monaco/built-in LaTeX compatibility for secondary editor models.
  rule("string", palette.optionValue),
  rule("string.math", palette.mathText),
  rule("variable", palette.foreground),
  rule("number", palette.number),
  rule("tag", palette.environment),
  rule("attribute.name", palette.optionName),
];
