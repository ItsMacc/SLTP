import type { Monaco } from './pyright';

const lightRules = [
  { token: '', foreground: '292633' },
  { token: 'comment', foreground: '777184', fontStyle: 'italic' },
  { token: 'keyword', foreground: '4F46E5', fontStyle: 'bold' },
  { token: 'keyword.control', foreground: '4338CA', fontStyle: 'bold' },
  { token: 'string', foreground: '087443' },
  { token: 'string.escape', foreground: 'A04B00' },
  { token: 'number', foreground: 'A64B08' },
  { token: 'type', foreground: '087E8B' },
  { token: 'type.identifier', foreground: '087E8B' },
  { token: 'identifier', foreground: '292633' },
  { token: 'delimiter', foreground: '625D6D' },
  { token: 'operator', foreground: '4F46E5' },
  { token: 'function', foreground: '6D28D9' },
  { token: 'function.python', foreground: '6D28D9' },
  { token: 'variable', foreground: '292633' },
  { token: 'constant', foreground: 'A64B08' },
  { token: 'tag', foreground: '4F46E5' },
];

const darkRules = [
  { token: '', foreground: 'F4F0EB' },
  { token: 'comment', foreground: 'A69DAF', fontStyle: 'italic' },
  { token: 'keyword', foreground: 'FBBF24', fontStyle: 'bold' },
  { token: 'keyword.control', foreground: 'F59E0B', fontStyle: 'bold' },
  { token: 'string', foreground: '86EFAC' },
  { token: 'string.escape', foreground: 'FDBA74' },
  { token: 'number', foreground: 'FDBA74' },
  { token: 'type', foreground: '67E8F9' },
  { token: 'type.identifier', foreground: '67E8F9' },
  { token: 'identifier', foreground: 'F4F0EB' },
  { token: 'delimiter', foreground: 'D1C8D7' },
  { token: 'operator', foreground: 'FDBA74' },
  { token: 'function', foreground: 'C4B5FD' },
  { token: 'function.python', foreground: 'C4B5FD' },
  { token: 'variable', foreground: 'F4F0EB' },
  { token: 'constant', foreground: 'FCD34D' },
  { token: 'tag', foreground: 'FBBF24' },
];

const lightColors = {
  'editor.background': '#FFFFFF',
  'editor.foreground': '#292633',
  'editorLineNumber.foreground': '#777184',
  'editorLineNumber.activeForeground': '#292633',
  'editorCursor.foreground': '#4F46E5',
  'editor.selectionBackground': '#DCD9FF',
  'editor.inactiveSelectionBackground': '#ECEBFA',
  'editor.lineHighlightBackground': '#F5F3FF',
  'editorIndentGuide.background1': '#E5E1F2',
  'editorIndentGuide.activeBackground1': '#A9A3C3',
  'editorWhitespace.foreground': '#D7D2E0',
  'editorGutter.background': '#FFFFFF',
  'editorWidget.background': '#FFFFF5',
  'editorWidget.border': '#DED8CC',
  'editorSuggestWidget.background': '#FFFFF5',
  'editorSuggestWidget.foreground': '#292633',
  'editorSuggestWidget.selectedBackground': '#ECEBFA',
  'editorSuggestWidget.selectedForeground': '#292633',
  'editorSuggestWidget.highlightForeground': '#4338CA',
  'editorHoverWidget.background': '#FFFFF5',
  'editorHoverWidget.border': '#DED8CC',
  'editorError.foreground': '#B42318',
  'editorWarning.foreground': '#A16207',
  'editorInfo.foreground': '#4338CA',
};

const darkColors = {
  'editor.background': '#151311',
  'editor.foreground': '#F4F0EB',
  'editorLineNumber.foreground': '#8F877F',
  'editorLineNumber.activeForeground': '#F4F0EB',
  'editorCursor.foreground': '#F59E0B',
  'editor.selectionBackground': '#63420F',
  'editor.inactiveSelectionBackground': '#352A1B',
  'editor.lineHighlightBackground': '#211D18',
  'editorIndentGuide.background1': '#38312A',
  'editorIndentGuide.activeBackground1': '#74614A',
  'editorWhitespace.foreground': '#494138',
  'editorGutter.background': '#151311',
  'editorWidget.background': '#211E1C',
  'editorWidget.border': '#3D3632',
  'editorSuggestWidget.background': '#211E1C',
  'editorSuggestWidget.foreground': '#F4F0EB',
  'editorSuggestWidget.selectedBackground': '#3A3024',
  'editorSuggestWidget.selectedForeground': '#F4F0EB',
  'editorSuggestWidget.highlightForeground': '#FBBF24',
  'editorHoverWidget.background': '#211E1C',
  'editorHoverWidget.border': '#3D3632',
  'editorError.foreground': '#F48771',
  'editorWarning.foreground': '#FBBF24',
  'editorInfo.foreground': '#93C5FD',
};

export function applyLabEditorTheme(monaco: Monaco, theme: 'vs' | 'vs-dark') {
  const isDark = theme === 'vs-dark';
  const name = isDark ? 'sltp-dark' : 'sltp-light';
  monaco.editor.defineTheme(name, {
    base: theme,
    inherit: true,
    rules: isDark ? darkRules : lightRules,
    colors: isDark ? darkColors : lightColors,
  });
  monaco.editor.setTheme(name);
}
