# apps-script-utils — API reference

Full catalog by category. All guard-style functions follow the `isX`/`nonX`/`requireX` convention described in `SKILL.md`; only representative signatures are shown here for brevity where a category has many near-identical entries.

## appsscript/sheet

- `parseA1Notation(a1Notation: string): GridRange` — parses `"A1:B2"`, `"Sheet1!A1:B2"`, `"'My Sheet'!5:15"` (row-only), and similar forms into a structured `GridRange`.
- `toA1Notation(range: GridRange): string` — inverse of the above.
- `getColumnLetterByIndex(index: number): string` / `getColumnLetterByPosition(position: number): string`
- `appendRow(sheet, row: unknown[]): void` / `appendRows(sheet, rows: unknown[][]): void`
- `prependRow(sheet, row: unknown[]): void` / `prependRows(sheet, rows: unknown[][]): void`
- `getSheetById(spreadsheet, sheetId: number): GoogleAppsScript.Spreadsheet.Sheet | null`
- `getSheetByIndex(spreadsheet, index: number): GoogleAppsScript.Spreadsheet.Sheet | null`
- `isGridRangeContainedIn(inner: GridRange, outer: GridRange): boolean`
- `sortSheets(spreadsheet, comparator?): void`
- `isSheet(value): value is GoogleAppsScript.Spreadsheet.Sheet` / `isRange(value)` / `isSpreadsheet(value)` + matching `requireSheet`/`requireRange`/`requireSpreadsheet`

## appsscript/{slide,admin,ui,net,drive,doc,form}

- `admin`: `isAdmin(email: string): boolean`
- `ui`: `isUi(value): boolean`, `checkMultipleAccount(): boolean`
- `net`: `requireValidToken(token: string | null | undefined): string`
- `drive`, `doc`, `form`: reserved, currently empty
- generic: `requireRepository(value)`, `requireService(value)` — throw `RepositoryIsNotDefinedException`/`ServiceIsNotDefinedException`

## lang/base

18 guards: `isArray`, `isBoolean`, `isEmpty`, `isException`, `isFunction`, `isFunctionLike`, `isLength`, `isNil`, `isNull`, `isNumber`, `isNumberLike`, `isObject`, `isObjectLike`, `isRegExp`, `isScalar`, `isString`, `isSymbol`, `isUndefined`. Only 11 have a mirrored `nonX` — `isArray`, `isBoolean`, `isEmpty`, `isFunction`, `isNil`, `isNull`, `isNumber`, `isScalar`, `isString`, `isSymbol`, `isUndefined`; `isException`, `isFunctionLike`, `isLength`, `isNumberLike`, `isObject`, `isObjectLike`, and `isRegExp` don't. There is no `isDate`. Plus `requireNonNull(value, message?)` and `requireString(value, message?)` as the two most commonly used assertions.

## lang/string

- `toCamelCase(value: string): string` / `toKebabCase(value: string): string` / `toSnakeCase(value: string): string`
- `isEmail(email: unknown): email is string` — RFC-compatible check (includes plus-alias addresses), not a naive regex
- `isValidSlug(value: string): boolean`
- `isValidVersion(value: string): boolean` / `versionCompare(a: string, b: string): -1 | 0 | 1`
- `escapeRegExp(value: string): string`
- `requireNonEmptyString(value: string | null | undefined, message?: string): string` — throws `EmptyStringException`

## lang/number

- `isInteger(value: unknown): value is number`
- `toInteger(value: unknown, fallback?: number): number`
- `nonNegative(value: number): boolean`

## lang/array

- `chunk<T>(array: T[], size: number): T[][]`
- `is2DArray(value: unknown): value is unknown[][]`
- `transpose<T>(matrix: T[][]): T[][]`

## exception/

Base: `Exception extends Error`. Specialized subclasses (all constructible as `new XException(message?)`):
`NullPointerException`, `IllegalArgumentException`, `EmptyStringException`, `InvalidStringException`, `InvalidEmailFormatException`, `RuntimeException`, `RepositoryIsNotDefinedException`, `ServiceIsNotDefinedException`.

## net/path

- `join(...segments: string[]): string`
- `normalize(pathValue: string): string`
- `parse(pathValue: string): { dir: string; base: string; ext: string; name: string }`
- `isAbsolute(pathValue: string): boolean` / `isRelative(pathValue: string): boolean`
- `isValidDomain(value: string): boolean`

## net/url

- `isUrl(value: unknown): value is string`

## html/

- `encodeHtml(value: string): string` / `decodeHtml(value: string): string`
- `escapeHtml(value: string): string` / `escapeXml(value: string): string`

## json/

- `parseJson<T>(value: string, fallback?: T): T` — safe wrapper over `JSON.parse`, returns `fallback` instead of throwing on invalid input (when provided)
- `stringifyJson(value: unknown): string` — safe wrapper over `JSON.stringify`

## time/

- `now(): number` — current timestamp (thin wrapper, exists mainly for test-time mocking)
