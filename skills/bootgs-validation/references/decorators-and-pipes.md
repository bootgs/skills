# Validation decorators and Parse pipes — full reference

See `SKILL.md` for how these compose with `@Query`/`@Param`/`@Body` and the exception-handling gotcha. This file is the lookup table.

## Validation decorators

| Decorator | Checks |
|---|---|
| `@Min(n)` | value >= n |
| `@Max(n)` | value <= n |
| `@Email()` | value matches an email format |
| `@Pattern(regex)` | value matches `string \| RegExp` |
| `@Size({ min, max })` | string length or array length within bounds |
| `@NotBlank()` | string is not empty/whitespace-only |
| `@NotEmpty()` | string/array/object is not empty |
| `@AssertTrue()` | value is exactly `true` |
| `@AssertFalse()` | value is exactly `false` |
| `@Positive()` | value > 0 |
| `@PositiveOrZero()` | value >= 0 |
| `@Negative()` | value < 0 |
| `@NegativeOrZero()` | value <= 0 |

## Parse pipes (extraction-time coercion)

Applied as the **second argument** to `@Param`/`@Query`:

```ts
@Get("{id}")
findOne(@Param("id", ParseNumberPipe) id: number) { /* id is a number, not "42" */ }
```

| Pipe | Coerces to |
|---|---|
| `ParseIntPipe` | `number` (integer, base 10) |
| `ParseFloatPipe` | `number` (floating point) |
| `ParseBigIntPipe` | `bigint` |
| `ParseBooleanPipe` | `boolean` (`"true"`/`"false"`) |
| `ParseNumberPipe` | `number` (either int or float) |
| `ParseStringPipe` | `string` (identity — useful mainly to document intent or combine with `@UsePipes`) |
