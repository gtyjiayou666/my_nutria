// US keyboard layout.

export const keyboardLayout = {
  description: "Chinese",
  views: {
    standard: [
      "q w e r t y u i o p",
      "a s d f g h j k l",
      "ShiftToUpper z x c v b n m BackSpace",
      "ShowNumbers Slash ChangeLayout Space Period Return",
    ],
    upper: [
      "Q W E R T Y U I O P",
      "A S D F G H J K L",
      "ShiftToLower Z X C V B N M BackSpace",
      "ShowNumbers Slash ChangeLayout Space Period Return",
    ],
    numbers: [
      "1 2 3 4 5 6 7 8 9 0",
      "@ # $ _ & - + ( ) /",
      "ShowSymbols * \" ' : ; ! ? BackSpace",
      "ShowLetters Comma Space Period Return",
    ],
    symbols: [
      "~ ` | · √ π τ ÷ × ¶",
      "© ® £ € ¥ ^ ° * { }",
      "ShowNumbers \\ / < > = [ ] BackSpace",
      "ShowLetters Space Period Return",
    ],
  },
  keys: {
    ShiftToUpper: {
      behavior: {
        press: "switch-tempview upper",
        longpress: "switch-view upper",
      },
      display: { icon: "arrow-up", size: "large", style: "secondary" },
    },

    ShiftToLower: {
      behavior: {
        press: "switch-view standard",
      },
      display: { icon: "arrow-up", size: "large", style: "secondary" },
    },

    BackSpace: {
      display: {
        icon: "delete",
        key: "Backspace",
        size: "large",
        style: "secondary",
      },
      nobubble: true,
    },

    ShowNumbers: {
      behavior: {
        press: "switch-view numbers",
      },
      display: { text: "123", size: "large", style: "secondary" },
    },

    ShowLetters: {
      behavior: {
        press: "switch-view standard",
      },
      display: { text: "ABC", size: "large", style: "secondary" },
    },

    ShowSymbols: {
      behavior: {
        press: "switch-view symbols",
      },
      display: { text: "=<", size: "large", style: "secondary" },
    },

    Slash: {
      display: { text: "/", key: "/", style: "secondary" },
    },

    Comma: {
      display: { text: ",", key: ",", style: "secondary" },
    },

    Period: {
      display: { text: ".", key: ".", style: "secondary" },
    },

    Return: {
      display: {
        icon: "corner-down-left",
        key: "Enter",
        size: "large",
        style: "primary",
      },
      nobubble: true,
    },

    ChangeLayout: {
      behavior: {
        press: "next-layout",
      },
      display: {
        icon: "globe",
        style: "secondary",
      },
    },

    Space: {
      display: {
        key: " ",
        text: " ",
        size: "wide",
      },
      nobubble: true,
    },
  },
};
