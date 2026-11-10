# Files and modules

Reading files and web addresses, running scripts and importing modules, giving the user files to save, and
keeping small values in the browser. See [modules](../language/13-modules.md).

## read

## do-file

## import

## download

The browser saves the file with its usual dialog, or into the Downloads folder: only the name of the file is
used, not its folder. The type comes from the extension (`.csv`, `.json`, `.txt`, `.png`, `.pdf`...). Text is
written as UTF-8; a `.csv` starts with a byte order mark, so spreadsheets read its accents right. On a host
with no browser it is an access error.

## save-local

## load-local

## remove-local
