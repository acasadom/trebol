// The host: registers console, time, task and network natives, builds a
// runtime and a scheduler, and runs programs as tasks.

import './natives.ts';
import './net.ts';
import './net/streams.ts';
import './net/events.ts';
import './page.ts';
import './compress.ts';
import './share.ts';
import './locale.ts';
import './dates.ts';
import { setLoader, defaultLoader, type Loader } from './modules.ts';
import {
  makeRuntime, load, bindSeries, runSync, scriptStart, errorMessage, form,
  LIBRARY_FILES, type Cell, type ObjectCell, type Runtime,
} from '../core/index.ts';
import { makeScheduler, spawn, taskResult, type Scheduler } from './scheduler.ts';

export { output } from './natives.ts';
export { fileHandle } from './net.ts';
export { setShareEnv, type ShareEnv, type ChannelLike, type LocksLike, type Envelope } from './share.ts';
export { page } from './page.ts';
export { mapAt, formatLocal, activeLanguage, shown, translate, uiText, editLocal, readLocal, readDate, readRange, readTime, weekStart, fileSize, LOCAL_KINDS, amountOf, countStep } from './locale.ts';
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
    /local answer
][
    if all [with block? options] [options: make object! options]
    answer: http-request url either with [options] [none]
    ; what was kept of the same path is old now
    if all [with  find [post put patch delete] attempt [to word! select options 'method]] [ui-cache-touched url]
    answer
]

open-events: func [
    "Opens a stream of server-sent events; gives a handle. It opens again by itself when it fails or the server ends it."
    url [url! string!]
    /with "headers, query, cookies, reconnect, last-id"
        options [block! object!]
][
    if all [with block? options] [options: make object! options]
    events-request url either with [options] [none]
]

; --- answers kept: cached and refresh ---------------------------------------------
;
; Each url read with cached has an entry; a reaction that reads cached %/x has
; the entry among its sources, so it runs again when an answer comes.
; ui-cache-news counts every answer, for reactions whose url is not written out.
;
; Each ask has an asker: the reaction whose own code asks (refresh, a post to
; the path) in the task that runs it, or none (a read of an old answer, the
; page back into view, a handler, a timer, another task). A fetch answers the
; asks there were when it started. An answer that only the reaction asked for
; does not run it again, or it would ask again for ever; any other one does.
; So what is heard is kept apart: any-at, the count of ui-cache-news of the
; last answer not asked by one reaction alone; solo, [reaction count ...] the
; last answer asked by one reaction alone, and the last asked by another one
; alone: no more is needed to know what a reaction heard (react-heard), and
; reactions of screens left are not kept for ever.

ui-cache-news: make object! [version: 0  any-at: 0  solo: copy []]

ui-cache-entries: copy []

ui-cache-entry: func ["The entry of what cached keeps for a url, made the first time." url /local key e] [
    key: form url
    unless e: select/case ui-cache-entries key [
        e: make object! [url: none  answer: none  version: 0  stale: true  asking: false  pending: copy []  task: none  any-at: 0  solo: copy []]
        e/url: url
        append ui-cache-entries reduce [key e]
    ]
    e
]

; The path of a url, without the server, the query or the fragment.
ui-cache-path: func ["The path of a url, without the server, the query or the fragment." url /local s i] [
    s: form url
    if i: find s "#" [s: copy/part s i]
    if i: find s "?" [s: copy/part s i]
    if i: find s "://" [s: any [find skip i 3 "/" copy "/"]]
    s
]

; The reactions running, as [task reaction ...]: what one asks in its own task is its own.
ui-cache-askers: copy []

; Who asks: the reaction that runs last in this task, or none.
ui-cache-asker: func ["The reaction that runs in this task, which asks, or none." /local t who task r] [
    if empty? ui-cache-askers [return none]
    t: host-task
    who: none
    foreach [task r] ui-cache-askers [if task = t [who: r]]
    who
]

; Asks again behind, as asked by the code running: by the reaction of this task, if one runs.
ui-cache-again: func ["Asks again behind for the answer of an entry of cached, as asked by the reaction that runs." e] [
    ui-cache-ask/by e ui-cache-asker
]

; Asks again behind; one request at a time per url, and one more for what is asked meanwhile.
ui-cache-ask: func ["Asks again behind for the answer of an entry of cached." e /by who "The reaction that asks"] [
    e/stale: false
    append e/pending either by [:who] [none]
    unless e/asking [
        e/asking: true
        e/task: spawn compose [ui-cache-answer (e)]
    ]
]

; What is heard of an answer, on an entry or on ui-cache-news: count n, asked by
; askers. Of the answers asked alone it keeps the
; last, and the last of another reaction: counts only grow, so for any reaction
; these give the last answer it did not ask for alone.
ui-cache-heard: func ["Keeps who asked for an answer heard." at [object!] askers [block!] n [integer!] /local s] [
    either all [object? first askers  1 = length? s: ui-unique-same askers] [
        either all [not empty? at/solo  same? first s first at/solo] [
            poke at/solo 2 n
        ] [
            insert at/solo reduce [first s n]
            clear skip at/solo 4
        ]
    ] [
        at/any-at: n
    ]
]

; The asks, as a block, with each reaction once (they compare by content).
ui-unique-same: func ["The values of a block, each once, told apart by same?." b [block!] /local out x] [
    out: copy []
    foreach x b [unless find/same out :x [append out :x]]
    out
]

ui-cache-answer: func ["Asks for the answer of an entry of cached, and keeps it." e /local r askers] [
    while [not empty? e/pending] [
        ; what is asked from now on is answered by the next fetch
        askers: e/pending
        e/pending: copy []
        r: try [fetch e/url]
        either error? :r [
            ; the last answer stays; the next read asks again
            e/stale: true
            print ["cached:" form e/url "--" r/message]
        ] [
            e/answer: :r
            e/version: e/version + 1
            ui-cache-heard e askers ui-cache-news/version + 1
            ui-cache-heard ui-cache-news askers ui-cache-news/version + 1
            ; last, as its change runs the reactions in a browser
            ui-cache-news/version: ui-cache-news/version + 1
        ]
    ]
    e/asking: false
]

; Every url kept is asked again: the page came back into view.
ui-caches-again: func ["Asks again for every answer cached keeps." /local key e] [
    foreach [key e] ui-cache-entries [ui-cache-ask e]
]

; Every url kept is old: it is asked again the next time it is read (a screen is entered).
ui-caches-old: func ["Marks every answer cached keeps as old: the next read asks again." /local key e] [
    foreach [key e] ui-cache-entries [e/stale: true]
]

; A post, put, patch or delete to url: what was kept of its path, or of a path
; above or under it (/api/clients for /api/clients/7), is asked again.
ui-cache-touched: func ["Asks again for what cached keeps of the path of url, or above or under it." url /local key e a b] [
    a: ui-cache-path url
    foreach [key e] ui-cache-entries [
        b: ui-cache-path e/url
        if any [a = b  find/match a join b "/"  find/match b join a "/"] [ui-cache-again e]
    ]
]

cached: func [
    "The last answer to a GET of url, at once (none the first time), and asks again behind: a reaction (is, react) that reads it runs again when the answer comes."
    url [url! string!]
    /local e
][
    e: ui-cache-entry url
    if e/stale [ui-cache-ask e]
    e/answer
]

refresh: func [
    "Asks again for an answer kept by cached, now; reactions that read it run again when it comes."
    url [url! string!]
][
    ui-cache-again ui-cache-entry url
    exit
]

show-progress: func [
    "Shows how far a request went on a face: a progress bar's value, or the bar of an upload or a photo."
    face [object!]
    done [integer! none!] "Bytes done; none once the request is over"
    total [integer! none!] "Bytes in all, when known"
    /local part
][
    part: either all [done total total > 0] [done / to decimal! total] [none]
    either find [upload photo] select face 'style [face/sent: part] [if done [face/value: part]]
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
  // in lib, as the core's mezzanines: a word a program sets never takes the place of one of them
  const code = load(HOST_MEZZANINES, { file: 'host' });
  bindSeries(code.s, rt.lib, true);
  const r = runSync(rt, code);
  // Host mezzanines failing to load is a bug in Trebol itself.
  if (r.k === 'error') throw new Error(`host mezzanines failed: ${errorMessage(r.e)}`);
  const sch = makeScheduler(rt, e => onError(e));
  return { rt, sch };
}

/** URL of the UI dialect source, next to this file. */
export const UI_SOURCE = new URL('../ui/ui.trb', import.meta.url).href;
/** URL of the languages module (i18n, tr, translated). */
export const I18N_SOURCE = new URL('../ui/i18n.trb', import.meta.url).href;
/** URL of the words of screen tests (click, type, see...), which `trebol test` loads. */
export const TEST_SOURCE = new URL('../ui/test.trb', import.meta.url).href;
// Trebol's own code: its errors point at the program's call (see LIBRARY_FILES).
LIBRARY_FILES.add('host').add(UI_SOURCE).add(I18N_SOURCE).add(TEST_SOURCE);

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
