export type Language = {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
};

export const LANGUAGES: Language[] = [
  { code: "en",    name: "English",              nativeName: "English",          flag: "🇺🇸" },
  { code: "es",    name: "Spanish",              nativeName: "Español",          flag: "🇪🇸" },
  { code: "fr",    name: "French",               nativeName: "Français",         flag: "🇫🇷" },
  { code: "pt",    name: "Portuguese",           nativeName: "Português",        flag: "🇧🇷" },
  { code: "de",    name: "German",               nativeName: "Deutsch",          flag: "🇩🇪" },
  { code: "it",    name: "Italian",              nativeName: "Italiano",         flag: "🇮🇹" },
  { code: "zh",    name: "Chinese (Simplified)", nativeName: "中文 (简体)",        flag: "🇨🇳" },
  { code: "zh-TW", name: "Chinese (Traditional)",nativeName: "中文 (繁體)",        flag: "🇹🇼" },
  { code: "ja",    name: "Japanese",             nativeName: "日本語",            flag: "🇯🇵" },
  { code: "ko",    name: "Korean",               nativeName: "한국어",            flag: "🇰🇷" },
  { code: "ar",    name: "Arabic",               nativeName: "العربية",          flag: "🇸🇦" },
  { code: "hi",    name: "Hindi",                nativeName: "हिन्दी",             flag: "🇮🇳" },
  { code: "ru",    name: "Russian",              nativeName: "Русский",          flag: "🇷🇺" },
  { code: "nl",    name: "Dutch",                nativeName: "Nederlands",       flag: "🇳🇱" },
  { code: "pl",    name: "Polish",               nativeName: "Polski",           flag: "🇵🇱" },
  { code: "tr",    name: "Turkish",              nativeName: "Türkçe",           flag: "🇹🇷" },
  { code: "vi",    name: "Vietnamese",           nativeName: "Tiếng Việt",       flag: "🇻🇳" },
  { code: "th",    name: "Thai",                 nativeName: "ภาษาไทย",           flag: "🇹🇭" },
  { code: "id",    name: "Indonesian",           nativeName: "Bahasa Indonesia", flag: "🇮🇩" },
  { code: "ms",    name: "Malay",                nativeName: "Bahasa Melayu",    flag: "🇲🇾" },
  { code: "tl",    name: "Filipino",             nativeName: "Filipino",         flag: "🇵🇭" },
  { code: "sw",    name: "Swahili",              nativeName: "Kiswahili",        flag: "🇰🇪" },
  { code: "el",    name: "Greek",                nativeName: "Ελληνικά",         flag: "🇬🇷" },
  { code: "he",    name: "Hebrew",               nativeName: "עברית",            flag: "🇮🇱" },
  { code: "fa",    name: "Persian (Farsi)",      nativeName: "فارسی",            flag: "🇮🇷" },
  { code: "uk",    name: "Ukrainian",            nativeName: "Українська",       flag: "🇺🇦" },
  { code: "cs",    name: "Czech",                nativeName: "Čeština",          flag: "🇨🇿" },
  { code: "hu",    name: "Hungarian",            nativeName: "Magyar",           flag: "🇭🇺" },
  { code: "sv",    name: "Swedish",              nativeName: "Svenska",          flag: "🇸🇪" },
  { code: "ro",    name: "Romanian",             nativeName: "Română",           flag: "🇷🇴" },
];

export function getLanguageByCode(code: string): Language | undefined {
  return LANGUAGES.find((l) => l.code === code);
}

export function getLanguageByName(name: string): Language | undefined {
  return LANGUAGES.find((l) => l.name.toLowerCase() === name.toLowerCase());
}
