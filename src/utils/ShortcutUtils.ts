import { KeyMod, KeyCode } from "monaco-editor";

/**
 * Standardizes a keyboard event into a string representation.
 * Format examples: "Ctrl+S", "Ctrl+Shift+P", "Alt+F4"
 * Order: Meta/Ctrl -> Alt -> Shift -> Key
 */
export const getShortcutFromEvent = (
  e: KeyboardEvent | React.KeyboardEvent
): string => {
  const parts: string[] = [];

  // Mac uses Meta (Command) as the primary modifier, Windows/Linux use Ctrl
  // We'll normalize to "Ctrl" for internal storage/display consistency if desired,
  // or allow specific "Meta" handling. For this app, let's Stick to standard names.
  if (e.metaKey) parts.push("Meta");
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");

  // Determine key
  let key = e.key.toUpperCase();

  // Handle special keys mappings if e.key is verbose
  if (key === "CONTROL" || key === "SHIFT" || key === "ALT" || key === "META") {
    // It's just a modifier press, don't append key
    return parts.join("+");
  }

  if (key === " ") key = "Space";
  if (key === "ESCAPE") key = "Esc";
  if (key === "ARROWUP") key = "Up";
  if (key === "ARROWDOWN") key = "Down";
  if (key === "ARROWLEFT") key = "Left";
  if (key === "ARROWRIGHT") key = "Right";

  parts.push(key);
  return parts.join("+");
};

/**
 * Converts a string shortcut (e.g. "Ctrl+S") into a Monaco KeyBinding.
 * Used for editor.addCommand()
 */
export const getMonacoKeyBinding = (shortcut: string): number => {
  if (!shortcut) return 0;

  const parts = shortcut.split("+");
  let binding = 0;

  parts.forEach((part) => {
    switch (part.toLowerCase()) {
      case "ctrl":
      case "meta": // Treat Meta like Ctrl for Monaco usually (KeyMod.CtrlCmd)
        binding |= KeyMod.CtrlCmd;
        break;
      case "shift":
        binding |= KeyMod.Shift;
        break;
      case "alt":
        binding |= KeyMod.Alt;
        break;
      default:
        // Parse key code
        const code = getMonacoKeyCode(part);
        binding |= code;
    }
  });

  return binding;
};

const getMonacoKeyCode = (key: string): number => {
  // Basic mapping
  const upper = key.toUpperCase();
  if (upper >= "A" && upper <= "Z") {
    return KeyCode[`Key${upper}` as keyof typeof KeyCode];
  }
  if (upper >= "0" && upper <= "9") {
    return KeyCode[`Digit${upper}` as keyof typeof KeyCode];
  }

  // Function keys
  if (upper.startsWith("F")) {
    const num = parseInt(upper.substring(1));
    if (!isNaN(num) && num >= 1 && num <= 19) {
      return KeyCode[`F${num}` as keyof typeof KeyCode];
    }
  }

  switch (upper) {
    case "ENTER":
      return KeyCode.Enter;
    case "ESC":
      return KeyCode.Escape;
    case "SPACE":
      return KeyCode.Space;
    case "TAB":
      return KeyCode.Tab;
    case "BACKSPACE":
      return KeyCode.Backspace;
    case "DELETE":
      return KeyCode.Delete;
    case "INSERT":
      return KeyCode.Insert;
    case "HOME":
      return KeyCode.Home;
    case "END":
      return KeyCode.End;
    case "PAGEUP":
      return KeyCode.PageUp;
    case "PAGEDOWN":
      return KeyCode.PageDown;
    case "UP":
      return KeyCode.UpArrow;
    case "DOWN":
      return KeyCode.DownArrow;
    case "LEFT":
      return KeyCode.LeftArrow;
    case "RIGHT":
      return KeyCode.RightArrow;
    case ",":
      return KeyCode.Comma;
    case ".":
      return KeyCode.Period;
    case "/":
      return KeyCode.Slash;
    case "\\":
      return KeyCode.Backslash;
    case "[":
      return KeyCode.BracketLeft;
    case "]":
      return KeyCode.BracketRight;
    case "-":
      return KeyCode.Minus;
    case "=":
      return KeyCode.Equal;
    case ";":
      return KeyCode.Semicolon;
    case "'":
      return KeyCode.Quote;
    case "`":
      return KeyCode.Backquote;
    default:
      return 0;
  }
};

/**
 * Checks if a KeyboardEvent matches a configured shortcut string.
 */
export const isShortcutMatch = (
  e: KeyboardEvent | React.KeyboardEvent,
  shortcut: string
): boolean => {
  if (!shortcut) return false;
  // Simple comparison of standardized strings
  // Note: getShortcutFromEvent handles normalizing the current event
  return getShortcutFromEvent(e) === shortcut;
};
