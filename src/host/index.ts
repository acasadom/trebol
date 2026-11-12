// The host: registers console, time, task and network natives, builds a
// runtime and a scheduler, and runs programs as tasks.

import './natives.ts';
import './net.ts';
import './page.ts';
import './locale.ts';
import { setLoader, defaultLoader, type Loader } from './modules.ts';
import {
  K, makeRuntime, load, bindSeries, doSource, scriptStart, errorMessage, form, mold,
  LIBRARY_FILES, type Cell, type ObjectCell, type Runtime,
} from '../core/index.ts';
import { makeScheduler, spawn, taskResult, type Scheduler } from './scheduler.ts';

export { output } from './natives.ts';
export { fileHandle } from './net.ts';
export { page } from './page.ts';
export { mapAt, formatLocal, activeLanguage, shown, translate, uiText, editLocal, readLocal, readDate, weekStart, fileSize, LOCAL_KINDS } from './locale.ts';
export type { Loader } from './modules.ts';
export * from './scheduler.ts';

/** Host mezzanines: the Trebol side of the host natives. */
const HOST_MEZZANINES = String.raw`
print: func ["Prints a value; a block is reduced first." value [any-type!]] [
    write-line either block? :value [reduce value] [:value]
]

fetch: func [
    "Requests a URL. JSON answers come back as maps and blocks."
    url [url! string!]
    /with "method, headers, body, form, multipart, timeout, full"
        options [block! object!]
][
    http-request url either with [either block? options [make object! options] [options]] [none]
]

save: func [
    "Gives the user a file with a value written so load reads it back; .json, .csv and .xml are written as such."
    where [file! none!] "The name of the file, or none for the bytes"
    value [any-type!]
    /all "Kept for R3 code: values are always written so load gives them back"
    /local data
][
    ; /all names the refinement here, not the native
    data: switch/default either file? where [suffix? where] [none] [
        %.json [to-json :value]
        %.csv [to-csv :value]
        %.xml [to-xml :value]
    ] [
        append either block? :value [mold/all/only value] [mold/all :value] newline
    ]
    either where [download where data] [to binary! data]
]

help: func [
    "Shows how to call a function, or what a word holds."
    'word [any-type!] "The word to explain"
    /local value name about entry args refs ret target usage describe kind
][
    unless word? :word [
        print "Type help and a word: help print, help round"
        exit
    ]
    name: uppercase form word
    unless value? word [
        print [name "has no value."]
        exit
    ]
    value: get word
    ; "a block!", "an object!"
    kind: mold type? :value
    kind: rejoin [either find "aeiou" first kind ["an "] ["a "] kind]
    unless any-function? :value [
        about: mold :value
        if 60 < length? about [about: append copy/part about 57 "..."]
        print rejoin [name " is " kind " of value: " about]
        exit
    ]
    ; read the spec: a description, then arguments, refinements and their
    ; arguments, each with its types and its own description
    about: none  args: copy []  refs: copy []  ret: none  target: args  entry: none
    foreach item spec-of :value [
        case [
            item = /local [break]
            string? item [either entry [entry/doc: item] [about: item]]
            block? item [if entry [entry/types: item]]
            refinement? item [
                append refs entry: make object! [name: item doc: none types: none args: copy []]
                target: entry/args
            ]
            set-word? item [entry: ret: make object! [name: item doc: none types: none]]
            any [word? item lit-word? item get-word? item] [
                append target entry: make object! [name: item doc: none types: none]
            ]
        ]
    ]
    describe: func [e] [
        rejoin [
            mold e/name
            either e/doc [rejoin [" -- " e/doc]] [""]
            either e/types [rejoin [" (" form e/types ")"]] [""]
        ]
    ]
    usage: copy name
    foreach a args [append append usage " " mold a/name]
    ; an operator goes between its arguments
    if op? :value [usage: rejoin [mold args/1/name " " name " " mold args/2/name]]
    print "USAGE:"
    print rejoin ["    " usage]
    print ""
    print "DESCRIPTION:"
    if about [print rejoin ["    " about]]
    print rejoin ["    " name " is " kind " value."]
    unless empty? args [
        print ""
        print "ARGUMENTS:"
        foreach a args [print rejoin ["    " describe a]]
    ]
    unless empty? refs [
        print ""
        print "REFINEMENTS:"
        foreach r refs [
            print rejoin ["    " describe r]
            foreach a r/args [print rejoin ["        " describe a]]
        ]
    ]
    if all [ret ret/types] [
        print ""
        print "RETURNS:"
        print rejoin ["    " form ret/types]
    ]
    exit
]

?: :help

??: func ["Prints a word and its value." 'word [any-word!]] [
    print rejoin [form word ": " mold get word]
]

source: func ["Prints the source of a function." 'word [any-word!] /local value] [
    value: get word
    print rejoin [
        form word ": " case [
            function? :value [rejoin ["func " mold spec-of :value " " mold body-of :value]]
            any-function? :value [rejoin ["native " mold spec-of :value]]
            true [mold :value]
        ]
    ]
]
`;

export interface Host {
  readonly rt: Runtime;
  readonly sch: Scheduler;
}

/** Rebol-style multi-line report of an error. */
export function report(e: ObjectCell): string {
  return form(e);
}

export interface HostOptions {
  /** Reports errors of tasks nobody waits for. */
  onError?: (e: ObjectCell) => void;
  /** How `import` finds files; defaults to fetch relative to the page. */
  loader?: Loader;
}

export function startHost(opts: HostOptions = {}): Host {
  const onError = opts.onError ?? (e => console.error(report(e)));
  const rt = makeRuntime();
  setLoader(rt, opts.loader ?? defaultLoader());
  const r = doSource(rt, HOST_MEZZANINES, 'host');
  // Host mezzanines failing to load is a bug in Trebol itself.
  if (r.k === 'error') throw new Error(`host mezzanines failed: ${errorMessage(r.e)}`);
  const sch = makeScheduler(rt, e => onError(e));
  return { rt, sch };
}

/** URL of the UI dialect source, next to this file. */
export const UI_SOURCE = new URL('../ui/ui.trb', import.meta.url).href;
/** URL of the languages module (i18n, tr, translated). */
export const I18N_SOURCE = new URL('../ui/i18n.trb', import.meta.url).href;
// Trebol's own code: its errors point at the program's call (see LIBRARY_FILES).
LIBRARY_FILES.add('host').add(UI_SOURCE).add(I18N_SOURCE);

/** Loads languages and the UI dialect (view, layout, stylize, theme...) into the user context. */
export function startUi(host: Host): Promise<Cell> {
  return runSource(host, `import ${I18N_SOURCE}  import ${UI_SOURCE}`);
}

/**
 * Loads source into the user context and runs it as a task. Resolves with
 * its value; rejects with the error! if it fails. Load errors throw LoadError.
 */
export function runSource(host: Host, src: string, file?: string): Promise<Cell> {
  const code = load(src, file !== undefined ? { file } : {});
  bindSeries(code.s, host.rt.user, true);
  return taskResult(spawn(host.sch, code.s, scriptStart(code).start));
}
