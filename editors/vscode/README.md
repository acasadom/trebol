# Trebol for Visual Studio Code

Colors for [Trebol](https://github.com/acasadom/trebol) `.trb` files: comments, strings and escapes, every
literal datatype (numbers, money, dates, times, pairs, tuples, files, urls, emails, tags, binaries), set-words,
get-words, lit-words, refinements, datatypes, and the words of control flow. `;` comments a line out, and
brackets close and indent themselves.

To install it, copy this folder into VS Code's extensions folder and restart VS Code:

```sh
cp -R node_modules/trebol/editors/vscode ~/.vscode/extensions/trebol
```

The grammar is written by `tools/grammar.ts` (`npm run grammar`) from the rules of Trebol's lexer;
`test/grammar.test.ts` checks it colors every `.trb` file of the repository the way `load` reads it.
