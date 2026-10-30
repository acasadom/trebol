// Mezzanines: the part of lib written in Trebol itself. Evaluated into lib
// at startup by `makeRuntime`. Anything that can live here instead of in a
// TS native should, since it carries over unchanged to another core.

export const MEZZANINES = String.raw`
func: make function! [[
    "Makes a function from a spec and a body."
    spec [block!] body [block!]
][
    make function! reduce [spec body]
]]

does: func ["A function with no arguments." body [block!]] [
    make function! reduce [[] body]
]

has: func ["A function with only local words." locals [block!] body [block!]] [
    make function! reduce [append copy [/local] locals body]
]

; Each call already gets its own frame, so closures and functions are the same.
closure: :func

context: func ["Makes an object." spec [block!]] [make object! spec]

first: func [series] [pick series 1]
second: func [series] [pick series 2]
third: func [series] [pick series 3]
last: func [series [series!]] [pick series length? series]

empty?: func [series [series! map!]] [zero? length? series]
none?: func [value [any-type!]] [none! = type? :value]
block?: func [value [any-type!]] [block! = type? :value]
string?: func [value [any-type!]] [string! = type? :value]
integer?: func [value [any-type!]] [integer! = type? :value]
error?: func [value [any-type!]] [error! = type? :value]
object?: func [value [any-type!]] [object! = type? :value]
`;
