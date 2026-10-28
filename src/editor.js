import { EditorState, StateEffect, StateField } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightActiveLine, drawSelection, Decoration } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { python } from '@codemirror/lang-python';
import { bracketMatching, indentOnInput, syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { tags } from '@lezer/highlight';
const activeEffect = StateEffect.define();
const highlight = StateField.define({
  create: () => Decoration.none,
  update(value, transaction) {
    value = value.map(transaction.changes);
    for (const effect of transaction.effects) if (effect.is(activeEffect)) {
      const number = effect.value;
      value = number > 0 && number <= transaction.state.doc.lines ? Decoration.set([Decoration.line({ class: 'execution-line' }).range(transaction.state.doc.line(number).from)]) : Decoration.none;
    }
    return value;
  }, provide: field => EditorView.decorations.from(field)
});
const colors = HighlightStyle.define([
  { tag: [tags.keyword, tags.controlKeyword], color: '#bfabff' },
  { tag: tags.string, color: '#c5df94' }, { tag: tags.number, color: '#f3bf7d' },
  { tag: tags.comment, color: '#66777d', fontStyle: 'italic' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: '#8ed7d6' },
  { tag: tags.operator, color: '#b4c0c7' }, { tag: tags.variableName, color: '#d8e0df' },
]);
export function createEditor(parent, doc, onChange, onRun) {
  const editor = new EditorView({ parent, state: EditorState.create({ doc, extensions: [
    lineNumbers(), highlightActiveLineGutter(), highlightActiveLine(), drawSelection(), history(), python(),
    bracketMatching(), indentOnInput(), closeBrackets(), syntaxHighlighting(colors), highlight,
    EditorState.tabSize.of(4), EditorView.contentAttributes.of({ 'aria-label': 'Python 代码编辑器', spellcheck: 'false' }),
    keymap.of([{ key: 'Mod-Enter', run: () => { onRun(); return true; } }, indentWithTab, ...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap]),
    EditorView.updateListener.of(update => { if (update.docChanged) onChange(update.state.doc.toString()); }),
    EditorView.theme({
      '&': { height: '100%', background: '#10171f', color: '#dce5e2', fontSize: 'var(--editor-size, 15px)' },
      '.cm-scroller': { fontFamily: '"Cascadia Code", Consolas, "Microsoft YaHei", monospace', lineHeight: '1.95', overflow: 'auto' },
      '.cm-content': { padding: '20px 0', caretColor: '#c7ef7b' },
      '.cm-line': { padding: '0 18px 0 10px' },
      '.cm-gutters': { background: '#10171f', color: '#52616b', border: 'none', minWidth: '45px' },
      '.cm-lineNumbers .cm-gutterElement': { padding: '0 12px 0 10px' },
      '.cm-activeLineGutter': { background: 'transparent', color: '#adbec3' },
      '.cm-activeLine': { background: '#ffffff03' },
      '&.cm-focused': { outline: 'none' }, '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { background: '#53654966' },
      '.cm-cursor': { borderLeftColor: '#c7ef7b' }, '.execution-line': { background: '#c7ef7b15', boxShadow: 'inset 3px 0 #c7ef7b' },
    }, { dark: true }),
  ] }) });
  return { view: editor, get: () => editor.state.doc.toString(), set(text) { editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: text }, effects: activeEffect.of(0) }); },
    highlight(line) { editor.dispatch({ effects: activeEffect.of(line) }); }, dispose() { editor.destroy(); } };
}
