# Review Checklist

## Correctness
- Does the patch actually address the described bug or change?
- Are there hidden assumptions about null, empty, timeout, retry, or ordering behavior?
- Are errors swallowed or rethrown inconsistently?

## Regressions
- Could unrelated flows break because of shared helpers or side effects?
- Were defaults changed?
- Were exported shapes, response formats, or CLI flags changed?

## Tests
- Is the happy path covered?
- Is the failure path covered?
- Are there edge cases for empty input, invalid state, retry, timeout, or permissions?

## Security / safety
- Does the patch expose secrets, tokens, or unsafe shell behavior?
- Does it widen permissions or trust boundaries?
- Does it add risky dependencies?
