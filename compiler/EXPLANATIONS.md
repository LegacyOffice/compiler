# Compiler Frontend - Complete Explanations Guide

## Table of Contents
1. [Project Overview](#project-overview)
2. [Phase 1: Lexical Analysis (Lexer)](#phase-1-lexical-analysis-lexer)
3. [Phase 2: Syntax Analysis (Parser)](#phase-2-syntax-analysis-parser)
4. [Phase 3: Semantic Analysis](#phase-3-semantic-analysis)
5. [Phase 4: Intermediate Representation (IR)](#phase-4-intermediate-representation-ir)
6. [Code Optimization](#code-optimization)
7. [How to Use](#how-to-use)
8. [Test Examples](#test-examples)

---

## Project Overview

This is a **web-based compiler frontend** that demonstrates how programming languages are compiled. It takes source code as input and processes it through four major compilation phases:

```
SOURCE CODE
    ↓
[LEXER] → Tokens
    ↓
[PARSER] → Abstract Syntax Tree (AST)
    ↓
[SEMANTIC ANALYZER] → Symbol Table + Type Checking
    ↓
[IR GENERATOR] → Three-Address Code
    ↓
[OPTIMIZER] → Code Optimizations
```

**No external dependencies** - Everything runs in your browser!

---

## Phase 1: Lexical Analysis (Lexer)

### What is the Lexer?
The lexer is the first phase of compilation. It reads the source code character-by-character and groups them into **tokens** (meaningful units).

### Example:
```
INPUT:  int x = 5;
OUTPUT: [KEYWORD: int] [IDENTIFIER: x] [OPERATOR: =] [NUMBER: 5] [PUNCTUATION: ;]
```

### How It Works

**Step 1: Character Reading**
- Reads the source code one character at a time
- Tracks line number and column position for error reporting

**Step 2: Token Recognition**
The lexer identifies different token types:

| Token Type | Examples | Purpose |
|-----------|----------|---------|
| **KEYWORD** | `int`, `if`, `while`, `print` | Reserved words |
| **IDENTIFIER** | `x`, `myVar`, `count` | Variable/function names |
| **INT_LITERAL** | `10`, `42`, `0xFF` | Integer numbers |
| **FLOAT_LITERAL** | `3.14`, `2.5` | Decimal numbers |
| **STRING_LITERAL** | `"hello"` | Text strings |
| **OPERATOR** | `+`, `-`, `*`, `/`, `==`, `!=` | Operations |
| **PUNCTUATION** | `(`, `)`, `{`, `}`, `;`, `,` | Delimiters |

**Step 3: Special Cases**

The lexer handles:
- **Comments**: `//` (single line) and `/* */` (block)
- **String escapes**: `\n`, `\t`, `\\`, `\"`
- **Multi-character operators**: `==`, `!=`, `<=`, `>=`, `&&`, `||`
- **Hex numbers**: `0xFF`, `0x1A`
- **Scientific notation**: `1.5e-10`

### Example Lexer Output:

**Input Code:**
```
int x = 10;
print(x);
```

**Lexer Output:**
```
Token 1: Type=KEYWORD, Value=int, Line=1, Col=1
Token 2: Type=IDENTIFIER, Value=x, Line=1, Col=5
Token 3: Type=OPERATOR, Value==, Line=1, Col=7
Token 4: Type=INT_LITERAL, Value=10, Line=1, Col=9
Token 5: Type=PUNCTUATION, Value=;, Line=1, Col=11
Token 6: Type=KEYWORD, Value=print, Line=2, Col=1
Token 7: Type=PUNCTUATION, Value=(, Line=2, Col=6
Token 8: Type=IDENTIFIER, Value=x, Line=2, Col=7
Token 9: Type=PUNCTUATION, Value=), Line=2, Col=8
Token 10: Type=PUNCTUATION, Value=;, Line=2, Col=9
```

### Error Detection

The lexer catches errors like:
- Unknown characters: `@`, `#`, `$`
- Unterminated strings: `"hello` (missing closing quote)
- Invalid number formats: `10.20.30` (multiple decimal points)

---

## Phase 2: Syntax Analysis (Parser)

### What is the Parser?
The parser takes the token stream from the lexer and builds an **Abstract Syntax Tree (AST)** - a tree representation of the program structure.

The parser checks if the tokens follow valid **grammar rules**.

### Two Parser Implementations

#### **A) Top-Down Parser (Recursive Descent)**

**How it works:**
- Starts from the root of grammar
- Recursively expands rules
- Reads tokens left-to-right

**Grammar Example:**
```
Program → Statement*
Statement → Declaration | Assignment | IfStatement
Declaration → Type Identifier '=' Expression ';'
Expression → Term ('+' Term)*
Term → Factor ('*' Factor)*
Factor → Number | Identifier | '(' Expression ')'
```

**Example Parsing `int x = 5;`:**
```
Parse Program
  → Parse Statement
    → Parse Declaration (matches KEYWORD 'int')
      → Type = 'int'
      → Identifier = 'x'
      → Expression
        → Term
          → Factor (Number 5)
      → Consume ';'
```

**Result: AST Tree**
```
Program
└── Declaration
    ├── Type: int
    ├── Identifier: x
    └── Literal: 5
```

#### **B) Bottom-Up Parser (Shift-Reduce)**

**How it works:**
- Starts with tokens
- Shifts tokens onto a stack
- Reduces stack items according to grammar rules
- Works from leaves to root

**Example Parsing `5 + 3`:**
```
1. SHIFT 5           → Stack: [5]
2. SHIFT +           → Stack: [5, +]
3. SHIFT 3           → Stack: [5, +, 3]
4. REDUCE (5 + 3)    → Stack: [BinaryOp(+, 5, 3)]
```

**Key Differences:**
| Top-Down | Bottom-Up |
|----------|-----------|
| Recursive | Iterative with stack |
| Predictive | Operator-precedence |
| Easier to understand | Handles complex grammars |

### Operator Precedence

The parser respects mathematical operator precedence:

```
Precedence (high to low):
1. * and /  (multiplication, division)
2. + and -  (addition, subtraction)
3. == and != (comparison)
4. && and || (logical)
```

**Example: `2 + 3 * 4`**
```
Without precedence: (2 + 3) * 4 = 20  ✗ WRONG
With precedence:    2 + (3 * 4) = 14  ✓ CORRECT
```

### AST Structure

An AST is a tree where:
- **Nodes** = language constructs (Declaration, IfStatement, BinaryOp, etc.)
- **Edges** = relationships between constructs
- **Leaves** = literals and identifiers

**Example AST for `if (x > 5) { print(x); }`:**
```
IfStatement
├── Condition
│   └── BinaryOp (>)
│       ├── Identifier: x
│       └── Literal: 5
└── Body
    └── PrintStatement
        └── Identifier: x
```

### Error Detection

The parser catches syntax errors like:
- Missing semicolons: `int x = 10` (no `;`)
- Unmatched brackets: `if (x > 5 { ... }`
- Unexpected tokens: `int x = = 5;`
- Invalid expressions: `+ 5` (operator without operand)

---

## Phase 3: Semantic Analysis

### What is Semantic Analysis?
The parser builds a syntactically correct tree, but semantic analysis checks if it makes **logical sense**.

Examples of semantic errors:
- Using a variable before declaring it
- Declaring the same variable twice
- Type mismatches in operations

### Symbol Table

A **symbol table** is a data structure that tracks all identifiers (variables, functions) in the program.

**For each variable, we store:**
- **Name**: Variable name (e.g., `x`)
- **Type**: Data type (e.g., `int`, `float`, `string`)
- **Initialized**: Has it been assigned a value?
- **Used**: Has it been read from?
- **Scope**: Where is it valid? (global, local, etc.)

### Example Symbol Table

**Code:**
```
int x = 10;
int y;
print(x);
print(z);  // ERROR: z not declared!
```

**Symbol Table:**
```
Name | Type  | Initialized | Used | Error
-----|-------|-------------|------|-------
x    | int   | YES         | YES  | ✓ OK
y    | int   | NO          | NO   | Warning: unused
z    | ---   | ---         | YES  | ERROR: undeclared
```

### Type Checking

Semantic analyzer verifies type compatibility:

```
int x = 5;          ✓ OK (int = int)
int y = x + 3;      ✓ OK (int = int + int)
int z = "hello";    ✗ ERROR (int ≠ string)
string s = "hi";    ✓ OK
int a = s;          ✗ ERROR (int ≠ string)
```

### Scope Management

Variables have different scopes:
```
int global = 10;    // Global scope

if (x > 5) {
    int local = 20;  // Local scope (only inside if)
    print(local);    // ✓ OK
}
print(local);        // ✗ ERROR: out of scope
```

### Errors vs Warnings

**Semantic Errors** (block compilation):
- Variable used before declaration
- Duplicate variable declarations
- Type mismatches

**Semantic Warnings** (allow compilation):
- Variable declared but never used
- Variable used before initialization
- Unreachable code

---

## Phase 4: Intermediate Representation (IR)

### What is IR?

IR is a **low-level code** between high-level source code and machine code. It's easier to optimize and analyze than the source.

We use **Three-Address Code (3AC)** format.

### Three-Address Code Format

Each instruction has **at most 3 operands**:
```
result = operand1 operator operand2
```

### Example IR Generation

**Source Code:**
```
int x = 5;
int y = 10;
int sum = x + y;
print(sum);
```

**Intermediate Representation (3AC):**
```
    x = 5
    y = 10
    t1 = x + y
    sum = t1
    print sum
```

**Quadruples Table:**
```
#  | Op   | Arg1 | Arg2 | Result
---|------|------|------|--------
1  | =    | 5    |      | x
2  | =    | 10   |      | y
3  | +    | x    | y    | t1
4  | =    | t1   |      | sum
5  | print| sum  |      |
```

### Complex Example: If Statement

**Source:**
```
if (x > 5) {
    print(x);
}
```

**3AC IR:**
```
    t1 = x > 5
    if_false t1 goto L1
    print x
L1:
```

**Explanation:**
- `t1 = x > 5` - Compare x with 5, store result in temporary
- `if_false t1 goto L1` - If result is false, jump to label L1
- `print x` - Print x (only executed if x > 5)
- `L1:` - Label (jump destination)

### Why IR?

1. **Easier to optimize** - Remove redundant operations
2. **Machine-independent** - Can target different processors
3. **Easier to analyze** - Study program behavior
4. **Code generation** - Easier to convert to machine code

---

## Code Optimization

### What is Code Optimization?

Optimization improves code performance without changing its behavior:
- **Faster execution**
- **Less memory usage**
- **Smaller code size**

### 1. Constant Folding

**Idea:** Pre-compute operations on constants.

**Example:**
```
int x = 5 + 10;     // Before
int x = 15;         // After (optimized)
```

**Optimization Suggestion:**
```
Constant Folding: Expression '5 + 10' can be replaced with '15'
```

**Another Example:**
```
int area = 3 * 4 * 5;
→ Optimization: 12 * 5
→ Further: 60
```

### 2. Dead Code Elimination

**Idea:** Remove code that never executes.

**Example:**
```
int x = 10;
if (x > 0) {
    return x;
    print(x);    // ← DEAD CODE! Never executes
}
```

**Optimization Suggestion:**
```
Dead Code: Unreachable code detected after return statement
```

### 3. Infinite Loop Detection

**Idea:** Warn about loops that never exit.

**Example:**
```
while (true) {
    print("hello");   // ← Infinite loop!
}
```

**Optimization Suggestion:**
```
Control Flow Warning: Potential infinite loop detected
```

### 4. Unused Variable Detection

**Idea:** Find variables that are declared but never used.

**Example:**
```
int x = 10;
int y = 20;      // ← Never used
print(x);
```

**Optimization Suggestion:**
```
Semantic Warning: Variable 'y' declared but never used
```

### Optimization Process

```
Source Code
    ↓
[LEXER] → Tokens
    ↓
[PARSER] → AST
    ↓
[SEMANTIC ANALYZER] → Symbol Table
    ↓
[IR GENERATOR] → 3AC Code
    ↓
[OPTIMIZER] → Improved 3AC
    ↓
[CODE GENERATOR] → Machine Code (future)
```

---

## How to Use

### Step 1: Open the Compiler
1. Open `index.html` in your browser (Chrome, Firefox, Edge, Safari)
2. You should see the Compiler Frontend interface

### Step 2: Enter Code
1. Click in the **"Source Code Input"** box
2. Type or paste your program code
3. Or click **"⊕ Load Example"** for a sample program

### Step 3: Compile
1. Click **"▶ Compile"** button
2. The compiler processes through all 4 phases
3. Results appear in the output sections

### Step 4: View Results

You'll see:

**① Lexical Analysis (Tokens)**
- Table showing all tokens
- Type, value, line, and column for each

**② Syntax Analysis (AST)**
- Top-Down Parser: Tree structure with indentation
- Bottom-Up Parser: Shift-reduce steps
- Color-coded node types

**③ Semantic Analysis (Symbol Table)**
- All variables declared
- Their types and whether initialized/used
- Statistics (total, unused, uninitialized)

**④ Intermediate Representation (3AC)**
- Three-address code instructions
- Quadruples table with operations and operands

**⚡ Code Optimizations**
- Suggestions for constant folding
- Dead code warnings
- Infinite loop warnings
- Unused variable warnings

**! Errors & Warnings**
- Compilation errors (red)
- Warnings (orange)
- Success message (green)

### Step 5: Export Results
- Click **"⬇ Export Results"** to download a text file with all outputs
- Useful for reports and documentation

---

## Test Examples

### Example 1: Hello Compiler
```
int x = 5;
print(x);
```

**Expected Output:**
- Tokens: 5 tokens
- AST: 2 declaration/print nodes
- Symbol Table: 1 variable (x)
- Errors: None ✓

---

### Example 2: With Conditionals
```
int age = 25;
if (age > 18) {
    print(age);
}
```

**Expected Output:**
- Tokens: 11 tokens
- AST: IfStatement with condition and body
- Symbol Table: 1 variable (age)
- 3AC: Conditional jump with labels
- Errors: None ✓

---

### Example 3: With Optimization
```
int x = 5 + 10;
int y = 3 * 4;
print(x);
print(y);
```

**Expected Output:**
- Tokens: 18 tokens
- AST: 2 declarations, 2 prints
- Symbol Table: 2 variables (x, y)
- Optimizations: 
  - "5 + 10 can be replaced with 15"
  - "3 * 4 can be replaced with 12"
- Errors: None ✓

---

### Example 4: Error Case
```
int x = 10;
y = 20;          // ERROR: y not declared
print(y);
```

**Expected Output:**
- Tokens: 9 tokens
- AST: 1 declaration, 1 error assignment
- Symbol Table: 1 variable (x)
- Errors: "Variable 'y' used before declaration" ✗
- Compilation stops at semantic phase

---

### Example 5: Dead Code
```
int x = 10;
if (x > 5) {
    return x;
    print(x);    // Unreachable
}
```

**Expected Output:**
- All phases complete
- Optimization warning: "Unreachable code after return statement"
- Symbol Table: Shows x is used

---

### Example 6: Infinite Loop
```
int count = 0;
while (true) {
    print(count);
}
```

**Expected Output:**
- Symbol Table: count declared
- Optimization warning: "Potential infinite loop detected"
- All syntax correct ✓

---

### Example 7: Unused Variable
```
int x = 10;
int y = 20;
print(x);
```

**Expected Output:**
- Symbol Table:
  - x: initialized=YES, used=YES ✓
  - y: initialized=YES, used=NO ⚠️
- Warning: "Variable 'y' declared but never used"

---

### Example 8: Type Checking
```
int x = 5;
int y = x + 10;
print(y);
```

**Expected Output:**
- All phases pass ✓
- Symbol Table: Both x and y valid
- IR: Shows addition operation
- No errors

---

## Key Terminology

| Term | Meaning |
|------|---------|
| **Lexer** | Converts source code to tokens |
| **Token** | Smallest meaningful unit (keyword, identifier, number) |
| **Parser** | Converts tokens to AST using grammar rules |
| **AST** | Tree representation of program structure |
| **Grammar** | Rules that define valid syntax |
| **Semantic Analysis** | Checks logical correctness (declarations, types) |
| **Symbol Table** | Database of identifiers (variables) |
| **IR** | Intermediate representation (three-address code) |
| **3AC** | Three-Address Code (instructions with ≤3 operands) |
| **Optimization** | Improving code performance/efficiency |
| **Scope** | Region where a variable is valid |
| **Type Checking** | Verifying type compatibility |
| **Recursive Descent** | Top-down parser using recursion |
| **Shift-Reduce** | Bottom-up parser using stack |
| **Dead Code** | Unreachable code that never executes |
| **Constant Folding** | Pre-computing constant expressions |

---

## Compilation Phases Summary

```
┌─────────────────────────────────────────┐
│         SOURCE CODE (text)              │
└────────────────────┬────────────────────┘
                     ↓
┌─────────────────────────────────────────┐
│    PHASE 1: LEXICAL ANALYSIS            │
│  (Lexer: text → tokens)                 │
│  Checks: Unknown characters, formatting │
└────────────────────┬────────────────────┘
                     ↓
        [TOKENS] (meaningful units)
                     ↓
┌─────────────────────────────────────────┐
│    PHASE 2: SYNTAX ANALYSIS             │
│  (Parser: tokens → AST)                 │
│  Checks: Grammar rules, brackets, etc.  │
└────────────────────┬────────────────────┘
                     ↓
    [AST] (tree structure of program)
                     ↓
┌─────────────────────────────────────────┐
│    PHASE 3: SEMANTIC ANALYSIS           │
│  (Analyzer: AST → symbol table)         │
│  Checks: Declarations, types, scope     │
└────────────────────┬────────────────────┘
                     ↓
  [SYMBOL TABLE] (variable tracking)
                     ↓
┌─────────────────────────────────────────┐
│    PHASE 4: IR GENERATION               │
│  (Generator: AST → 3AC)                 │
│  Creates: Three-address code            │
└────────────────────┬────────────────────┘
                     ↓
       [3AC] (low-level instructions)
                     ↓
┌─────────────────────────────────────────┐
│    CODE OPTIMIZATION (optional)         │
│  (Optimizer: 3AC → optimized 3AC)       │
│  Suggests: Constant folding, dead code  │
└────────────────────┬────────────────────┘
                     ↓
    [OPTIMIZED 3AC] (improved code)
                     ↓
        (Future: Code Generation)
```

---

## Quick Reference: Supported Language

**Data Types:**
- `int` - Integer numbers
- `float` - Decimal numbers
- `string` - Text (in quotes)
- `bool` - Boolean (true/false)

**Keywords:**
- `if`, `else` - Conditionals
- `while`, `for` - Loops
- `print` - Output
- `return` - Return from function
- `true`, `false` - Boolean values

**Operators:**
- Arithmetic: `+`, `-`, `*`, `/`, `%`
- Comparison: `==`, `!=`, `<`, `>`, `<=`, `>=`
- Logical: `&&`, `||`, `!`
- Assignment: `=`, `+=`, `-=`, `*=`, `/=`

**Punctuation:**
- Brackets: `()`, `{}`, `[]`
- Semicolon: `;`
- Comma: `,`

---

## Now You're Ready!

You understand:
1. ✓ How the **Lexer** tokenizes code
2. ✓ How **Parsers** build ASTs
3. ✓ How **Semantic Analysis** checks correctness
4. ✓ How **IR** represents low-level code
5. ✓ How **Optimization** improves performance
6. ✓ How to **use** the compiler frontend

**Start testing with the examples above!** 🚀
